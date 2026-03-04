/**
 * Fineract Webhook Receiver + Event Router
 *
 * Listens for Fineract webhook POST events and:
 *  1. Routes to notification engine → WhatsApp/SMS to officers/clients
 *  2. Stores event log for dashboard
 *  3. Exposes REST API for the dashboard to query
 *
 * Register webhooks in Fineract:
 *   POST /hooks { payloadURL: "http://your-server:4000/webhook", events: [...] }
 * Or via MCP tool: create_webhook
 */
import express, { Request, Response } from "express";
import { sendNotification, buildMessage } from "../tools/notification-engine.js";
import type { NotificationEvent, NotificationChannel } from "../types/index.js";

const app  = express();
const port = Number(process.env.WEBHOOK_PORT ?? 4000);

app.use(express.json());
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  next();
});

// ─── In-memory event log (replace with DB in production) ────────────────────
const eventLog: Array<{ ts: string; entity: string; action: string; payload: unknown; notified: boolean }> = [];

// ─── Fineract webhook receiver ───────────────────────────────────────────────
app.post("/webhook", async (req: Request, res: Response) => {
  const { entityName, actionName, entityId, resourceId, content } = req.body ?? {};
  const ts = new Date().toISOString();
  console.log(`[WEBHOOK] ${ts} ${actionName} ${entityName} id=${entityId ?? resourceId}`);

  // Route to notification
  let notified = false;
  try {
    notified = await routeEvent(entityName, actionName, content ?? {}, entityId ?? resourceId);
  } catch (e) {
    console.error("[WEBHOOK] notify error:", e);
  }

  eventLog.unshift({ ts, entity: entityName, action: actionName, payload: req.body, notified });
  if (eventLog.length > 500) eventLog.pop();

  res.json({ received: true, notified });
});

// ─── Event router ────────────────────────────────────────────────────────────
async function routeEvent(entity: string, action: string, content: Record<string, any>, id: number): Promise<boolean> {
  const phone    = content?.loanOfficerPhoneNumber ?? content?.mobileNo ?? content?.officerPhone;
  const officer  = content?.loanOfficerName ?? "Loan Officer";
  const client   = content?.clientName ?? "Client";
  const accountNo= content?.accountNo ?? `#${id}`;
  const amount   = content?.approvedPrincipal ?? content?.amount ?? 0;
  const channel: NotificationChannel = (process.env.DEFAULT_NOTIFICATION_CHANNEL as NotificationChannel) ?? "whatsapp";

  let event: NotificationEvent | null = null;
  let data: Record<string, string> = {};

  if (entity === "NOTE" && action === "CREATE") {
    event = "LOAN_NOTE_ADDED";
    data = { officerName: officer, clientName: client, accountNo, note: content?.note ?? "(no note)", addedBy: content?.createdBy ?? "system", date: new Date().toLocaleDateString("en-UG") };
  }
  else if (entity === "LOAN" && action === "APPROVE") {
    event = "LOAN_APPROVED";
    data = { officerName: officer, clientName: client, accountNo, amount: amount.toLocaleString(), approvedBy: content?.approvedBy ?? "manager" };
  }
  else if (entity === "LOAN" && action === "REJECT") {
    event = "LOAN_REJECTED";
    data = { officerName: officer, clientName: client, accountNo, reason: content?.rejectedNote ?? "See system", rejectedBy: content?.rejectedBy ?? "manager" };
  }
  else if (entity === "LOAN" && action === "DISBURSE") {
    event = "LOAN_DISBURSED";
    data = { clientName: client, accountNo, amount: amount.toLocaleString(), firstRepaymentDate: content?.expectedFirstRepaymentOnDate ?? "per schedule" };
    phone && await sendNotification({ event, recipientPhone: phone, recipientName: client, message: buildMessage(event, data), channel });
    return true;
  }
  else if (entity === "REPAYMENT" && action === "CREATE") {
    event = "PAYMENT_RECEIVED";
    data = { clientName: client, accountNo, amount: (content?.amount ?? 0).toLocaleString(), date: new Date().toLocaleDateString("en-UG"), newBalance: (content?.outstandingLoanBalance ?? 0).toLocaleString() };
  }

  if (event && phone) {
    const message = buildMessage(event, data);
    const results = await sendNotification({ event, recipientPhone: phone, recipientName: officer, message, channel });
    return results.some(r => r.success);
  }
  return false;
}

// ─── Dashboard REST API ───────────────────────────────────────────────────────
app.get("/api/events", (_req, res) => res.json(eventLog.slice(0, 100)));
app.get("/api/health", (_req, res) => res.json({ status: "ok", uptime: process.uptime(), events: eventLog.length }));

// ─── MCP HTTP bridge (optional — lets dashboard call MCP tools via REST) ─────
app.post("/api/mcp/:tool", async (req: Request, res: Response) => {
  // Lightweight bridge — dashboard posts tool name + args, gets JSON back
  // Real implementation should import and call tool functions directly
  res.json({ tool: req.params.tool, received: req.body, note: "Implement tool routing here" });
});

app.listen(port, () => console.log(`[WEBHOOK-SERVER] Listening on port ${port}`));
export default app;
