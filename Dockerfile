FROM node:22-slim

WORKDIR /app

# Install deps (tsx is used to run the TS service directly)
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY public ./public

ENV PORT=8787
EXPOSE 8787

# Runtime env (provide via Alibaba Cloud FC/ECS/SAE config, never bake secrets):
#   DASHSCOPE_API_KEY, DASHSCOPE_BASE_URL, IMPALAFLOW_BASE_URL, IMPALAFLOW_APP_URL, AGENT_MODEL
CMD ["npm", "run", "serve"]
