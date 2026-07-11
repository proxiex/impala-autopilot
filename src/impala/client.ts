/**
 * Thin client for the existing ImpalaFlow REST API.
 *
 * Authenticates exactly like the web app does:
 *   - POST /api/public/login  (form-urlencoded username/password + timezone header)
 *   - POST /api/private/refresh_token  ({refresh_token})  on 401
 * and attaches `Authorization: Bearer <access_token>` to every private call.
 */
import type { Settings } from "../config";

export class ImpalaFlowError extends Error {}

interface RequestOpts {
  params?: Record<string, unknown>;
  json?: unknown;
}

export class ImpalaFlowClient {
  private baseUrl: string;
  private email: string;
  private password: string;
  private timezone: string;

  /** Public-facing app URL, used to build shareable invoice/pay links. */
  appUrl: string;
  accessToken: string | null = null;
  refreshToken: string | null = null;
  tenantId: string | null;
  user: Record<string, any> = {};
  /** The tenant's default invoice currency (e.g. GHS), fetched lazily. */
  defaultCurrency: string | null = null;

  constructor(settings: Settings) {
    this.baseUrl = settings.impalaflowBaseUrl.replace(/\/+$/, "");
    this.appUrl = settings.impalaflowAppUrl.replace(/\/+$/, "");
    this.email = settings.impalaflowEmail;
    this.password = settings.impalaflowPassword;
    this.timezone = settings.impalaflowTimezone;
    this.tenantId = settings.impalaflowTenantId;
  }

  /** Build a client that uses a caller-supplied access token (service mode). */
  static fromToken(
    settings: Settings,
    token: {
      accessToken: string;
      refreshToken?: string | null;
      tenantId?: string | null;
    },
  ): ImpalaFlowClient {
    const client = new ImpalaFlowClient(settings);
    client.accessToken = token.accessToken;
    client.refreshToken = token.refreshToken ?? null;
    if (token.tenantId) client.tenantId = token.tenantId;
    return client;
  }

  // ---- auth ---------------------------------------------------------------
  async login(): Promise<Record<string, any>> {
    if (!this.email || !this.password) {
      throw new ImpalaFlowError(
        "No ImpalaFlow credentials configured (set IMPALAFLOW_EMAIL/PASSWORD), or use token mode.",
      );
    }
    const body = new URLSearchParams({
      username: this.email,
      password: this.password,
    });
    const resp = await fetch(`${this.baseUrl}/api/public/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        timezone: this.timezone,
      },
      body,
    });
    if (!resp.ok) {
      throw new ImpalaFlowError(
        `Login failed (${resp.status}): ${(await resp.text()).slice(0, 300)}`,
      );
    }
    const data: any = await resp.json();
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token ?? null;
    this.tenantId = this.tenantId ?? data.tenant_id ?? null;
    this.user = data;
    return data;
  }

  private async refresh(): Promise<void> {
    if (!this.refreshToken) {
      throw new ImpalaFlowError("No refresh token; cannot refresh session.");
    }
    const resp = await fetch(`${this.baseUrl}/api/private/refresh_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: this.refreshToken }),
    });
    if (!resp.ok) {
      throw new ImpalaFlowError(`Token refresh failed (${resp.status}).`);
    }
    const data: any = await resp.json();
    this.accessToken = data.access_token;
    if (data.refresh_token) this.refreshToken = data.refresh_token;
  }

  // ---- requests -----------------------------------------------------------
  async request(method: string, path: string, opts: RequestOpts = {}): Promise<any> {
    if (!this.accessToken) await this.login();

    const url = new URL(`${this.baseUrl}${path}`);
    if (opts.params) {
      for (const [key, value] of Object.entries(opts.params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const send = () =>
      fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          ...(opts.json !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
        },
        body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
      });

    let resp = await send();
    if (resp.status === 401) {
      await this.refresh();
      resp = await send();
    }
    if (!resp.ok) {
      throw new ImpalaFlowError(
        `${method} ${path} -> ${resp.status}: ${(await resp.text()).slice(0, 300)}`,
      );
    }
    const text = await resp.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  get(path: string, params?: Record<string, unknown>): Promise<any> {
    return this.request("GET", path, { params });
  }

  post(path: string, json?: unknown): Promise<any> {
    return this.request("POST", path, { json });
  }

  /** Fetch and cache the tenant's default invoice currency. */
  async fetchDefaultCurrency(): Promise<string | null> {
    try {
      const settings = await this.get(
        "/api/private/tenants/invoicing/settings/default",
      );
      this.defaultCurrency = settings?.default_currency ?? null;
    } catch {
      this.defaultCurrency = null;
    }
    return this.defaultCurrency;
  }
}
