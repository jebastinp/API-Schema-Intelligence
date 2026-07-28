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





That’s fair. Here’s a complete functional requirements document you can give Claude. It summarizes everything you’ve asked for over the course of this project.

⸻

SuccessFactors Schema Studio - Requirements

Goal

Build an enterprise desktop/web application called Schema Studio for SuccessFactors Workforce API that can:

1. Scan live APIs
2. Discover complete schemas
3. Generate SQL
4. Generate Informatica IICS XQuery
5. Compare schemas
6. Export reports

No third-party Python libraries.

Use only Python standard library.

⸻

Technology

* Python 3.11+
* urllib
* json
* sqlite3
* csv
* xml.etree.ElementTree
* pathlib
* os
* re
* threading/concurrent.futures
* tkinter (if desktop)
* FastAPI/React only if explicitly choosing a web version (otherwise Python only)

No requests package.

⸻

Authentication

OAuth Client Credentials

Needs

* Token URL
* Client ID
* Client Secret
* Proxy support
* Automatic token refresh

⸻

Live Scanner Agent

Connect to

GET /employee/v1

Supports

count=1000
cursor=xxxxx

Workflow

Get Token
↓
GET First Page
↓
Scan every employee
↓
Get nextCursor
↓
GET next page
↓
Repeat
↓
Stop when nextCursor is empty

Must support scanning 1+ million employees.

⸻

API Response

{
   "updateSequence":[
      {...},
      {...}
   ],
   "nextCursor":"xxxxx"
}

Never assume first employee contains all columns.

Every employee must be scanned.

⸻

Recursive Scanner

Recursively scan

* dictionaries
* arrays
* nested arrays
* nested objects

Example

name.firstName
effectiveDatedInfo.homeAddress.city
jobs.effectiveDatedJobInfo.department
jobs.effectiveDatedJobInfo.customFields.C_GRADE_CODE

⸻

Naming Engine

Ignore wrapper nodes

updateSequence
results
item
items
payload
response
records
root
data

Rules

Unique leaf

employeeId

Duplicate leaf

homeAddress.city
businessAddress.city

SQL

homeaddress_city

⸻

Schema Storage

Maintain

master_schema.json
column_mapping.csv
checkpoint.json
history/

⸻

Resume

If scan stops

Save

cursor
page
record count

Next execution resumes from cursor.

⸻

Progress

Display

Page
Employees
Columns
Elapsed Time
New Columns Found

⸻

SQL Generator Agent

Generate

CREATE TABLE employee
(
...
)

Rules

Map

String -> VARCHAR
Integer -> INTEGER
Boolean -> BOOLEAN
Date -> DATE
Datetime -> TIMESTAMP
Decimal -> DECIMAL

Generate PK if available.

⸻

XQuery Generator Agent

Generate Informatica IICS XQuery

Input

master_schema.json

Output

<Employee>
<EmployeeID>
{$i/employeeId/text()}
</EmployeeID>
...
</Employee>

Use complete XPath.

Never use shortened XPath.

⸻

Compare Agent

Input

API Schema
XQuery

Output

Matched
Missing
Extra
Percentage

Generate

compare_report.csv

⸻

Export Agent

Generate

master_schema.json
master_schema.csv
column_mapping.csv
create_table.sql
employee.xquery
compare_report.csv
summary.txt

⸻

Version History

Every scan

Create

history/schema_YYYYMMDD_HHMMSS.json

Compare previous versions.

Report

Added Columns
Removed Columns

⸻

UI

VS Code style.

Dark theme.

Modules

Dashboard
Live Scanner
Schema Explorer
SQL Generator
XQuery Generator
Compare
Reports
History
Settings

⸻

Dashboard

Cards

Total APIs
Columns
Tables
XQueries
Reports
Last Scan
Duration

⸻

Schema Explorer

Tree view

Employee
Name
Address
Jobs
CustomFields

Search

Filter

Expand

Collapse

⸻

SQL Generator UI

Buttons

Generate
Preview
Copy
Save

⸻

XQuery Generator UI

Buttons

Generate
Preview
Copy
Download

⸻

Compare UI

Show

Matched
Missing
Extra

Highlight colors

Green
Yellow
Red

⸻

Reports

Export

CSV
JSON
SQL
XML
TXT

⸻

Performance

Must support

* 1,000,000+ records
* Incremental scanning
* Low memory usage
* Cursor pagination
* Resume after interruption
* Recursive schema discovery
* Duplicate detection
* Unique naming
* Progress logging

⸻

Code Structure

schema_studio/
main.py
config.py
agents/
    auth_agent.py
    live_scanner_agent.py
    sql_generator_agent.py
    xquery_generator_agent.py
    compare_agent.py
    export_agent.py
storage/
    schema.db
output/
history/
reports/

⸻

Architecture

Auth Agent
        │
        ▼
Live Scanner Agent
        │
        ▼
Naming Engine
        │
 ┌──────┴────────┐
 ▼               ▼
SQL Agent     XQuery Agent
        │
        ▼
Compare Agent
        │
        ▼
Export Agent

This captures the requirements you’ve described: cursor-based scanning of every employee across all pages, recursive schema discovery, naming rules, SQL/XQuery generation, comparison, reporting, and resume support. It should give Claude a solid specification to work from.


