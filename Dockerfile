FROM node:22-slim AS build

WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
RUN npm ci
RUN npm run build

FROM node:22-slim AS runtime

LABEL io.modelcontextprotocol.server.name="io.github.robert19001-cmyk/mcp-lint"

ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY README.md LICENSE ./

USER node
CMD ["node", "dist/mcp-server.js"]
