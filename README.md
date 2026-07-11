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

### Run as a service

```bash
npm run serve            # HTTP API on :8787
```

Multi-tenant — each request carries the merchant's ImpalaFlow bearer token:
- `POST /agent/chat` `{ message, history }` → `{ answer, proposal }` (a proposed action is **not** executed)
- `POST /agent/approve` `{ proposal }` → executes the approved action

Deploying on Alibaba Cloud: see [DEPLOY.md](DEPLOY.md).

## Status

Working end to end against the live ImpalaFlow API (verified on a Ghana test store):
- Authenticated client (form login + Bearer + refresh) plus **token mode** for the service.
- Qwen tool-calling loop: reads (`list_products`, `order_stats`, `invoice_stats`) + the action
  `create_invoice` (create → issue → email the customer → pay link), currency-aware.
- **Human approval gate** — actions never run without approval.
- **CLI** (`npm run chat`) and **HTTP service** (`npm run serve`), both with propose → approve.

Next: the dashboard Autopilot inbox in IF-FE, more action tools (payment recovery, marketing,
donations), and `qwen-vl-max` photo→product. See
[`../IF-FE/docs/autopilot-agent-plan.md`](../IF-FE/docs/autopilot-agent-plan.md).

## License

MIT — see [LICENSE](LICENSE).
