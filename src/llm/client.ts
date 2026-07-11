/**
 * Qwen access via the DashScope OpenAI-compatible endpoint.
 *
 * This is the project's proof of Alibaba Cloud usage: every model call goes to
 * Alibaba Cloud Model Studio (DashScope). We use the OpenAI SDK in
 * compatibility mode because it gives us first-class function-calling with
 * minimal code.
 */
import OpenAI from "openai";
import type { Settings } from "../config";

export function makeLlm(settings: Settings): OpenAI {
  return new OpenAI({
    apiKey: settings.dashscopeApiKey,
    baseURL: settings.dashscopeBaseUrl,
  });
}
