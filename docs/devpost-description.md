# Devpost Submission — copy-paste kit

**Track:** Track 4 — Autopilot Agent
**Project name:** ImpalaFlow Autopilot
**Tagline:** An AI employee for African micro-merchants — it sells, bills, chases payments, and remembers every customer. Built on Qwen, plugged into a live commerce SaaS.

**Links to fill in the form:**
- Repo: https://github.com/proxiex/impala-autopilot
- Proof of Alibaba Cloud (code file): https://github.com/proxiex/impala-autopilot/blob/main/src/llm/client.ts
- Live demo: https://proxiex.github.io/impala-autopilot/ (demo login in the README; the agent API behind it runs on Alibaba Cloud Function Compute: https://impala-utopilot-seirlydawn.ap-southeast-1.fcapp.run/health)
- Video: (YouTube URL after upload)
- Blog: (URL after publishing docs/blog-post.md)

---

## Inspiration

ImpalaFlow is a live commerce platform for entrepreneurs across Africa. Our merchants run entire businesses from chat threads: orders arrive as "abeg how much for 2 bag of rice?" — Pidgin, Swahili, French, code-switched, unstructured. Every sale means manually checking stock, typing an invoice, chasing the payment, and remembering the customer. We built the employee who does all of that — and asks permission before anything leaves the building.

## What it does

- **Understands messy, multilingual customer messages** and turns them into business actions.
- **Issues real invoices**: looks up the merchant's live catalog and stock, drafts at real prices, and — after a one-tap merchant approval — creates, emails, and makes the invoice payable via Paystack.
- **Chases money**: finds unpaid/overdue invoices and sends approval-gated payment reminders with pay links.
- **Remembers every customer**: past invoices, orders, total paid, balance owed — memory grounded in live business data.
- **Onboards a catalog from one paste**: any messy price list or CSV becomes structured products behind a single approval card.
- **Answers "how is my business doing?"** across sales, invoicing, and donations with rich dashboard cards.
- **Works from any MCP client**: all 12 tools are exposed over the Model Context Protocol.

## How we built it

A Node + TypeScript service wraps a **qwen-max function-calling loop** (via Alibaba Cloud Model Studio / DashScope, OpenAI-compatible) over 12 tools that drive ImpalaFlow's existing REST API — the same API our production dashboard uses, with zero backend changes. It runs on **Alibaba Cloud Function Compute** (Singapore) as a custom container, serving both the JSON agent API and a self-contained web dashboard. Multi-tenant by construction: the service stores no credentials; each request carries the merchant's own token. Model routing is configurable (qwen-max for orchestration, qwen-plus for dev, qwen-turbo for high-volume classification).

## Challenges we ran into

- **Hallucinated prices.** In a live test the model invoiced invented products at invented prices. We solved it architecturally, not with prompts: a deterministic grounding layer validates every invoice line against the live catalog before the approval preview and again at execution — catalog prices always win, unknown items bounce back to the model. Invented invoices are now impossible.
- **Human-in-the-loop over HTTP.** A terminal can block on y/N; a web service can't. We built a propose → approve protocol: gated actions return a preview proposal, a separate authenticated call executes it, and no approver means default-deny.
- **Registry roulette.** ACR Economy Edition was rejected by Function Compute, Personal Edition couldn't be created on our account — Docker Hub + FC's custom-repository image option unblocked the deploy.

## Accomplishments we're proud of

Real production-readiness: a judge can open the hosted URL, sign into a demo store, and make the agent issue a real invoice with a working payment link in under a minute. It plugs into a live SaaS with real merchants — and ships to them after the hackathon.

## What we learned

For business agents, correctness beats eloquence: ground every number the model touches, put approval in the tool layer where the model can't route around it, and let the platform be the memory.

## What's next

WhatsApp as the customer channel, qwen-vl-max photo→product quoting, scheduled payment-recovery sweeps, and campaign drafting — rolling out to ImpalaFlow's merchant base.
