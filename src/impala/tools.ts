/**
 * Tool implementations + a registry that tags which tools need merchant
 * approval before they run.
 *
 * Read tools run automatically. Action tools (create_invoice, and later
 * campaigns/marketing) are marked `requiresApproval` — the agent loop routes
 * them through a human approval gate before executing.
 *
 * Keep the registry keys in sync with src/agent/toolsSchema.ts.
 */
import type { ImpalaFlowClient } from "./client";

/** Backend list endpoints return either {items:[...]} or a bare array. */
function itemsOf(data: any): any[] {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data.items ?? data.results ?? [];
  }
  if (Array.isArray(data)) return data;
  return [];
}

// ---- read tools -----------------------------------------------------------

export async function listProducts(
  client: ImpalaFlowClient,
  args: { query?: string; limit?: number } = {},
): Promise<unknown> {
  const data = await client.get("/api/private/products", {
    limit: 100,
    offset: 0,
  });
  let compact = itemsOf(data).map((p: any) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    stock: p.stock,
    stock_status: p.stock_status,
    sku: p.sku,
    item_type: p.item_type,
  }));
  if (args.query) {
    const q = args.query.toLowerCase();
    compact = compact.filter(
      (p) =>
        String(p.name ?? "").toLowerCase().includes(q) ||
        String(p.sku ?? "").toLowerCase().includes(q),
    );
  }
  return { count: compact.length, products: compact.slice(0, args.limit ?? 50) };
}

export async function orderStats(client: ImpalaFlowClient): Promise<unknown> {
  const data = await client.get("/api/private/orders");
  if (data && typeof data === "object" && "stats" in data) {
    return { stats: data.stats, recent_count: itemsOf(data).length };
  }
  return { stats: data };
}

export async function invoiceStats(client: ImpalaFlowClient): Promise<unknown> {
  const data = await client.get("/api/private/tenants/invoicing/stats");
  return { stats: data };
}

// ---- action tools (approval-gated) ----------------------------------------

export interface InvoiceItemArg {
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
}

export interface CreateInvoiceArgs {
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  items: InvoiceItemArg[];
  currency?: string;
  due_in_days?: number;
  note?: string;
  /** Send to the customer now (mark sent + email). Defaults to true. */
  send?: boolean;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function invoiceTotal(items: InvoiceItemArg[]): number {
  return (items ?? []).reduce(
    (sum, it) => sum + Number(it.quantity) * Number(it.unit_price),
    0,
  );
}

/** Human-readable preview shown to the merchant at the approval gate. */
export function previewInvoice(args: CreateInvoiceArgs): string {
  const cur = args.currency ?? "";
  const fmt = (n: number) =>
    cur ? `${cur} ${n.toLocaleString()}` : n.toLocaleString();
  const lines = (args.items ?? []).map(
    (it) =>
      `  • ${it.quantity} × ${it.name} @ ${fmt(Number(it.unit_price))} = ${fmt(
        Number(it.quantity) * Number(it.unit_price),
      )}`,
  );
  const intent =
    args.send === false ? " (save as draft)" : " (will be sent to the customer)";
  return [
    `INVOICE → ${args.customer_name} <${args.customer_email}>${intent}`,
    ...lines,
    `  Total: ${fmt(invoiceTotal(args.items))}`,
    args.note ? `  Note: ${args.note}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Create an invoice and, unless send=false, mark it sent and email it to the
 * customer. Runs only after the merchant approves. Returns a live pay link.
 */
export async function createInvoice(
  client: ImpalaFlowClient,
  args: CreateInvoiceArgs,
): Promise<unknown> {
  // Resolve currency robustly: explicit arg, cached default, or fetch it now.
  let cur = args.currency ?? client.defaultCurrency;
  if (!cur) cur = (await client.fetchDefaultCurrency()) ?? "NGN";
  const now = new Date();
  const due = new Date(now.getTime() + (args.due_in_days ?? 7) * 86_400_000);

  const payload = {
    customer_name: args.customer_name,
    customer_email: args.customer_email,
    customer_phone: args.customer_phone ?? "",
    issue_date: isoDate(now),
    due_date: isoDate(due),
    currency: cur,
    discount_type: "none",
    discount_value: 0,
    note: args.note ?? "",
    terms: "",
    items: (args.items ?? []).map((it, i) => ({
      name: it.name,
      description: it.description ?? "",
      quantity: it.quantity,
      unit_price: it.unit_price,
      sort_order: i,
    })),
    status: "draft",
  };

  const created: any = await client.post(
    "/api/private/tenants/invoicing/invoices",
    payload,
  );
  const id = created?.id ?? created?.invoice_id;
  const payLink = id ? `${client.appUrl}/invoice/${id}` : undefined;

  let status: string = created?.status ?? "draft";
  let delivered = false;
  let sendError: string | undefined;
  const send = args.send !== false; // default: send

  // The invoice already exists at this point, so everything below is best-effort:
  // a failure here must NOT throw, or the agent would recreate the invoice.
  if (send && id) {
    try {
      // transition draft -> pending (issued / awaiting payment)
      await client.request(
        "PUT",
        `/api/private/tenants/invoicing/invoices/${id}/status`,
        { json: { status: "pending" } },
      );
      status = "pending";
      // deliver to the customer by email (invoice is already payable via pay_link)
      try {
        await client.post(
          `/api/private/tenants/invoicing/invoices/${id}/share`,
          {
            method: "email",
            email: args.customer_email,
            invoice_link: payLink,
            include_reminder: true,
          },
        );
        delivered = true;
      } catch {
        // delivery is best-effort
      }
    } catch (err: any) {
      sendError = String(err?.message ?? err);
    }
  }

  return {
    ok: true,
    invoice_id: id,
    invoice_number: created?.invoice_number,
    total: invoiceTotal(args.items),
    currency: cur,
    status,
    sent: send && !sendError,
    delivered,
    pay_link: payLink,
    ...(sendError ? { send_error: sendError } : {}),
  };
}

// ---- registry -------------------------------------------------------------

export type ToolFn = (client: ImpalaFlowClient, args: any) => Promise<unknown>;

export interface ToolDef {
  run: ToolFn;
  /** If true, the loop asks the merchant to approve before running. */
  requiresApproval?: boolean;
  /** Builds the human-readable preview shown at the approval gate. */
  preview?: (args: any) => string;
}

export const REGISTRY: Record<string, ToolDef> = {
  list_products: { run: (c, a) => listProducts(c, a) },
  order_stats: { run: (c) => orderStats(c) },
  invoice_stats: { run: (c) => invoiceStats(c) },
  create_invoice: {
    run: (c, a) => createInvoice(c, a),
    requiresApproval: true,
    preview: (a) => previewInvoice(a),
  },
};
