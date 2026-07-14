# Submission Sprint — 6 Days to Win Track 4

Deadline: **20 Jul 2026, 10pm GMT+1**. Submit on the **19th**; the 20th is buffer only.

Strategy: judges spend ~5 minutes per project — 3-min video, README skim, maybe the repo.
Make those flawless, hit every technical-depth checkbox, and prove production-readiness
nobody else can fake (live SaaS + real payments).

## Day 1 — Jul 14: Pass/fail gates
- [ ] **Deploy to Alibaba Cloud** (Singapore/intl region): ACR image → Function Compute
      custom container → env vars → HTTP trigger. Acceptance: public `/health` OK + one
      full invoice flow against the deployed URL. Time-box 3h, fallback SAE/ECS.
- [ ] **Public GitHub repo** — license visible in About, topics set, deployment-proof link
      (`src/llm/client.ts`) checked.
- [ ] **Paystack payment collection on the test store** — unlocks a real payment on camera.

## Day 2 — Jul 15: Vision
- [ ] qwen-vl-max photo→product matching (photo + messy text → quote → invoice).
- [ ] Re-seed store with real product images.
- [ ] Photo attach in the dashboard composer.

## Day 3 — Jul 16: Run-the-business features
- [ ] Payment-recovery loop (chase unpaid invoices → drafts reminders → approve → send).
- [ ] Marketing action: draft SMS/email campaign to a group → test-send → approve → send.
- [ ] Stretch: customer memory across sessions.

## Day 4 — Jul 17: Polish + README
- [ ] Retry-on-empty model responses; suppress card noise during approval; clean junk
      invoices; friendly errors.
- [ ] README overhaul: architecture diagram (visual), model-routing table, security section
      (approval gate, token mode, no stored creds), first-try quickstart.
- [ ] Stretch: expose tool registry as an MCP server (judging text names MCP explicitly).

## Day 5 — Jul 18: Video + blog
- [ ] Shot-by-shot script. Hook in first 30s: photo + Pidgin message → approval → **real
      Paystack payment on screen**. Then suite breadth → architecture → impact.
- [ ] Record against the **deployed URL**, upload to YouTube (public).
- [ ] Blog post draft (Blog Post Award, $500).

## Day 6 — Jul 19: Submit early
- [ ] Devpost: Track 4, repo, deployment proof, video, description, blog link.
- [ ] Stranger test: fresh clone, follow README verbatim, fix stumbles.
- [ ] Hosted demo URL + demo login in README/Devpost so judges can try it in 30s.

## The five separators vs 7,884 entries
1. Real money on camera (Paystack settles an agent-created invoice).
2. Judge-tryable hosted demo with credentials — no install.
3. Every technical-depth checkbox: multimodal, model routing, HITL, multi-tenant, memory/MCP.
4. Authentic African multilingual commerce (Pidgin/code-switch) — nobody else has it.
5. A live business, not a toy: ships to real merchants after the hackathon.

## Risks
- FC egress to api.impalaflow.com + intl DashScope → that's why deploy is Day 1.
- WhatsApp cut; dashboard inbox is the demo (Twilio sandbox only if ahead on Day 5).
- Pin qwen-max for demo; add retries. Never demo on the prod tenant.

## Owner split
- **User:** Aliyun console (deploy), GitHub push, Paystack setup, video recording, publishing blog.
- **Agent:** all feature code, seeding, README/diagram, video script, blog + Devpost drafts, stranger test.
