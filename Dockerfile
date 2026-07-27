FROM node:22-bookworm-slim AS frontend-builder

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY frontend/package.json frontend/package.json

RUN npm i -g corepack@latest && corepack enable && corepack prepare pnpm@10.14.0 --activate
RUN pnpm install --frozen-lockfile --prefer-offline

COPY . .

RUN pnpm --dir frontend build


FROM python:3.12-slim AS runtime

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="/opt/venv/bin:/usr/local/bin:${PATH}"

RUN apt-get update \
  && apt-get install -y --no-install-recommends nginx gettext-base ca-certificates nodejs \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend /app/backend
COPY scripts/start-single-service.sh /app/scripts/start-single-service.sh
COPY docker/nginx.single.conf.template /etc/nginx/templates/default.conf.template
COPY frontend /app/frontend

RUN chmod +x /app/scripts/start-single-service.sh

RUN python -m venv "${VIRTUAL_ENV}" \
  && "${VIRTUAL_ENV}/bin/pip" install --upgrade pip \
  && "${VIRTUAL_ENV}/bin/pip" install -e ./backend

COPY --from=frontend-builder /app/frontend/.next/standalone/ /app/frontend/
COPY --from=frontend-builder /app/frontend/.next/static /app/frontend/.next/static

RUN mkdir -p /app/frontend/frontend/.next \
  && cp -R /app/frontend/.next/static /app/frontend/frontend/.next/static

EXPOSE 8080

CMD ["/app/scripts/start-single-service.sh"]
