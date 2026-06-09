FROM node:20-alpine
RUN npm install -g pnpm@9
WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY apps/scraper/package.json ./apps/scraper/
COPY packages/types/package.json ./packages/types/
COPY packages/scrapers/package.json ./packages/scrapers/
RUN pnpm install --frozen-lockfile

COPY . .
CMD ["pnpm", "--filter", "@voilierscope/scraper", "dev"]
