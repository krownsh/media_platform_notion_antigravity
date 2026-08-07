FROM node:20-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl git jq python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

COPY sandbox/integration/runner.mjs /opt/poc/runner.mjs
COPY server/services/pocIntegrationPlan.js /opt/poc/pocIntegrationPlan.mjs

USER node
WORKDIR /workspace
ENTRYPOINT ["node", "/opt/poc/runner.mjs"]
