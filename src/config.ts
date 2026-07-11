import "dotenv/config";

export interface Settings {
  // Qwen / DashScope
  dashscopeApiKey: string;
  dashscopeBaseUrl: string;
  agentModel: string;
  fastModel: string;
  visionModel: string;
  // ImpalaFlow
  impalaflowBaseUrl: string;
  impalaflowAppUrl: string;
  impalaflowEmail: string;
  impalaflowPassword: string;
  impalaflowTenantId: string | null;
  impalaflowTimezone: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

export function loadSettings(): Settings {
  return {
    dashscopeApiKey: required("DASHSCOPE_API_KEY"),
    dashscopeBaseUrl:
      process.env.DASHSCOPE_BASE_URL ??
      "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    agentModel: process.env.AGENT_MODEL ?? "qwen-plus",
    fastModel: process.env.FAST_MODEL ?? "qwen-turbo",
    visionModel: process.env.VISION_MODEL ?? "qwen-vl-max",
    impalaflowBaseUrl:
      process.env.IMPALAFLOW_BASE_URL ?? "https://api.impalaflow.com",
    impalaflowAppUrl:
      process.env.IMPALAFLOW_APP_URL ?? "https://impalaflow.com",
    impalaflowEmail: required("IMPALAFLOW_EMAIL"),
    impalaflowPassword: required("IMPALAFLOW_PASSWORD"),
    impalaflowTenantId: process.env.IMPALAFLOW_TENANT_ID || null,
    impalaflowTimezone: process.env.IMPALAFLOW_TIMEZONE ?? "Africa/Lagos",
  };
}
