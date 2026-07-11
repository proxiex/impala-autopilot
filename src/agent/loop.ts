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

export interface AgentResult {
  answer: string;
  messages: ChatCompletionMessageParam[];
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

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await llm.chat.completions.create({
      model,
      messages,
      tools: TOOLS,
      tool_choice: "auto",
    });
    const message = response.choices[0]?.message;
    if (!message) break;

    messages.push({
      role: "assistant",
      content: message.content ?? "",
      ...(message.tool_calls ? { tool_calls: message.tool_calls } : {}),
    });

    const toolCalls = message.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      return { answer: message.content ?? "", messages };
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

      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }
  }

  return {
    answer: "(stopped: reached the step limit without a final answer)",
    messages,
  };
}

async function executeTool(
  client: ImpalaFlowClient,
  name: string,
  args: any,
  approver?: Approver,
): Promise<unknown> {
  const def = REGISTRY[name];
  if (!def) return { error: `unknown tool: ${name}` };

  if (def.requiresApproval) {
    const preview = def.preview ? def.preview(args) : JSON.stringify(args);
    const approved = approver
      ? await approver({ tool: name, args, preview })
      : false; // default-deny: never take an action without an approver
    if (!approved) {
      return {
        declined: true,
        reason: "The merchant did not approve this action.",
      };
    }
  }

  try {
    return await def.run(client, args);
  } catch (err: any) {
    return { error: String(err?.message ?? err) };
  }
}
