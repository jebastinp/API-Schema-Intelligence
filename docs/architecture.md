# Architecture

Schema Studio uses a split frontend/backend monorepo with clean architecture boundaries and toolchain-first setup.

## Frontend

- Next.js 15 App Router
- TypeScript and Tailwind CSS
- shadcn-compatible UI primitives
- architecture-only pages and shared shell components

## Backend

- FastAPI transport layer
- Pydantic settings
- structured logging
- clean package separation for `api`, `application`, `domain`, and `infrastructure`

## Phase 1 Constraints

- no business logic
- no domain workflows
- no database models or migrations with product behavior
- only project foundation, startup, health, and tooling

## Future Implementation Flow

1. add connection management use cases
2. add scanner orchestration
3. add schema discovery and comparison
4. add artifact generation and exports
