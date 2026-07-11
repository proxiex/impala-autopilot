# ImpalaFlow Autopilot

**An AI operations agent for African micro-merchants.** It reads a merchant's live
ImpalaFlow business data and (soon) takes actions on their behalf — drafting quotes and
invoices, following up on leads, running campaigns — with the merchant approving anything
that goes out. Built on **Qwen** models running on **Alibaba Cloud**.

> Submission for the Global AI Hackathon with Qwen Cloud — **Track 4: Autopilot Agent**.

## What makes it real

It is not a chatbot bolted onto a demo. The agent drives the **same REST API the ImpalaFlow
dashboard already uses** (`api.impalaflow.com`) — the exact endpoints behind Orders,
Invoicing, Contacts, Donations, and Marketing. So when it answers "how's business?" or drafts
an invoice, it's operating on the merchant's real catalog, stock, and sales.

## Architecture

```
WhatsApp customer ─┐
                   ├─► Autopilot agent service (this repo, on Alibaba Cloud)
Merchant dashboard ┘        ├ Orchestrator: Qwen tool-calling loop (qwen-max)
                            ├ Approval gate: merchant signs off on outward actions
                            ├ Memory: per-customer / per-merchant
                            └ Qwen via DashScope: qwen-max / qwen-vl-max / qwen-turbo
                                     │
                                     ▼
                   ImpalaFlow API (existing) — products · orders · invoicing ·
                   donations · contacts · marketing
```

**Proof of Alibaba Cloud:** all model calls go through Alibaba Cloud Model Studio (DashScope).
See [`src/llm/client.ts`](src/llm/client.ts).

**Stack:** Node + TypeScript (ESM), the OpenAI SDK pointed at DashScope, native `fetch` for
the ImpalaFlow API. No framework yet — the HTTP service layer lands with the approval gate.

## Model routing (cost control)

| Job | Model |
|-----|-------|
| Orchestration reasoning | `qwen-max` (demo) / `qwen-plus` (dev) |
| Routing, extraction, classification | `qwen-turbo` |
| Photo → product matching | `qwen-vl-max` |

## Setup

Requires Node 18+ (`.nvmrc` pins 22 — run `nvm use`).

```bash
cp .env.example .env      # fill in DASHSCOPE_API_KEY + ImpalaFlow login
npm install
npm run chat              # interactive chat against your live tenant
```

Single-shot:

```bash
npm run chat -- "how much stock of rice do I have?"
```

## Status

Built and verified (type-check + logic tests):
- Authenticated ImpalaFlow client (form login + Bearer + 401 refresh).
- Qwen tool-calling loop with read tools: `list_products`, `order_stats`, `invoice_stats`.
- First **action tool** `create_invoice`, behind a **human approval gate** — the loop
  default-denies any action unless an approver explicitly allows it.
- CLI (`npm run chat`) with an interactive approve/decline prompt.

Next: more action tools (campaigns, marketing follow-ups), `qwen-vl-max` photo→product,
the dashboard Autopilot inbox in IF-FE, and the HTTP service. See
[`../IF-FE/docs/autopilot-agent-plan.md`](../IF-FE/docs/autopilot-agent-plan.md).

## License

MIT — see [LICENSE](LICENSE).
