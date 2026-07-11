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
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

import { loadSettings } from "./config";
import { makeLlm } from "./llm/client";
import { ImpalaFlowClient } from "./impala/client";
import { runAgent, type Approver } from "./agent/loop";
import { REGISTRY } from "./impala/tools";

const settings = loadSettings();
const llm = makeLlm(settings);

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

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

interface ChatBody {
  message?: string;
  history?: ChatCompletionMessageParam[];
}

app.post("/agent/chat", async (req, reply) => {
  const { message, history } = (req.body ?? {}) as ChatBody;
  if (!message) return reply.code(400).send({ error: "message is required" });

  const client = ImpalaFlowClient.fromToken(settings, {
    accessToken: tokenFrom(req),
  });
  const currency = await client.fetchDefaultCurrency();
  const systemContext = currency
    ? `Store context: the merchant's default currency is ${currency}. Use it for invoices unless the customer explicitly names another currency.`
    : undefined;

  // Propose mode: capture the first gated action instead of executing it.
  let proposal: { tool: string; args: unknown; preview: string } | null = null;
  const approver: Approver = async ({ tool, args, preview }) => {
    proposal = { tool, args, preview };
    return false;
  };

  const { answer } = await runAgent(llm, settings.agentModel, client, message, {
    history: history ?? [],
    systemContext,
    approver,
  });

  return { answer, proposal };
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
