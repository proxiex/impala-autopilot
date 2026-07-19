# I gave African micro-merchants an AI employee — built on Qwen, in six days

*Publish under your name (Medium / dev.to / Hashnode). Add 2–3 screenshots: the Pidgin invoice approval card, the bulk-import parse, the architecture diagram.*

---

I run [ImpalaFlow](https://impalaflow.com), a commerce platform for entrepreneurs across Africa — storefronts, inventory, invoicing, donations, SMS/email campaigns. Our merchants don't run their businesses from dashboards; they run them from chat threads. Orders arrive as "abeg how much for 2 bag of rice, deliver am to Yaba?" — Pidgin, Swahili, French, English, all mixed, often with a photo instead of a product name.

For the Global AI Hackathon with Qwen Cloud (Track 4: Autopilot Agent), I built the missing employee: **ImpalaFlow Autopilot**, an agent that reads those messy messages, checks real stock and real prices, drafts the invoice, chases unpaid ones, remembers every customer — and never sends anything without the merchant's approval.

The result is live on Alibaba Cloud, open source, and judges can use it in 30 seconds without installing anything. Here's how it came together, including the parts that went wrong.

## The unfair advantage: a real platform underneath

Most hackathon agents mock their "business." I didn't need to: ImpalaFlow already has a REST API for products, orders, invoicing, donations, contacts, and forms. The agent is a separate open-source service that drives **the exact same API our dashboard uses** — zero backend changes. When the Autopilot issues an invoice, a real invoice exists, a real email goes out, and a real Paystack payment link works.

That decision shaped everything: the agent isn't a demo of what commerce automation *could* look like. It's a new interface to a business that already exists.

## Architecture in one breath

A Node/TypeScript service wraps a **qwen-max function-calling loop** over fifteen business tools. It runs on **Alibaba Cloud Function Compute** (Singapore), calls Qwen through **Model Studio (DashScope)** via the OpenAI-compatible endpoint, and talks to ImpalaFlow in **multi-tenant token mode** — the service stores no credentials; every request acts as the merchant who made it. The dashboard is a single static page served by the same service; the whole toolset is also exposed as an **MCP server**, so Claude Desktop can literally operate a store.

## The three lessons worth stealing

**1. Never let the model touch a price.**
In an early live test I asked for an invoice for "1 cooking oil and 2 Milo tins." The agent produced a beautiful, confident invoice… for "Pure Sunflower Cooking Oil" at GHS 20 and "Nestle Milo Tins" at GHS 5 — products that don't exist, at prices it invented. The fix wasn't a better prompt. It was a **deterministic grounding layer**: before any invoice reaches the approval preview, every line item is matched against the live catalog, catalog names and prices always win, and unknown items bounce back to the model with instructions. The same check runs again at execution time. After that change, a hallucinated invoice isn't unlikely — it's *impossible*.

**2. Approval is an architecture, not a button.**
Every action tool (create invoice, send reminder, bulk-create products) goes through a propose → approve flow: the loop captures a proposal with a human-readable preview; a separate authenticated call executes it; no approver present means the action simply doesn't run. Track 4 asks for "human-in-the-loop checkpoints" — my take is that the checkpoint belongs in the tool layer, where the model can't route around it.

**3. Memory doesn't need a vector store.**
"What's my history with Ada?" is answered from live contacts, invoices, and orders — total billed, total paid, what's outstanding. Recall grounded in business data is always true and never drifts. For a commerce agent, the platform *is* the memory.

## My favorite moment

I pasted this into the chat:

```
add these to my catalog:
Sardine tin, 12
peak milk small - 8.5
Indomie carton 85 (stock 25)
sugar 1kg,18, 40 left
```

Four lines, four different formats. qwen-max parsed every one — names, prices, and both differently-phrased stock counts — into a single approval card, and one tap created the whole catalog. Merchant onboarding from a scribbled price list: that's the moment this stopped feeling like a hackathon project.

## The unglamorous parts

- Apple Silicon + `docker build` for x86 = OOM-killed `npm ci` until I gave Docker Desktop more than 1 GB of RAM.
- Alibaba's Container Registry tiers each refused me for a different reason (Economy Edition: "no image processing"; Personal Edition: couldn't be created on my account) — Docker Hub + FC's custom-repository option saved the deploy.
- `dotenv` silently truncates passwords at `#`. Quote your env values.
- qwen-max occasionally returns an empty turn; a two-retry loop made it disappear.

## What's next

This ships to real merchants: WhatsApp as the customer channel, qwen-vl-max for photo → product quoting ("how much for *this*?" + a picture), scheduled payment-recovery sweeps, and campaign drafting. The hackathon deadline made me cut those; the merchants won't let me leave them cut for long.

**Code:** github.com/proxiex/impala-autopilot · **Live demo:** in the README · Built with Qwen on Alibaba Cloud.
