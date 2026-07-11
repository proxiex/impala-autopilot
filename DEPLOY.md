# Deploying on Alibaba Cloud

The Autopilot service runs as a container. Models are called via **Alibaba Cloud
Model Studio (DashScope)** — see [`src/llm/client.ts`](src/llm/client.ts) — and the
service itself is deployed on Alibaba Cloud, satisfying the "backend on Alibaba Cloud"
requirement.

## 1. Build & push the image to Alibaba Container Registry (ACR)

```bash
# Log in to ACR (create a namespace/repo in the ACR console first)
docker login --username=<aliyun-account> registry.<region>.aliyuncs.com

docker build -t registry.<region>.aliyuncs.com/<namespace>/impala-autopilot:latest .
docker push registry.<region>.aliyuncs.com/<namespace>/impala-autopilot:latest
```

## 2. Deploy (pick one)

**Function Compute (recommended — serverless containers)**
- Create a service + function with the *Custom Container* runtime.
- Image: the ACR image above. Listen port: `8787`. Enable an HTTP trigger.

**Serverless App Engine (SAE) or ECS** also work — run the same image, expose `8787`.

## 3. Runtime environment variables (set in the FC/SAE/ECS console — never bake secrets)

| Var | Value |
|-----|-------|
| `DASHSCOPE_API_KEY` | your Model Studio API key |
| `DASHSCOPE_BASE_URL` | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` (intl) |
| `IMPALAFLOW_BASE_URL` | `https://api.impalaflow.com` |
| `IMPALAFLOW_APP_URL` | `https://impalaflow.com` |
| `AGENT_MODEL` | `qwen-plus` (or `qwen-max` for the demo) |

`IMPALAFLOW_EMAIL`/`IMPALAFLOW_PASSWORD` are **not** needed here — the service runs in
token mode, using each request's merchant token.

## 4. Verify

```bash
curl https://<your-fc-endpoint>/health
# -> {"ok":true,"model":"qwen-plus"}
```

## API

- `POST /agent/chat` — headers: `Authorization: Bearer <merchant ImpalaFlow token>`;
  body: `{ "message": "...", "history": [...] }`. Returns `{ answer, proposal }`.
  A `proposal` (e.g. an invoice) is **not** executed — the merchant approves it next.
- `POST /agent/approve` — same auth; body: `{ "proposal": { "tool": "...", "args": {...} } }`.
  Executes the approved action and returns `{ result }`.
