/**
 * Interactive CLI to test the Autopilot agent against a live ImpalaFlow tenant.
 *
 *   npm run chat                                  # interactive chat
 *   npm run chat -- "how much stock of rice?"     # single turn
 *
 * When the agent proposes an action (e.g. create an invoice) you'll be asked to
 * approve it before it runs — this is the human-in-the-loop gate.
 */
import { createInterface, type Interface } from "node:readline/promises";
import { argv, exit, stdin, stdout } from "node:process";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

import { loadSettings } from "./config";
import { makeLlm } from "./llm/client";
import { ImpalaFlowClient } from "./impala/client";
import { runAgent, type Approver, type EventHook } from "./agent/loop";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const magenta = (s: string) => `\x1b[35m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

const onEvent: EventHook = (kind, name, payload) => {
  if (kind === "tool_call") {
    console.log(dim(`→ ${name}(${JSON.stringify(payload)})`));
  } else {
    let preview = JSON.stringify(payload);
    if (preview.length > 1500) preview = preview.slice(0, 1500) + "…";
    console.log(dim(`  ↳ ${preview}`));
  }
};

function makeApprover(rl: Interface): Approver {
  return async ({ preview }) => {
    console.log(`\n${yellow("⚠ approval needed")}\n${yellow(preview)}`);
    try {
      const answer = (await rl.question(bold("Approve & run? [y/N] "))).trim();
      return answer.toLowerCase().startsWith("y");
    } catch {
      return false; // stdin closed / non-interactive → treat as not approved
    }
  };
}

/** Non-interactive approver for scripted runs (AUTOPILOT_AUTO_APPROVE=1 / --yes). */
const autoApprover: Approver = async ({ preview }) => {
  console.log(`\n${yellow("⚠ approval needed (auto-approved)")}\n${yellow(preview)}`);
  return true;
};

async function main(): Promise<void> {
  const settings = loadSettings();
  const llm = makeLlm(settings);
  const client = new ImpalaFlowClient(settings);

  console.log(`${bold("ImpalaFlow Autopilot")} — logging in…`);
  try {
    await client.login();
  } catch (err: any) {
    console.error(`Login failed: ${err?.message ?? err}`);
    exit(1);
  }
  console.log(
    `Logged in as ${green(client.user.email ?? "?")} ` +
      `(tenant ${client.tenantId}) · model ${magenta(settings.agentModel)}\n`,
  );

  const rawArgs = argv.slice(2);
  const flags = new Set(rawArgs.filter((a) => a.startsWith("--")));
  const words = rawArgs.filter((a) => !a.startsWith("--"));
  const autoApprove =
    process.env.AUTOPILOT_AUTO_APPROVE === "1" || flags.has("--yes");

  const rl = createInterface({ input: stdin, output: stdout });
  const approver: Approver = autoApprove ? autoApprover : makeApprover(rl);

  try {
    // single-shot mode
    const single = words.join(" ").trim();
    if (single) {
      const { answer } = await runAgent(llm, settings.agentModel, client, single, {
        onEvent,
        approver,
      });
      console.log(`\n${magenta("autopilot ›")} ${answer}`);
      return;
    }

    // interactive mode
    const history: ChatCompletionMessageParam[] = [];
    console.log(dim("Type your message. 'exit' or Ctrl-C to quit.\n"));
    while (true) {
      const message = (await rl.question(bold("you › "))).trim();
      if (!message) continue;
      if (["exit", "quit"].includes(message.toLowerCase())) break;
      const { answer } = await runAgent(llm, settings.agentModel, client, message, {
        history,
        onEvent,
        approver,
      });
      console.log(`\n${magenta("autopilot ›")} ${answer}\n`);
      history.push({ role: "user", content: message });
      history.push({ role: "assistant", content: answer });
    }
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(err);
  exit(1);
});
