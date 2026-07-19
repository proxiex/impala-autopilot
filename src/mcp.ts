/**
 * MCP server: exposes the ImpalaFlow tool registry over the Model Context
 * Protocol (stdio), so any MCP client — Claude Desktop, IDEs, other agents —
 * can drive the merchant's business tools directly.
 *
 *   npm run mcp     (requires IMPALAFLOW_EMAIL/PASSWORD in .env)
 *
 * Human-in-the-loop note: MCP clients present their own approval prompt for
 * every tool call, so the merchant still confirms actions before they run.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { loadSettings } from "./config";
import { ImpalaFlowClient } from "./impala/client";
import { REGISTRY } from "./impala/tools";
import { TOOLS } from "./agent/toolsSchema";

const settings = loadSettings();
const client = new ImpalaFlowClient(settings);

const server = new Server(
  { name: "impala-autopilot", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map((t) => ({
    name: t.function.name,
    description: t.function.description ?? "",
    inputSchema: (t.function.parameters ?? { type: "object" }) as any,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params.name;
  const args = (req.params.arguments ?? {}) as any;
  const def = REGISTRY[name];
  if (!def) {
    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }
  try {
    let runArgs = args;
    if (def.ground) {
      const grounded = await def.ground(client, runArgs);
      if (!grounded.ok) {
        return {
          content: [{ type: "text", text: grounded.error }],
          isError: true,
        };
      }
      runArgs = grounded.args;
    }
    const result = await def.run(client, runArgs);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  } catch (err: any) {
    return {
      content: [{ type: "text", text: String(err?.message ?? err) }],
      isError: true,
    };
  }
});

await client.login();
await server.connect(new StdioServerTransport());
console.error(
  `impala-autopilot MCP server ready (tenant ${client.tenantId}) — ${TOOLS.length} tools`,
);
