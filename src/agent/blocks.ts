/**
 * Maps the agent's tool invocations into structured "blocks" the dashboard
 * renders as rich cards. Text channels ignore blocks and use the prose answer.
 */
import type { ToolInvocation } from "./loop";

export interface Block {
  type: "products" | "stats" | "list";
  title?: string;
  currency?: string;
  items?: unknown[];
  stats?: Record<string, unknown>;
}

interface ListItem {
  title: string;
  subtitle?: string;
  badge?: string;
}

export function toBlocks(
  invocations: ToolInvocation[],
  currency?: string | null,
): Block[] {
  const blocks: Block[] = [];
  for (const { name, result } of invocations) {
    const r = result as any;
    if (!r || r.error) continue;

    switch (name) {
      case "list_products":
        if (r.products?.length) {
          blocks.push({
            type: "products",
            title: "Products",
            currency: currency ?? undefined,
            items: r.products,
          });
        }
        break;
      case "order_stats":
        if (r.stats) blocks.push({ type: "stats", title: "Sales", stats: r.stats });
        break;
      case "invoice_stats":
        if (r.stats) blocks.push({ type: "stats", title: "Invoicing", stats: r.stats });
        break;
      case "donation_stats":
        if (r.stats) blocks.push({ type: "stats", title: "Donations", stats: r.stats });
        break;
      case "list_campaigns":
        if (r.campaigns?.length) {
          blocks.push({
            type: "list",
            title: "Campaigns",
            items: r.campaigns.map(
              (c: any): ListItem => ({
                title: c.title,
                subtitle: `${c.currency ?? ""} ${c.raised_amount ?? 0} raised of ${c.goal_amount ?? 0}`,
                badge: c.status,
              }),
            ),
          });
        }
        break;
      case "search_contacts":
        if (r.contacts?.length) {
          blocks.push({
            type: "list",
            title: "Contacts",
            items: r.contacts.map(
              (c: any): ListItem => ({
                title: c.name,
                subtitle: [c.email, c.phone].filter(Boolean).join(" · "),
                badge: c.status,
              }),
            ),
          });
        }
        break;
      case "list_smart_forms":
        if (r.forms?.length) {
          blocks.push({
            type: "list",
            title: "Forms",
            items: r.forms.map(
              (f: any): ListItem => ({
                title: f.name,
                subtitle: `${f.submissions_count ?? 0} submissions`,
                badge: f.status,
              }),
            ),
          });
        }
        break;
    }
  }
  return blocks;
}
