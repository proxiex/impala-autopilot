/**
 * Function schemas for the tools the model may call.
 * Keep in sync with src/impala/tools.ts::TOOL_FUNCTIONS.
 */
import type OpenAI from "openai";

type Tool = OpenAI.Chat.Completions.ChatCompletionTool;

export const TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "list_products",
      description:
        "List the merchant's catalog products with price and stock. Use `query` " +
        "to search by product name or SKU when the customer names a specific item.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Optional name/SKU substring to filter by.",
          },
          limit: {
            type: "integer",
            description: "Max products to return (default 50).",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "order_stats",
      description:
        "Get aggregate sales/order stats: total revenue (GMV), net revenue after " +
        "fees, and paid/pending/shipped/delivered counts.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "invoice_stats",
      description:
        "Get the invoicing summary: total paid, pending, and overdue amounts for " +
        "the merchant.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "search_contacts",
      description:
        "Search the merchant's contacts/customers by name, email, or phone. " +
        "Requires a search term of at least 3 characters.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search term (min 3 chars)." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_campaigns",
      description:
        "List the merchant's donation/fundraising campaigns (ImpalaGive) with " +
        "amounts raised and goals.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "donation_stats",
      description:
        "Get fundraising totals across all campaigns: total raised, net amount, " +
        "donor counts, and average donation.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_smart_forms",
      description:
        "List the merchant's smart forms (lead-capture/order forms) with how many " +
        "submissions each has.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_unpaid_invoices",
      description:
        "List invoices that are still awaiting payment (pending/viewed/overdue), " +
        "with customer, amount, due date, and whether they are overdue.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "send_invoice_reminder",
      description:
        "Email a payment reminder (with the pay link) for an existing unpaid " +
        "invoice. Use list_unpaid_invoices first to get the invoice id and " +
        "customer email. The merchant approves before it is sent. Remind ONE " +
        "invoice per call.",
      parameters: {
        type: "object",
        properties: {
          invoice_id: { type: "string" },
          customer_email: { type: "string" },
          invoice_number: { type: "string" },
        },
        required: ["invoice_id", "customer_email"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "customer_history",
      description:
        "Recall everything about a customer: contact record, past invoices and " +
        "orders, total billed/paid, and what they still owe. Use it whenever the " +
        "merchant asks about a customer, or a returning customer is mentioned.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Customer name or email (min 3 chars).",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bulk_create_products",
      description:
        "Create MANY products in the catalog at once. Use when the merchant " +
        "pastes a CSV, a price list, or any messy stock list — parse it into " +
        "structured products first (name + price required; stock and description " +
        "when present). The merchant approves the full list before creation.",
      parameters: {
        type: "object",
        properties: {
          products: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                price: { type: "number" },
                stock: { type: "number" },
                description: { type: "string" },
              },
              required: ["name", "price"],
            },
          },
        },
        required: ["products"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_invoice",
      description:
        "Draft and issue an invoice to a customer. Look up real product prices " +
        "with list_products first — never guess a price. The merchant is asked " +
        "to approve before the invoice is saved or sent, so do not ask for " +
        "confirmation yourself; just call this with the details you have.",
      parameters: {
        type: "object",
        properties: {
          customer_name: { type: "string" },
          customer_email: { type: "string" },
          customer_phone: { type: "string" },
          items: {
            type: "array",
            description: "Line items to bill.",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                quantity: { type: "number" },
                unit_price: {
                  type: "number",
                  description: "Price per unit in the invoice currency.",
                },
              },
              required: ["name", "quantity", "unit_price"],
            },
          },
          currency: {
            type: "string",
            description:
              "Only set if the customer explicitly names a currency; otherwise " +
              "omit and the store's default currency is used.",
          },
          due_in_days: {
            type: "integer",
            description: "Days until the invoice is due (default 7).",
          },
          send: {
            type: "boolean",
            description:
              "Send the invoice to the customer now (default true). Set false " +
              "to only save a draft for the merchant to review.",
          },
          note: { type: "string" },
        },
        required: ["customer_name", "customer_email", "items"],
      },
    },
  },
];
