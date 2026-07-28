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



Here's a **master prompt** you can give to Codex to build a **professional desktop application using only Python built-in packages (pure Tkinter)**.

---

# Build a Modern Enterprise Desktop UI Using Pure Tkinter

Build a **professional enterprise desktop application** named **Schema Studio – API Schema Intelligence**.

## Technology Restrictions (VERY IMPORTANT)

Use **ONLY Python built-in libraries**.

Allowed:

* tkinter
* tkinter.ttk
* tkinter.font
* tkinter.messagebox
* tkinter.filedialog
* tkinter.scrolledtext
* tkinter.colorchooser
* threading
* queue
* json
* pathlib
* sqlite3
* datetime
* os
* sys
* time

DO NOT USE

* CustomTkinter
* ttkbootstrap
* Pillow (PIL)
* OpenCV
* PyQt
* PySide
* Kivy
* wxPython
* Any pip package
* Any external dependency

The application must run on a fresh Python installation.

---

# UI Goal

Make the UI look like a modern enterprise desktop application.

Think of

* Visual Studio
* Azure Data Studio
* Azure Portal
* JetBrains IDE
* Microsoft Power BI Desktop
* Databricks Desktop
* Microsoft Office

Do NOT make it look like a typical old Tkinter application.

---

# Window

Size

1920×1080

Resizable

Minimum

1400×850

Centered

Native Windows title bar

---

# Theme

Professional White

Background

#F6F8FC

Cards

White

Borders

#E5E7EB

Primary

#2563EB

Hover

#1D4ED8

Text

#111827

Secondary

#6B7280

Rounded looking controls using Canvas where necessary.

---

# Sidebar

Fixed width

280 px

Contains

Logo

Overview

Discover & Scan

• API Connections

• Live Scanner

• Scan History

• Schema Explorer

Analyze

• Schema Compare

• Version History

• Field Intelligence

Generate

• SQL Generator

• XQuery Generator

Manage

• Exports

• Notifications

• Settings

Sign Out

Use ttk buttons styled professionally.

Hover effects.

Selected item blue.

No scrolling.

Always visible.

---

# Top Bar

Contains

Page Title

Subtitle

Search box

Notification icon

User avatar

User name

Role

Primary blue button

"Add API Connection"

Professional spacing.

---

# Dashboard

Top KPI cards

Connected APIs

Running Scans

Columns

Schema Versions

Schema Changes

Generated SQL

Each card

White

Shadow simulation

Large number

Subtitle

Icon

Hover effect

---

# Main Content

Live Scanner

Treeview

Progress bars

Status badges

Buttons

Recent Activity

Scrollable list

Schema Changes

Canvas chart

Top Schema Changes

Treeview

Everything aligned perfectly.

---

# Fonts

Segoe UI

Headers

18-22

Cards

13-15

Body

11

Small

10

Bold only where necessary.

---

# Layout Rules

No widget overlaps.

No clipping.

No horizontal scrolling.

No vertical scrolling.

Entire dashboard must fit on a 1920×1080 screen.

Proper margins.

Consistent spacing.

Professional alignment.

---

# Performance

Create UI instantly.

Do NOT freeze.

Lazy load heavy pages.

Reuse widgets.

Do NOT recreate entire screens.

Switch pages in under 100 ms.

---

# Architecture

Use classes.

Example

App

Sidebar

Header

DashboardPage

APIConnectionsPage

SchemaExplorerPage

SchemaComparePage

SQLGeneratorPage

SettingsPage

Use Frame swapping.

Keep every page independent.

---

# Styling

Create one centralized style manager.

Do NOT hardcode colors everywhere.

Keep constants.

Reusable widgets.

---

# Canvas

Use Canvas to simulate

Cards

Rounded panels

Charts

Progress

Badges

Modern UI effects

---

# Treeview

Professional headers.

Alternating row colors.

Hover highlight.

Sortable columns.

Column resizing.

---

# Responsiveness

Resize correctly.

Maintain proportions.

No broken layouts.

No blank areas.

No clipping.

---

# Code Quality

PEP-8.

Type hints.

Docstrings.

Modular.

Maintainable.

No duplicated code.

---

# Final Goal

The finished application should make people think:

> **"I can't believe this was built using only the Python standard library."**

The UI should feel polished, enterprise-grade, responsive, and production-ready while using **100% pure Tkinter and built-in Python libraries only**.



