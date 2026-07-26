FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip python3-venv nginx gettext-base build-essential \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY frontend/package.json frontend/package.json
COPY backend/pyproject.toml backend/pyproject.toml

RUN npm i -g corepack@latest && corepack enable && corepack prepare pnpm@10.14.0 --activate
RUN pnpm install --frozen-lockfile --prefer-offline

COPY . .

RUN python3 -m pip install -e ./backend
RUN pnpm --dir frontend build

COPY docker/nginx.single.conf.template /etc/nginx/templates/default.conf.template
COPY scripts/start-single-service.sh /app/scripts/start-single-service.sh
RUN chmod +x /app/scripts/start-single-service.sh

EXPOSE 8080

CMD ["/app/scripts/start-single-service.sh"]
