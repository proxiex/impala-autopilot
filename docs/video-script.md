# Demo Video — Shot-by-Shot Script (~3:00)

**Setup before recording (do ALL of these):**
- FC is running the LATEST image (the refresh click) — quick check: the side action menu and
  "Customer history ✏️" template chip must appear on the live demo URL.
- Record against the **live demo URL**, not localhost: `https://proxiex.github.io/impala-autopilot/`
  (that's the judges' link; its API runs on Alibaba Cloud FC behind the scenes)
- Test store cleaned of junk invoices EXCEPT Efua's unpaid GHS 30 one (the recovery demo needs it).
- If Paystack is configured on the test store: have a phone ready for the payment shot (Scene 2b).
- Browser at 100% zoom, close other tabs, quiet room. Record 1080p+. Screen recorder: QuickTime/OBS.
- Do ONE full rehearsal run first. qwen-max takes 5–15s per turn — that's fine, we cut waits in editing.

**Style:** no intro slides, no talking head. Screen + your voice. Cut all dead air. Judges decide in the first 30 seconds.

---

## Scene 1 — The hook (0:00–0:30)

**Screen:** dashboard already signed in, empty chat.

**Type (paste ready):**
```
abeg invoice Ama Owusu for 2 bag of rice and 1 milo tin, her email na ama.demo@gmail.com
```

**While it works, narrate:**
> "This is a real customer message — Nigerian Pidgin, no structure. ImpalaFlow Autopilot reads it, checks the merchant's real catalog and live stock, and drafts the invoice at real prices — it literally cannot invent a price. Nothing is sent until the merchant approves."

**Action:** the amber APPROVAL NEEDED card appears → hover it briefly → click **Approve & run**.

**Narrate over the green result card:**
> "One tap. Real invoice, emailed to the customer, with a live payment link."

## Scene 2 — (Option A, if Paystack is set up) Real money (0:30–0:55)

**Action:** click **Open pay link →** — the public invoice page opens → pay with mobile money/card on screen (or phone camera insert) → payment confirms.

**Narrate:**
> "And this is not a mock checkout — the customer pays through Paystack, and the money settles to the merchant's account. This is a live commerce platform with real merchants across Africa."

## Scene 2 — (Option B, no Paystack) The customer side (0:30–0:55)

**Action:** click **Open pay link →** to show the invoice exists publicly → back to dashboard.

**Narrate:**
> "The customer gets this invoice by email with a payment link — Paystack settles straight to the merchant's bank or mobile money."

## Scene 3 — The agent knows the business (0:55–1:30)

**Type:** `How is my business doing this week?`
**Action:** stat tiles render (Sales + Invoicing).
> "Ask it anything about the business — it pulls live numbers across sales, invoicing, donations."

**Type:** `What's my history with Efua?`
**Action:** Customer history card renders.
> "It remembers every customer — past orders, invoices, and what they still owe. Memory grounded in real business data, not a chat log."

## Scene 4 — The agent runs the business (1:30–2:10)

**Type:** `Chase my unpaid invoices`
**Action:** unpaid list renders → agent proposes a reminder for Efua → **Approve & run**.
> "It finds who owes you money and chases them — politely, by email, with the pay link. You approve before anything goes out."

**Type (paste the messy list in one message):**
```
add these to my catalog:
Sardine tin, 12
peak milk small - 8.5
Indomie carton 85 (stock 25)
sugar 1kg,18, 40 left
```
**Action:** approval card shows 4 parsed products → **Approve & run** → product cards render.
> "Onboarding is one paste: any messy price list becomes a structured catalog — names, prices, even stock counts — behind one approval."

## Scene 5 — Under the hood (2:10–2:40)

**Screen:** the architecture diagram (docs/architecture.svg, full screen ~8s), then a terminal running `npm run mcp` output / the tools list.

**Narrate:**
> "Under the hood: a Qwen-max function-calling loop on Alibaba Cloud Function Compute, driving the same REST API our dashboard uses — fifteen tools across catalog, invoicing, payments, donations, contacts, and forms. Every action goes through a propose-and-approve gate, and a grounding layer validates every price against the live catalog. The whole toolset is also exposed as an MCP server — Claude Desktop can run this store."

## Scene 6 — Close (2:40–3:00)

**Screen:** back to the dashboard hints screen, or the ImpalaFlow landing page.

**Narrate:**
> "Millions of African micro-merchants run their whole business from a chat thread — this gives them an employee that never sleeps. ImpalaFlow is live today; the Autopilot ships to our merchants right after this hackathon. Built on Qwen, running on Alibaba Cloud."

---

## Recording checklist
- [ ] 3:00–3:20 max final cut (limit is "about 3 minutes")
- [ ] Upload to YouTube as **Public** (not unlisted)
- [ ] Title: "ImpalaFlow Autopilot — AI back-office for African merchants (Qwen Cloud Hackathon, Track 4)"
- [ ] Description: repo link + live demo link + track
