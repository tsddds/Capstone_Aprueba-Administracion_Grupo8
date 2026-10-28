FROM node:22-bookworm-slim
WORKDIR /app
COPY bridge.mjs workload.mjs ./
USER node
CMD ["node","workload.mjs"]
