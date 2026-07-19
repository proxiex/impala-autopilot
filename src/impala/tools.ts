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
    image_url: p.image_url ?? null,
    description: p.description ?? null,
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

/**
 * Contact search with token fallback: the backend matches per-field, so a full
 * name like "Salem Longshak" can return zero results. If the full query
 * misses, retry with each name token and merge unique results.
 */
async function searchContactsSmart(
  client: ImpalaFlowClient,
  query: string,
): Promise<any[]> {
  const tenant = client.resolveTenantId();
  if (!tenant) return [];
  const seen = new Map<string, any>();
  const tryQuery = async (q: string) => {
    if (q.length < 3) return;
    try {
      const data = await client.get(
        `/api/private/account/${tenant}/contacts/search`,
        { query: q },
      );
      for (const c of itemsOf(data)) {
        const id = c.id ?? c.contact_id ?? c.email;
        if (id && !seen.has(id)) seen.set(id, c);
      }
    } catch {
      /* individual query failures are fine */
    }
  };
  await tryQuery(query);
  if (seen.size === 0 && /\s/.test(query)) {
    for (const token of query.split(/\s+/)) await tryQuery(token);
  }
  return [...seen.values()];
}

export async function searchContacts(
  client: ImpalaFlowClient,
  args: { query?: string },
): Promise<unknown> {
  const tenant = client.resolveTenantId();
  if (!tenant) return { error: "No tenant id available for this session." };
  const query = (args.query ?? "").trim();
  if (query.length < 3) {
    return { error: "Provide a search term of at least 3 characters." };
  }
  const found = await searchContactsSmart(client, query);
  const contacts = found.map((c: any) => ({
    id: c.id,
    name: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email,
    email: c.email,
    phone: c.phone,
    status: c.status,
  }));
  return { count: contacts.length, contacts };
}

/** List all contacts/customers (the dashboard's own home payload). */
export async function listContacts(
  client: ImpalaFlowClient,
  args: { limit?: number } = {},
): Promise<unknown> {
  const tenant = client.resolveTenantId();
  if (!tenant) return { error: "No tenant id available for this session." };
  const data = await client.get(`/api/private/${tenant}/home`);
  const all = (data?.tenant?.contacts ?? []).map((c: any) => ({
    id: c.id,
    name: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email,
    email: c.email,
    phone: c.phone,
    status: c.status,
  }));
  return { count: all.length, contacts: all.slice(0, args.limit ?? 50) };
}

/**
 * Whether the store can actually RECEIVE money: Paystack payment collection
 * must be configured or invoice pay links cannot accept payment.
 */
export async function paymentSetupStatus(
  client: ImpalaFlowClient,
): Promise<unknown> {
  const s: any = await client.get(
    "/api/private/tenants/invoicing/payment-collection/status",
  );
  const ready = !!(s?.is_enabled && s?.is_verified);
  return {
    ready,
    is_enabled: !!s?.is_enabled,
    is_verified: !!s?.is_verified,
    account_type: s?.account_type ?? null,
    bank_name: s?.bank_name ?? null,
    note: ready
      ? "Payment collection is configured — invoice pay links can accept payments."
      : "Payment collection is NOT set up: invoices can be sent, but customers cannot pay online until the merchant configures payment collection (bank or mobile money) in the ImpalaFlow dashboard under Invoicing → Payment settings.",
  };
}

export async function listCampaigns(client: ImpalaFlowClient): Promise<unknown> {
  const data = await client.get("/api/private/campaigns");
  const campaigns = itemsOf(data).map((c: any) => ({
    id: c.id,
    title: c.title,
    status: c.status,
    raised_amount: c.raised_amount,
    goal_amount: c.goal_amount,
    currency: c.currency,
    donor_count: c.donor_count,
  }));
  return { count: campaigns.length, campaigns };
}

export async function donationStats(client: ImpalaFlowClient): Promise<unknown> {
  const stats = await client.get("/api/private/campaigns/stats");
  return { stats };
}

export async function listSmartForms(client: ImpalaFlowClient): Promise<unknown> {
  const data = await client.get("/api/private/smart-forms/dashboard");
  const forms = itemsOf(data).map((f: any) => ({
    id: f.id,
    name: f.name,
    status: f.status,
    submissions_count: f.submissions_count,
    public_url: f.public_url,
  }));
  return { count: forms.length, forms };
}

export async function customerHistory(
  client: ImpalaFlowClient,
  args: { query?: string },
): Promise<unknown> {
  const query = (args.query ?? "").trim();
  if (query.length < 3) {
    return { error: "Provide a customer name or email of at least 3 characters." };
  }
  const q = normalize(query);
  const matches = (v: unknown) => normalize(String(v ?? "")).includes(q);

  // Contact record (best-effort — memory works even without one)
  let contact: any = null;
  try {
    const c = (await searchContactsSmart(client, query))[0];
    if (c) {
      contact = {
        name: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email,
        email: c.email,
        phone: c.phone,
        status: c.status,
      };
    }
  } catch {
    /* contact lookup is optional */
  }

  // Invoice history
  const invData = await client.get("/api/private/tenants/invoicing/invoices");
  const invoices = itemsOf(invData)
    .filter(
      (inv: any) =>
        matches(inv.client_name ?? inv.customer_name) ||
        matches(inv.client_email ?? inv.customer_email),
    )
    .map((inv: any) => ({
      invoice_number: inv.invoice_number,
      amount: Number(inv.amount ?? inv.total ?? 0),
      currency: inv.currency,
      status: inv.status,
      issue_date: inv.issue_date,
    }));

  // Order history
  let orders: any[] = [];
  try {
    const ordData = await client.get("/api/private/orders");
    orders = itemsOf(ordData)
      .filter((o: any) => {
        const c = o.customer ?? {};
        return (
          matches([c.first_name, c.last_name].filter(Boolean).join(" ")) ||
          matches(c.email)
        );
      })
      .map((o: any) => ({
        order_id: o.id,
        total: o.total,
        currency: o.currency,
        status: o.status,
        created_at: o.created_at,
      }));
  } catch {
    /* orders are optional */
  }

  const paidStatuses = new Set(["paid"]);
  const totalBilled = invoices.reduce((s, i) => s + i.amount, 0);
  const totalPaid = invoices
    .filter((i) => paidStatuses.has(String(i.status).toLowerCase()))
    .reduce((s, i) => s + i.amount, 0);

  if (!contact && invoices.length === 0 && orders.length === 0) {
    return { found: false, note: `No history for "${query}".` };
  }
  return {
    found: true,
    contact,
    invoices,
    orders,
    total_billed: totalBilled,
    total_paid: totalPaid,
    outstanding: totalBilled - totalPaid,
  };
}

export interface CreateContactArgs {
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
  city?: string;
  region?: string;
}

export function previewContact(a: CreateContactArgs): string {
  const name = [a.first_name, a.last_name].filter(Boolean).join(" ");
  const bits = [a.email, a.phone, [a.city, a.region].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(" · ");
  return `ADD CONTACT → ${name}\n  ${bits}`;
}

/** Create a contact in the merchant's CRM. Approval-gated. */
export async function createContact(
  client: ImpalaFlowClient,
  args: CreateContactArgs,
): Promise<unknown> {
  const tenant = client.resolveTenantId();
  if (!tenant) return { error: "Could not resolve the tenant id." };
  const created: any = await client.post(
    `/api/private/tenants/${tenant}/contacts`,
    {
      first_name: (args.first_name ?? "").trim(),
      last_name: (args.last_name ?? "").trim(),
      email: (args.email ?? "").trim(),
      phone: (args.phone ?? "").trim(),
      region: (args.region ?? "").trim(),
      city: (args.city ?? "").trim(),
    },
  );
  return {
    ok: true,
    contact: {
      id: created?.id,
      name: [args.first_name, args.last_name].filter(Boolean).join(" "),
      email: args.email,
      phone: args.phone ?? null,
    },
  };
}

export interface BulkProductArg {
  name: string;
  price: number;
  stock?: number;
  description?: string;
}

export function previewBulkProducts(args: { products: BulkProductArg[] }): string {
  const rows = (args.products ?? []).map(
    (p) =>
      `  • ${p.name} @ ${Number(p.price).toLocaleString()}` +
      (p.stock !== undefined && p.stock !== null ? ` (stock ${p.stock})` : ""),
  );
  return [`CREATE ${rows.length} PRODUCTS in the catalog:`, ...rows].join("\n");
}

/** Create many products at once (from a pasted CSV/stock list). Approval-gated. */
export async function bulkCreateProducts(
  client: ImpalaFlowClient,
  args: { products: BulkProductArg[] },
): Promise<unknown> {
  const created: any[] = [];
  const failed: any[] = [];
  for (const p of args.products ?? []) {
    const payload = {
      name: p.name,
      price: Number(p.price),
      item_type: "product",
      description: p.description ?? "",
      stock: p.stock ?? null,
      track_inventory: p.stock !== undefined && p.stock !== null,
      charge_tax: false,
      requires_shipping: true,
    };
    try {
      const res: any = await client.post("/api/private/products", payload);
      created.push({
        id: res?.id,
        name: p.name,
        price: Number(p.price),
        stock: p.stock ?? null,
      });
    } catch (err: any) {
      failed.push({ name: p.name, error: String(err?.message ?? err).slice(0, 120) });
    }
  }
  return { ok: failed.length === 0, created_count: created.length, created, failed };
}

export async function listUnpaidInvoices(
  client: ImpalaFlowClient,
): Promise<unknown> {
  const data = await client.get("/api/private/tenants/invoicing/invoices");
  const today = isoDate(new Date());
  const unpaid = itemsOf(data)
    .filter((inv: any) =>
      ["pending", "viewed", "overdue"].includes(
        String(inv.status ?? "").toLowerCase(),
      ),
    )
    .map((inv: any) => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      customer_name: inv.client_name ?? inv.customer_name,
      customer_email: inv.client_email ?? inv.customer_email,
      amount: inv.amount ?? inv.total,
      currency: inv.currency,
      due_date: inv.due_date,
      overdue: Boolean(inv.due_date && String(inv.due_date) < today),
    }));
  return { count: unpaid.length, unpaid };
}

export interface SendReminderArgs {
  invoice_id: string;
  customer_email: string;
  invoice_number?: string;
}

/** Email a payment reminder for an existing invoice. Approval-gated. */
export async function sendInvoiceReminder(
  client: ImpalaFlowClient,
  args: SendReminderArgs,
): Promise<unknown> {
  const link = `${client.appUrl}/invoice/${args.invoice_id}`;
  await client.post(
    `/api/private/tenants/invoicing/invoices/${args.invoice_id}/share`,
    {
      method: "email",
      email: args.customer_email,
      invoice_link: link,
      include_reminder: true,
    },
  );
  return {
    ok: true,
    reminded: args.customer_email,
    invoice_number: args.invoice_number,
    pay_link: link,
  };
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

function normalize(s: string): string {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Deterministic price grounding: every invoice line must resolve to a real
 * catalog product, and the catalog price ALWAYS wins over whatever the model
 * put in unit_price. The model cannot invent products or prices.
 * Items that don't match anything are rejected back to the model.
 */
export async function groundInvoiceArgs(
  client: ImpalaFlowClient,
  args: CreateInvoiceArgs,
): Promise<{ ok: true; args: CreateInvoiceArgs } | { ok: false; error: string }> {
  const data = await client.get("/api/private/products", {
    limit: 100,
    offset: 0,
  });
  const catalog = itemsOf(data).map((p: any) => ({
    name: String(p.name ?? ""),
    norm: normalize(p.name ?? ""),
    price: Number(p.price),
  }));

  const grounded: InvoiceItemArg[] = [];
  const unmatched: string[] = [];
  for (const item of args.items ?? []) {
    const wanted = normalize(item.name);
    // exact -> substring -> token-overlap (>= half the product's words in common)
    const fallback =
      catalog.find((p) => p.norm === wanted) ??
      catalog.find((p) => p.norm.includes(wanted) || wanted.includes(p.norm)) ??
      catalog.find((p) => {
        const a = new Set(wanted.split(" "));
        const b = p.norm.split(" ");
        const common = b.filter((w) => a.has(w)).length;
        return common >= Math.max(1, Math.ceil(b.length / 2));
      });
    if (!fallback) {
      unmatched.push(item.name);
      continue;
    }
    grounded.push({
      name: fallback.name,
      description: item.description,
      quantity: item.quantity,
      unit_price: fallback.price,
    });
  }

  if (unmatched.length) {
    return {
      ok: false,
      error:
        `These items are not in the catalog: ${unmatched.join(", ")}. ` +
        `Use list_products to find the exact product names, and only invoice real products.`,
    };
  }
  return { ok: true, args: { ...args, items: grounded } };
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
  /**
   * Deterministic validation/correction of args against live data, run BEFORE
   * the approval preview. Returns corrected args or an error for the model.
   */
  ground?: (
    client: ImpalaFlowClient,
    args: any,
  ) => Promise<{ ok: true; args: any } | { ok: false; error: string }>;
}

export const REGISTRY: Record<string, ToolDef> = {
  list_products: { run: (c, a) => listProducts(c, a) },
  order_stats: { run: (c) => orderStats(c) },
  invoice_stats: { run: (c) => invoiceStats(c) },
  search_contacts: { run: (c, a) => searchContacts(c, a) },
  list_contacts: { run: (c, a) => listContacts(c, a) },
  payment_setup_status: { run: (c) => paymentSetupStatus(c) },
  list_campaigns: { run: (c) => listCampaigns(c) },
  donation_stats: { run: (c) => donationStats(c) },
  list_smart_forms: { run: (c) => listSmartForms(c) },
  list_unpaid_invoices: { run: (c) => listUnpaidInvoices(c) },
  customer_history: { run: (c, a) => customerHistory(c, a) },
  create_contact: {
    run: (c, a) => createContact(c, a),
    requiresApproval: true,
    preview: (a) => previewContact(a),
  },
  bulk_create_products: {
    run: (c, a) => bulkCreateProducts(c, a),
    requiresApproval: true,
    preview: (a) => previewBulkProducts(a),
  },
  create_invoice: {
    run: (c, a) => createInvoice(c, a),
    requiresApproval: true,
    preview: (a) => previewInvoice(a),
    ground: (c, a) => groundInvoiceArgs(c, a),
  },
  send_invoice_reminder: {
    run: (c, a) => sendInvoiceReminder(c, a),
    requiresApproval: true,
    preview: (a) =>
      `PAYMENT REMINDER → ${a.customer_email}` +
      (a.invoice_number ? ` for invoice ${a.invoice_number}` : ""),
  },
};
