/** The agent orchestration loop: Qwen function-calling over ImpalaFlow tools. */
import type OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

import { SYSTEM_PROMPT } from "./prompts";
import { TOOLS } from "./toolsSchema";
import type { ImpalaFlowClient } from "../impala/client";
import { REGISTRY } from "../impala/tools";

const MAX_STEPS = 8;

export type EventHook = (
  kind: "tool_call" | "tool_result",
  name: string,
  payload: unknown,
) => void;

/** Called before an approval-gated tool runs. Return true to allow it. */
export type Approver = (request: {
  tool: string;
  args: any;
  preview: string;
}) => Promise<boolean>;

export interface AgentOptions {
  history?: ChatCompletionMessageParam[];
  onEvent?: EventHook;
  approver?: Approver;
  /** Extra situational context appended to the system prompt (e.g. currency). */
  systemContext?: string;
}

export interface ToolInvocation {
  name: string;
  args: unknown;
  result: unknown;
}

export interface AgentResult {
  answer: string;
  messages: ChatCompletionMessageParam[];
  invocations: ToolInvocation[];
}

export async function runAgent(
  llm: OpenAI,
  model: string,
  client: ImpalaFlowClient,
  userMessage: string,
  options: AgentOptions = {},
): Promise<AgentResult> {
  const { history = [], onEvent, approver, systemContext } = options;

  const systemContent = systemContext
    ? `${SYSTEM_PROMPT}\n\n${systemContext}`
    : SYSTEM_PROMPT;

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemContent },
    ...history,
    { role: "user", content: userMessage },
  ];
  const invocations: ToolInvocation[] = [];
  let emptyRetries = 0;

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await llm.chat.completions.create({
      model,
      messages,
      tools: TOOLS,
      tool_choice: "auto",
    });
    const message = response.choices[0]?.message;
    if (!message) break;

    const toolCalls = message.tool_calls;
    // Qwen occasionally returns an entirely empty turn — retry instead of
    // surfacing a blank answer.
    if ((!toolCalls || toolCalls.length === 0) && !message.content?.trim()) {
      if (emptyRetries++ < 2) continue;
    }

    messages.push({
      role: "assistant",
      content: message.content ?? "",
      ...(toolCalls ? { tool_calls: toolCalls } : {}),
    });

    if (!toolCalls || toolCalls.length === 0) {
      return { answer: message.content ?? "", messages, invocations };
    }

    for (const tc of toolCalls) {
      if (tc.type !== "function") continue;
      const name = tc.function.name;
      let args: any = {};
      try {
        args = JSON.parse(tc.function.arguments || "{}");
      } catch {
        args = {};
      }
      onEvent?.("tool_call", name, args);

      const result = await executeTool(client, name, args, approver);
      onEvent?.("tool_result", name, result);
      invocations.push({ name, args, result });

      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        // The UI renders media from `invocations`; the model never sees image
        // URLs, so it can never paste them into a reply.
        content: JSON.stringify(sanitizeForModel(result)),
      });
    }
  }

  return {
    answer: "(stopped: reached the step limit without a final answer)",
    messages,
    invocations,
  };
}

/** Strip media fields from tool results before they reach the model. */
function sanitizeForModel(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sanitizeForModel);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) {
      if (k === "image_url" || k === "gallery_images" || k === "cover_image_url") continue;
      out[k] = sanitizeForModel(val);
    }
    return out;
  }
  return v;
}

async function executeTool(
  client: ImpalaFlowClient,
  name: string,
  args: any,
  approver?: Approver,
): Promise<unknown> {
  const def = REGISTRY[name];
  if (!def) return { error: `unknown tool: ${name}` };

  // Ground BEFORE the approval preview: the merchant must approve validated
  // data, and hallucinated inputs bounce back to the model as tool errors.
  if (def.ground) {
    try {
      const grounded = await def.ground(client, args);
      if (!grounded.ok) return { error: grounded.error };
      args = grounded.args;
    } catch (err: any) {
      return { error: String(err?.message ?? err) };
    }
  }

  if (def.requiresApproval) {
    const preview = def.preview ? def.preview(args) : JSON.stringify(args);
    const approved = approver
      ? await approver({ tool: name, args, preview })
      : false; // default-deny: never take an action without an approver
    if (!approved) {
      return {
        executed: false,
        awaiting_approval: true,
        note: "Not run — this action needs the merchant's approval first.",
      };
    }
  }

  try {
    return await def.run(client, args);
  } catch (err: any) {
    return { error: String(err?.message ?? err) };
  }
}
