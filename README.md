# Nova MFI – Mifos System Doctor MCP Server

A fully independent, deployable **Model Context Protocol (MCP) server** built for Nova Microfinance Uganda's Helaplus / Mifos X platform. Provides 50+ tools for audit, repair, notifications, GL posting, reporting, and complete Fineract administration — all accessible from any MCP-compatible AI client (Claude Desktop, Cursor, etc.) and from the bundled Next.js control dashboard.

---

## Contents

```
Mifos-MCP-Server/
├── src/
│   ├── index.ts                    # MCP server – 50+ tools over stdio
│   ├── types/index.ts              # Shared TypeScript types
│   ├── utils/
│   │   ├── fineract-client.ts      # Fineract REST client (paginated)
│   │   └── formatter.ts            # Table + date helpers
│   ├── tools/
│   │   ├── deposit-breakdown.ts    # Deposit fee calculator + GL posting
│   │   ├── notification-engine.ts  # Africa's Talking SMS/WhatsApp + Twilio
│   │   ├── action-queue.ts         # Officer action queue + bulk notify
│   │   ├── customer-journey.ts     # Full loan lifecycle reconstruction
│   │   ├── fineract-admin.ts       # Full CRUD for all Fineract entities
│   │   ├── portfolio-snapshot.ts   # PAR, aging, collection efficiency
│   │   ├── audit-gl-mapping.ts     # GL mapping audit
│   │   ├── validate-topup.ts       # Top-up loan validator
│   │   └── issue-tracker.ts        # Issues register tracker
│   ├── webhook-server/
│   │   └── index.ts               # Express webhook receiver + REST API bridge
│   └── config/
│       ├── product-fee-schedules.json   # Fee schedules: HAOJUE, SIMBA BOSS, SIMBA RAPTOR, TVS, HONDA
│       └── issues-register.json         # 17 tracked system issues
├── dashboard/                      # Next.js 14 control panel
│   ├── app/
│   │   ├── page.tsx                # Portfolio overview + KPIs
│   │   ├── deposit-calculator/     # Deposit breakdown UI + GL post
│   │   ├── notifications/          # Manual/bulk SMS+WhatsApp
│   │   ├── workflow/               # Officer action queue
│   │   ├── reports/                # Report runner (CSV export)
│   │   ├── issues/                 # Issue tracker
│   │   ├── admin/                  # Fineract entity management
│   │   └── api/                    # Next.js API routes (breakdown, post-gl)
│   └── ...
├── Dockerfile                      # MCP + webhook server image
├── docker-compose.yml              # 3-service stack
├── .env.example                    # All environment variables documented
└── package.json
```

---

## Quick Start

### 1. Clone and configure

```bash
git clone https://github.com/Chrl3y/Mifos-MCP-Server.git
cd Mifos-MCP-Server
cp .env.example .env
# Edit .env with your Fineract URL, tenant, and Africa's Talking credentials
```

### 2. Install and build

```bash
npm install
npm run build
```

### 3. Run with Docker Compose (recommended)

```bash
docker-compose up -d
```

Services started:
| Service | Port | Description |
|---|---|---|
| `mifos-system-doctor` | stdio | MCP server (connect from Claude Desktop) |
| `mifos-webhook-server` | 4000 | Fineract event receiver + REST API bridge |
| `mifos-dashboard` | 3001 | Next.js control panel |

Open the dashboard: **http://localhost:3001**

### 4. Connect to Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "nova-mfis": {
      "command": "node",
      "args": ["/path/to/Mifos-MCP-Server/dist/index.js"],
      "env": {
        "FINERACT_BASE_URL": "https://your-helaplus.com/fineract-provider/api/v1",
        "FINERACT_TENANT_ID": "default",
        "FINERACT_USERNAME": "mifos",
        "FINERACT_PASSWORD": "your-password",
        "AT_API_KEY": "your-africas-talking-api-key",
        "AT_USERNAME": "your-at-username",
        "AT_SENDER_ID": "NovaLoan"
      }
    }
  }
}
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `FINERACT_BASE_URL` | Yes | Base URL e.g. `https://helaplus.novamfi.co.ug/fineract-provider/api/v1` |
| `FINERACT_TENANT_ID` | Yes | Tenant ID (usually `default`) |
| `FINERACT_USERNAME` | Yes | Mifos admin username |
| `FINERACT_PASSWORD` | Yes | Mifos admin password |
| `AT_API_KEY` | Yes* | Africa's Talking API key |
| `AT_USERNAME` | Yes* | Africa's Talking username |
| `AT_SENDER_ID` | No | SMS sender ID (default: `NovaLoan`) |
| `AT_WHATSAPP_NUMBER` | No | AT WhatsApp business number |
| `TWILIO_ACCOUNT_SID` | No | Twilio SID (WhatsApp fallback) |
| `TWILIO_AUTH_TOKEN` | No | Twilio auth token |
| `DEFAULT_NOTIFICATION_CHANNEL` | No | `sms` or `whatsapp` (default: `whatsapp`) |
| `WEBHOOK_PORT` | No | Webhook server port (default: 4000) |
| `DASHBOARD_PORT` | No | Dashboard port (default: 3001) |

*Required for notification features.

---

## MCP Tools Reference

### Deposit & GL
| Tool | Description |
|---|---|
| `calculate_deposit_breakdown` | Compute DR/CR lines for a client deposit by product |
| `post_deposit_to_gl` | Post a calculated breakdown as a Fineract journal entry |

### Notifications
| Tool | Description |
|---|---|
| `send_notification` | Send SMS or WhatsApp to one or more phone numbers |
| `get_action_queue` | Scan loan notes for pending officer actions |
| `notify_officers_of_pending_actions` | Bulk-notify all officers with outstanding actions |
| `get_checker_queue` | List loans waiting for checker approval |

### Customer Journey
| Tool | Description |
|---|---|
| `get_customer_journey` | Full lifecycle reconstruction for a loan ID |
| `get_nova_sop` | Return Nova Microfinance standard operating procedure document |

### Portfolio Health
| Tool | Description |
|---|---|
| `get_portfolio_snapshot` | PAR, aging, collection efficiency |
| `get_par_aging` | PAR bucketed by overdue day ranges |

### Audit & Validation
| Tool | Description |
|---|---|
| `audit_gl_mapping` | Check GL account assignments on all loan products |
| `validate_topup_loan` | Validate top-up using principalOutstanding only |
| `scan_standing_instructions` | Check for standing instructions firing on book balance |
| `check_reconciliation` | Reconcile Fineract vs external payment records |

### Issue Tracker
| Tool | Description |
|---|---|
| `list_issues` | List all tracked issues with optional filters |
| `get_issue` | Get full details for one issue by ID |
| `update_issue_status` | Update status / assignee for an issue |

### Fineract Admin
| Tool | Description |
|---|---|
| `list_loan_products` / `get_loan_product` / `create_loan_product` / `update_loan_product` | Loan product CRUD |
| `list_gl_accounts` / `create_gl_account` / `update_gl_account` | GL account management |
| `list_users` / `create_user` / `update_user` | User management |
| `list_staff` / `create_staff` | Staff management |
| `list_charges` / `create_charge` | Charge configuration |
| `list_offices` / `create_office` | Office management |
| `list_payment_types` / `create_payment_type` | Payment type configuration |
| `list_reports` / `run_report` / `create_report` / `update_report` | Reporting |
| `list_webhooks` / `create_webhook` / `delete_webhook` | Webhook management |
| `get_audit_log` | Fineract audit trail |
| `approve_loan` / `disburse_loan` / `reject_loan` | Loan lifecycle actions |
| `add_loan_note` | Add note + auto-notify assigned officer via WhatsApp |
| `get_loan_notes` | Retrieve all notes for a loan |

---

## Deposit Breakdown – Product Fee Schedules

Pre-configured products in `src/config/product-fee-schedules.json`:

| Product Key | Label | Example Loan | Down Payment % |
|---|---|---|---|
| `HAOJUE` | Haojue Motorcycle | 630,000 UGX | varies |
| `SIMBA_BOSS_110` | Simba Boss 110cc | 450,000 UGX | varies |
| `SIMBA_RAPTOR` | Simba Raptor | 510,000 UGX | varies |
| `TVS` | TVS Motorcycle | configurable | varies |
| `HONDA` | Honda Motorcycle | configurable | varies |

Fee components per product: Tracking (fixed), Insurance (% loan), Processing Fee (% loan), Arrangement Fee (% loan), App Fee (fixed), Form Fee (fixed), CRB (fixed), Loan Repayment Wallet (remainder).

To add a new product, edit `src/config/product-fee-schedules.json` — no code changes needed.

---

## Issues Register

17 tracked issues covering:
- **ISS-001** – Top-up loan deducts principal + future interest (CRITICAL)
- **ISS-004** – GL misalignment: wallet vs revenue vs liability accounts
- **ISS-006** – Standing instructions firing on book balance not confirmed deposits
- **ISS-010** – Frozen/stuck loans with no lifecycle transition path
- **ISS-011** – Data migration mismatches (legacy → Fineract)
- **ISS-013** – Repayment date misalignment after restructure
- **ISS-HUB-001 through ISS-HUB-006** – Pipeline feedback loops, uncaptured payments
- **MF-001, MF-002** – GL account structure issues
- **RPT-001 through RPT-008** – Reporting gaps and inaccuracies

---

## Development

```bash
# Run MCP server in dev mode
npm run dev

# Run webhook server
npm run webhook

# Run dashboard
cd dashboard && npm install && npm run dev
```

---

## Architecture

```
Claude Desktop / AI Client
        │
        │ stdio (MCP protocol)
        ▼
  MCP Server (src/index.ts)
        │
        ├─── Fineract REST API (your Helaplus instance)
        ├─── Africa's Talking (SMS / WhatsApp)
        └─── Twilio (WhatsApp fallback)

Fineract Webhooks ──► Webhook Server (port 4000)
                              │
                              ├─── Notification Engine (auto-notify officers)
                              └─── REST API bridge (dashboard ↔ MCP tools)

Next.js Dashboard (port 3001)
  ├── Portfolio Overview
  ├── Deposit Calculator
  ├── Notifications
  ├── Action Queue
  ├── Reports
  ├── Issue Tracker
  └── Fineract Admin
```

---

## License

Internal use — Nova Microfinance Uganda. Not for public distribution.
