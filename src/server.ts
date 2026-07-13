/**
 * HTTP service wrapping the Autopilot agent.
 *
 * Multi-tenant: each request carries the merchant's own ImpalaFlow bearer token
 * (the dashboard already has it), and the agent acts as that merchant.
 *
 * Because HTTP approval is a round-trip (not a terminal prompt), actions use a
 * propose → approve flow:
 *   POST /agent/chat     -> agent runs; a gated action comes back as `proposal`
 *                           (NOT executed). Read-only lookups run normally.
 *   POST /agent/approve  -> execute a proposed action with the merchant's token.
 *
 * Deployed on Alibaba Cloud; models are called via Alibaba Cloud DashScope
 * (see src/llm/client.ts).
 */
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

import { loadSettings } from "./config";
import { makeLlm } from "./llm/client";
import { ImpalaFlowClient } from "./impala/client";
import { runAgent, type Approver } from "./agent/loop";
import { toBlocks } from "./agent/blocks";
import { REGISTRY } from "./impala/tools";

const settings = loadSettings();
const llm = makeLlm(settings);

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

// Serve the mini-dashboard (public/index.html) at /
const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
await app.register(fastifyStatic, { root: publicDir, prefix: "/" });

function tokenFrom(req: { headers: Record<string, unknown> }): string {
  const auth = req.headers["authorization"];
  const token =
    typeof auth === "string" && auth.startsWith("Bearer ")
      ? auth.slice(7)
      : null;
  if (!token) {
    const err = new Error("Missing 'Authorization: Bearer <token>' header");
    (err as any).statusCode = 401;
    throw err;
  }
  return token;
}

app.get("/health", async () => ({ ok: true, model: settings.agentModel }));

interface LoginBody {
  email?: string;
  password?: string;
}

// Login proxy so the browser UI can authenticate without CORS to the API.
app.post("/auth/login", async (req, reply) => {
  const { email, password } = (req.body ?? {}) as LoginBody;
  if (!email || !password) {
    return reply.code(400).send({ error: "email and password are required" });
  }
  try {
    const data = await ImpalaFlowClient.authenticate(settings, email, password);
    return {
      access_token: data.access_token,
      tenant_id: data.tenant_id,
      email: data.email,
      first_name: data.first_name,
      company_name: data.company_name,
    };
  } catch {
    return reply.code(401).send({ error: "Login failed. Check your email and password." });
  }
});

interface ChatBody {
  message?: string;
  history?: ChatCompletionMessageParam[];
  channel?: string;
}

app.post("/agent/chat", async (req, reply) => {
  const { message, history, channel } = (req.body ?? {}) as ChatBody;
  if (!message) return reply.code(400).send({ error: "message is required" });
  const dashboard = channel === "dashboard";

  const client = ImpalaFlowClient.fromToken(settings, {
    accessToken: tokenFrom(req),
  });
  const currency = await client.fetchDefaultCurrency();

  const parts: string[] = [];
  if (currency) {
    parts.push(
      `Store context: the merchant's default currency is ${currency}. Use it for invoices unless the customer explicitly names another currency.`,
    );
  }
  if (dashboard) {
    parts.push(
      'This is the dashboard channel: the UI shows products, stats, contacts, campaigns, and forms as rich cards below your reply. So reply with ONE short sentence only (e.g. "Here\'s your catalog." or "Here\'s how this week looks.") and NEVER enumerate items, prices, counts, or figures in your text — the cards already show them.',
    );
  }
  const systemContext = parts.length ? parts.join(" ") : undefined;

  // Propose mode: capture the first gated action instead of executing it.
  let proposal: { tool: string; args: unknown; preview: string } | null = null;
  const approver: Approver = async ({ tool, args, preview }) => {
    proposal = { tool, args, preview };
    return false;
  };

  const { answer, invocations } = await runAgent(
    llm,
    settings.agentModel,
    client,
    message,
    { history: history ?? [], systemContext, approver },
  );

  return {
    answer,
    proposal,
    blocks: dashboard ? toBlocks(invocations, currency) : [],
  };
});

interface ApproveBody {
  tool?: string;
  args?: unknown;
  proposal?: { tool: string; args: unknown };
}

app.post("/agent/approve", async (req, reply) => {
  const body = (req.body ?? {}) as ApproveBody;
  const tool = body.proposal?.tool ?? body.tool;
  const args = body.proposal?.args ?? body.args ?? {};
  if (!tool) return reply.code(400).send({ error: "tool is required" });

  const def = REGISTRY[tool];
  if (!def) return reply.code(400).send({ error: `unknown tool: ${tool}` });

  const client = ImpalaFlowClient.fromToken(settings, {
    accessToken: tokenFrom(req),
  });
  try {
    const result = await def.run(client, args);
    return { result };
  } catch (err: any) {
    return reply.code(502).send({ error: String(err?.message ?? err) });
  }
});

const port = Number(process.env.PORT ?? 8787);
await app.listen({ port, host: "0.0.0.0" });
app.log.info(`Autopilot service listening on :${port}`);
