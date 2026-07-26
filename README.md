# Schema Studio

Schema Studio is a production-oriented API Schema Intelligence Platform for scanning large REST datasets, discovering full schemas, tracking schema evolution, and generating SQL and Informatica IICS XQuery artifacts.

## Local Development

Local development is intentionally one-command.

```bash
git clone <repo-url>
cd schema_intalligence
chmod +x *.sh
./run.sh
```

`./run.sh` will:

- verify `python3`, `node`, `corepack`, and `curl`
- create `backend/.venv` if missing
- install backend dependencies when `backend/pyproject.toml` changes
- install frontend dependencies when `pnpm-lock.yaml` changes
- create `backend/.env` and `frontend/.env.local` from examples if missing
- refuse startup if required Supabase variables are missing
- run Alembic migrations automatically against Supabase
- prepare `logs/`, `uploads/`, `exports/`, and `generated/` runtime directories
- start FastAPI and Next.js
- open the browser automatically
- stop both services cleanly with `CTRL+C`

## Required Backend Environment

Schema Studio supports only Supabase PostgreSQL for local and production use.

`backend/.env` must provide:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
DATABASE_URL=
DIRECT_DATABASE_URL=
```

If any required value is missing, startup fails immediately.

## Operational Scripts

- `./run.sh` starts the full stack
- `./stop.sh` stops tracked frontend and backend processes
- `./restart.sh` restarts the full stack
- `./health.sh` checks environment variables, frontend availability, backend availability, and Supabase reachability through the backend health endpoint
- `./clean.sh` removes caches, `node_modules`, build artifacts, and temporary files without touching Supabase

## Architecture

### Frontend

- `frontend/app/` Next.js App Router entrypoints
- `frontend/components/` reusable UI modules
- `frontend/lib/` shared browser utilities

### Backend

- `backend/app/api/` HTTP routes and transport models
- `backend/app/services/` runtime orchestration and business services
- `backend/app/repositories/` data access layer
- `backend/app/core/` configuration, logging, and startup bootstrap
- `backend/alembic/` Supabase migrations

### Generated Runtime Directories

- `logs/` application log output
- `generated/` runtime scan cache and generated assets
- `exports/` exported artifacts
- `uploads/` imported files

## Verification

The repository is validated with:

```bash
COREPACK_HOME=/private/tmp/corepack corepack pnpm --dir frontend typecheck
COREPACK_HOME=/private/tmp/corepack corepack pnpm --dir frontend build
python3 -m compileall backend/app backend/tests
backend/.venv/bin/pytest backend/tests
```

## Notes

- Docker files remain optional for deployment only.
- Local development never requires Docker Desktop, docker-compose, SQLite, or local PostgreSQL.
- Supabase migrations are the only supported database lifecycle path.
