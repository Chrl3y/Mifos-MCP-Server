#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║          MIFOS SYSTEM DOCTOR – MCP SERVER  v1.0.0                   ║
 * ║  Unified control, audit, fix, automate & monitor for Mifos X /      ║
 * ║  Apache Fineract / Helaplus microfinance deployments.               ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * ENV vars: see .env.example
 * Usage:    node dist/index.js   (stdio MCP transport)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createClient } from "./utils/fineract-client.js";

// ── Tools ──────────────────────────────────────────────────────────────────
import { calculateDepositBreakdown, postDepositToGL, listProducts } from "./tools/deposit-breakdown.js";
import { sendNotification, buildMessage, notifyOfficerOfNote } from "./tools/notification-engine.js";
import { getActionQueue, notifyOfficersOfPendingActions, getCheckerQueue } from "./tools/action-queue.js";
import { getPortfolioSnapshot } from "./tools/portfolio-snapshot.js";
import { auditGlMapping } from "./tools/audit-gl-mapping.js";
import { validateTopUp } from "./tools/validate-topup.js";
import { getCustomerJourney, getNovaSopJourney } from "./tools/customer-journey.js";
import {
  listLoanProducts, getLoanProduct, updateLoanProduct, createLoanProduct,
  listGlAccounts, createGlAccount, updateGlAccount,
  listUsers, createUser, updateUser,
  listCharges, createCharge,
  listOffices, createOffice,
  listPaymentTypes, createPaymentType,
  listReports, runReport, createReport, updateReport,
  listWebhooks, createWebhook, deleteWebhook,
  getAuditLog, listStaff, createStaff,
  approveLoan, disburseLoan, rejectLoan, addLoanNote, getLoanNotes,
} from "./tools/fineract-admin.js";
import { listIssues, getIssue, updateStatus, issueSummary, getPatterns } from "./tools/issue-tracker.js";
import type { NotificationChannel, NotificationEvent, IssuePriority, IssueStatus } from "./types/index.js";

// ─── Server ────────────────────────────────────────────────────────────────
const server = new Server(
  { name: "mifos-system-doctor", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ══════════════════════════════════════════════════════════════════════════════
//  TOOL DEFINITIONS
// ══════════════════════════════════════════════════════════════════════════════
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [

  // ── DEPOSIT BREAKDOWN ──────────────────────────────────────────────────────
  { name: "calculate_deposit_breakdown",
    description: "Split an incoming client payment into the correct GL posting lines (DR/CR) per product fee schedule. Returns formatted table + Fineract journal entry payload. Products: HAOJUE, SIMBA_BOSS_110, SIMBA_RAPTOR, TVS, HONDA.",
    inputSchema: { type: "object", required: ["productKey", "totalReceived", "loanAmount", "paymentChannel"], properties: {
      productKey:      { type: "string", description: "Product code: HAOJUE | SIMBA_BOSS_110 | SIMBA_RAPTOR | TVS | HONDA" },
      totalReceived:   { type: "number", description: "Total UGX received from client" },
      loanAmount:      { type: "number", description: "Approved loan amount (UGX)" },
      paymentChannel:  { type: "string", description: "MTN | AIRTEL | YO | CASH | BANK" },
      clientName:      { type: "string" },
      loanAccountNo:   { type: "string" },
      transactionDate: { type: "string", description: "YYYY-MM-DD" },
    }}},

  { name: "post_deposit_to_gl",
    description: "Post a previously calculated deposit breakdown to Fineract GL as a journal entry. Run calculate_deposit_breakdown first.",
    inputSchema: { type: "object", required: ["productKey","totalReceived","loanAmount","paymentChannel"], properties: {
      productKey: { type: "string" }, totalReceived: { type: "number" }, loanAmount: { type: "number" },
      paymentChannel: { type: "string" }, clientName: { type: "string" }, loanAccountNo: { type: "string" },
      transactionDate: { type: "string" }, officeId: { type: "number", default: 1 },
    }}},

  { name: "list_deposit_products",
    description: "List all product keys available for deposit breakdown calculation.",
    inputSchema: { type: "object", properties: {} }},

  // ── NOTIFICATIONS ──────────────────────────────────────────────────────────
  { name: "send_notification",
    description: "Send WhatsApp or SMS notification to a loan officer, checker, or client. Uses Africa's Talking (Uganda-optimised) with Twilio fallback.",
    inputSchema: { type: "object", required: ["recipientPhone","message","channel"], properties: {
      recipientPhone: { type: "string", description: "Phone number with country code e.g. +256701234567" },
      recipientName:  { type: "string" },
      message:        { type: "string" },
      channel:        { type: "string", enum: ["sms","whatsapp","both"] },
      event:          { type: "string", description: "Event type for template selection (optional)" },
    }}},

  { name: "notify_officer_of_note",
    description: "Instantly notify a loan officer via WhatsApp/SMS when a note is written on their client's loan — replaces manual client-list searching.",
    inputSchema: { type: "object", required: ["officerPhone","officerName","clientName","accountNo","note","addedBy"], properties: {
      officerPhone: { type: "string" }, officerName: { type: "string" },
      clientName:   { type: "string" }, accountNo:   { type: "string" },
      note:         { type: "string" }, addedBy:     { type: "string" },
      channel:      { type: "string", enum: ["sms","whatsapp","both"] },
    }}},

  { name: "notify_pending_actions",
    description: "Bulk-notify all loan officers of their pending action items via WhatsApp/SMS. Replaces manual client-list searching.",
    inputSchema: { type: "object", properties: { channel: { type: "string", enum: ["sms","whatsapp","both"] } }}},

  // ── ACTION QUEUES ─────────────────────────────────────────────────────────
  { name: "get_action_queue",
    description: "Get all loans with unresolved notes requiring officer action. Shows who needs to do what, for which client, with priority ranking.",
    inputSchema: { type: "object", properties: {
      officerId:              { type: "number", description: "Filter by loan officer ID (omit = all officers)" },
      maxAgeHours:            { type: "number", default: 72 },
      includeApprovedWaiting: { type: "boolean", default: true },
    }}},

  { name: "get_checker_queue",
    description: "Get all loans awaiting checker/manager review, sorted by oldest first.",
    inputSchema: { type: "object", properties: {} }},

  // ── PORTFOLIO & REPORTING ─────────────────────────────────────────────────
  { name: "get_portfolio_snapshot",
    description: "Point-in-time portfolio snapshot: PAR, aging buckets (1-30, 31-60, 61-90, 91-180, 181+), collection efficiency, per-product and per-officer breakdown.",
    inputSchema: { type: "object", properties: { asOfDate: { type: "string", description: "YYYY-MM-DD" } }}},

  { name: "run_report",
    description: "Run any Fineract Stretchy report by name with parameters. Returns JSON/CSV.",
    inputSchema: { type: "object", required: ["reportName"], properties: {
      reportName:  { type: "string", description: "e.g. LoanArrearsAging, TrialBalance, LoansDueToday" },
      params:      { type: "object", description: "Report parameters as key:value (will be prefixed with R_)", additionalProperties: { type: "string" } },
      outputType:  { type: "string", enum: ["JSON","CSV","XLS"], default: "JSON" },
    }}},

  { name: "list_reports",
    description: "List all available reports configured in the system.",
    inputSchema: { type: "object", properties: {} }},

  // ── AUDIT & SCANNING ─────────────────────────────────────────────────────
  { name: "audit_gl_mapping",
    description: "Audit GL account mappings for all (or one) loan products. Detects missing mappings, disabled accounts, missing accounting rule.",
    inputSchema: { type: "object", properties: { productId: { type: "number" } }}},

  { name: "validate_loan_topup",
    description: "Validate top-up loan offset uses principal-only (not principal+interest). Catches ISS-001 bug.",
    inputSchema: { type: "object", required: ["loanId","proposedAmount"], properties: {
      loanId: { type: "number" }, proposedAmount: { type: "number" },
    }}},

  // ── CUSTOMER JOURNEY ─────────────────────────────────────────────────────
  { name: "get_customer_journey",
    description: "Reconstruct full lifecycle of a loan/client: stage history, bottlenecks, next actions, days at each stage.",
    inputSchema: { type: "object", required: ["loanId"], properties: { loanId: { type: "number" } }}},

  { name: "get_nova_sop",
    description: "Return the full standardised Nova Microfinance customer journey (SOP) including communication matrix and system triggers.",
    inputSchema: { type: "object", properties: {} }},

  // ── FINERACT ADMIN: LOAN PRODUCTS ─────────────────────────────────────────
  { name: "list_loan_products",
    description: "List all configured loan products.",
    inputSchema: { type: "object", properties: {} }},

  { name: "get_loan_product",
    description: "Get full detail of a loan product including GL mappings.",
    inputSchema: { type: "object", required: ["productId"], properties: { productId: { type: "number" } }}},

  { name: "update_loan_product",
    description: "Update any fields on a loan product (name, principal, rates, GL mappings, accounting rule, etc.).",
    inputSchema: { type: "object", required: ["productId","updates"], properties: {
      productId: { type: "number" },
      updates:   { type: "object", description: "Fields to update", additionalProperties: true },
    }}},

  { name: "create_loan_product",
    description: "Create a new loan product in Fineract.",
    inputSchema: { type: "object", required: ["product"], properties: { product: { type: "object", additionalProperties: true } }}},

  // ── FINERACT ADMIN: GL ACCOUNTS ───────────────────────────────────────────
  { name: "list_gl_accounts",
    description: "List GL accounts. Filter by type (1=ASSET, 2=LIABILITY, 3=EQUITY, 4=INCOME, 5=EXPENSE) and disabled status.",
    inputSchema: { type: "object", properties: { type: { type: "number" }, disabled: { type: "boolean" } }}},

  { name: "create_gl_account",
    description: "Create a new GL account in the chart of accounts.",
    inputSchema: { type: "object", required: ["glCode","name","type","usage"], properties: {
      glCode: { type: "string" }, name: { type: "string" },
      type:   { type: "number", description: "1=ASSET 2=LIABILITY 3=EQUITY 4=INCOME 5=EXPENSE" },
      usage:  { type: "number", description: "1=DETAIL 2=HEADER" },
      manualEntriesAllowed: { type: "boolean" },
      parentId:    { type: "number" },
      description: { type: "string" },
    }}},

  { name: "update_gl_account",
    description: "Update a GL account (name, enable/disable, manual entries, etc.).",
    inputSchema: { type: "object", required: ["glAccountId","updates"], properties: {
      glAccountId: { type: "number" }, updates: { type: "object", additionalProperties: true },
    }}},

  // ── FINERACT ADMIN: USERS & STAFF ─────────────────────────────────────────
  { name: "list_users",
    description: "List all system users.",
    inputSchema: { type: "object", properties: {} }},

  { name: "create_user",
    description: "Create a new Fineract user with roles.",
    inputSchema: { type: "object", required: ["username","firstname","lastname","email","officeId","roles"], properties: {
      username: { type: "string" }, firstname: { type: "string" }, lastname: { type: "string" },
      email: { type: "string" }, officeId: { type: "number" },
      roles: { type: "array", items: { type: "number" } },
      staffId: { type: "number" }, password: { type: "string" },
    }}},

  { name: "list_staff",
    description: "List all staff members. Optionally filter by office.",
    inputSchema: { type: "object", properties: { officeId: { type: "number" } }}},

  { name: "create_staff",
    description: "Create a new staff/loan officer record.",
    inputSchema: { type: "object", required: ["firstname","lastname","officeId"], properties: {
      firstname: { type: "string" }, lastname: { type: "string" }, officeId: { type: "number" },
      isLoanOfficer: { type: "boolean" }, mobileNo: { type: "string" }, emailAddress: { type: "string" },
    }}},

  // ── FINERACT ADMIN: CHARGES ───────────────────────────────────────────────
  { name: "list_charges",
    description: "List all configured charges/fees in the system.",
    inputSchema: { type: "object", properties: {} }},

  { name: "create_charge",
    description: "Create a new charge/fee product.",
    inputSchema: { type: "object", required: ["name","currencyCode","amount","chargeAppliesTo","chargeTimeType","chargeCalculationType"], properties: {
      name: { type: "string" }, currencyCode: { type: "string" }, amount: { type: "number" },
      chargeAppliesTo: { type: "number", description: "1=Loan 2=Savings" },
      chargeTimeType:  { type: "number", description: "1=Disbursement 2=SpecifiedDue 4=InstalmentFee" },
      chargeCalculationType: { type: "number", description: "1=Flat 2=%Amount 3=%LoanInterest" },
      active: { type: "boolean", default: true },
    }}},

  // ── FINERACT ADMIN: OFFICES ───────────────────────────────────────────────
  { name: "list_offices",
    description: "List all offices/branches.",
    inputSchema: { type: "object", properties: {} }},

  { name: "create_office",
    description: "Create a new office/branch.",
    inputSchema: { type: "object", required: ["name","parentId","openingDate"], properties: {
      name: { type: "string" }, parentId: { type: "number" }, openingDate: { type: "string" },
    }}},

  // ── FINERACT ADMIN: PAYMENT TYPES ─────────────────────────────────────────
  { name: "list_payment_types",
    description: "List all payment types (MTN, Airtel, YO!, Cash, etc.).",
    inputSchema: { type: "object", properties: {} }},

  { name: "create_payment_type",
    description: "Create a new payment type.",
    inputSchema: { type: "object", required: ["name"], properties: {
      name: { type: "string" }, description: { type: "string" }, isCash: { type: "boolean" },
    }}},

  // ── FINERACT ADMIN: WEBHOOKS ──────────────────────────────────────────────
  { name: "list_webhooks",
    description: "List all registered Fineract webhooks.",
    inputSchema: { type: "object", properties: {} }},

  { name: "create_webhook",
    description: "Register a new Fineract webhook to receive events (loan approval, notes, payments, etc.).",
    inputSchema: { type: "object", required: ["name","payloadURL"], properties: {
      name:         { type: "string" },
      payloadURL:   { type: "string", description: "URL to receive POST events (your webhook server)" },
      isActive:     { type: "boolean", default: true },
      contentType:  { type: "string", default: "json" },
      events:       { type: "array", items: { type: "object", properties: { actionName: { type: "string" }, entityName: { type: "string" } } } },
    }}},

  { name: "delete_webhook",
    description: "Remove a registered webhook.",
    inputSchema: { type: "object", required: ["webhookId"], properties: { webhookId: { type: "number" } }}},

  // ── FINERACT ADMIN: REPORTS ───────────────────────────────────────────────
  { name: "create_report",
    description: "Create a new Stretchy (SQL-based) report in Fineract.",
    inputSchema: { type: "object", required: ["reportName","reportType","reportSql"], properties: {
      reportName:     { type: "string" }, reportType: { type: "string", default: "Table" },
      reportCategory: { type: "string" }, reportSql:  { type: "string" },
      description:    { type: "string" },
    }}},

  { name: "update_report",
    description: "Update an existing report's SQL or parameters.",
    inputSchema: { type: "object", required: ["reportId","updates"], properties: {
      reportId: { type: "number" }, updates: { type: "object", additionalProperties: true },
    }}},

  // ── LOAN LIFECYCLE ────────────────────────────────────────────────────────
  { name: "approve_loan",
    description: "Approve a submitted loan application.",
    inputSchema: { type: "object", required: ["loanId","approvedOnDate"], properties: {
      loanId: { type: "number" }, approvedOnDate: { type: "string", description: "dd MMMM yyyy" },
      note:   { type: "string" },
    }}},

  { name: "disburse_loan",
    description: "Disburse an approved loan.",
    inputSchema: { type: "object", required: ["loanId","actualDisbursementDate"], properties: {
      loanId: { type: "number" }, actualDisbursementDate: { type: "string" },
      paymentTypeId: { type: "number" }, note: { type: "string" },
    }}},

  { name: "reject_loan",
    description: "Reject a submitted loan application with reason.",
    inputSchema: { type: "object", required: ["loanId","reason"], properties: {
      loanId: { type: "number" }, reason: { type: "string" },
    }}},

  { name: "add_loan_note",
    description: "Add a note to a loan. Triggers WhatsApp notification to assigned officer.",
    inputSchema: { type: "object", required: ["loanId","note"], properties: {
      loanId:       { type: "number" },
      note:         { type: "string" },
      notifyOfficer: { type: "boolean", default: true, description: "Send WhatsApp/SMS to assigned officer" },
    }}},

  { name: "get_loan_notes",
    description: "Get all notes on a loan.",
    inputSchema: { type: "object", required: ["loanId"], properties: { loanId: { type: "number" } }}},

  // ── AUDIT LOG ─────────────────────────────────────────────────────────────
  { name: "get_audit_log",
    description: "Query the Fineract audit log for any action on any entity.",
    inputSchema: { type: "object", properties: {
      actionName: { type: "string", description: "e.g. APPROVE, DISBURSE, CREATE" },
      entityName: { type: "string", description: "e.g. LOAN, CLIENT, NOTE" },
      fromDate:   { type: "string" }, toDate: { type: "string" }, limit: { type: "number", default: 100 },
    }}},

  // ── ISSUE TRACKER ─────────────────────────────────────────────────────────
  { name: "list_issues",
    description: "List tracked platform issues. Filter by domain, priority, status, or assignee.",
    inputSchema: { type: "object", properties: {
      domain:     { type: "string" },
      priority:   { type: "string", enum: ["CRITICAL","HIGH","MEDIUM","LOW"] },
      status:     { type: "string" },
      assignedTo: { type: "string" },
    }}},

  { name: "get_issue",
    description: "Get full detail for a specific issue (ISS-001, ISS-HUB-001, MF-002, etc.).",
    inputSchema: { type: "object", required: ["issueId"], properties: { issueId: { type: "string" } }}},

  { name: "update_issue_status",
    description: "Update the status of a tracked issue.",
    inputSchema: { type: "object", required: ["issueId","newStatus"], properties: {
      issueId:   { type: "string" },
      newStatus: { type: "string", enum: ["OPEN","NEW","IDENTIFIED","ESCALATED","AWAITING DEV","PENDING GUIDANCE","IN PROGRESS","RESOLVED","ENHANCEMENT","BUG","CONFIG"] },
      notes:     { type: "string" },
    }}},

  { name: "issue_summary",
    description: "Dashboard summary: all issues by priority, status and domain.",
    inputSchema: { type: "object", properties: {} }},

  { name: "systemic_patterns",
    description: "List the major systemic weaknesses identified across the platform.",
    inputSchema: { type: "object", properties: {} }},

]}));

// ══════════════════════════════════════════════════════════════════════════════
//  TOOL HANDLERS
// ══════════════════════════════════════════════════════════════════════════════
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  const A = (args ?? {}) as Record<string, any>;
  const client = createClient();
  const ok = (data: unknown) => ({ content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] });
  const err = (msg: string) => ({ content: [{ type: "text" as const, text: msg }], isError: true });

  try {
    switch (name) {

      // ── DEPOSIT BREAKDOWN ────────────────────────────────────────────────
      case "calculate_deposit_breakdown": {
        const r = calculateDepositBreakdown(A as any);
        return ok(r.formattedTable + "\n\n" + JSON.stringify({ breakdown: r }, null, 2));
      }
      case "post_deposit_to_gl": {
        const breakdown = calculateDepositBreakdown(A as any);
        const r = await postDepositToGL(client, breakdown, A.officeId ?? 1);
        return ok({ breakdown: breakdown.formattedTable, posting: r });
      }
      case "list_deposit_products": return ok({ products: listProducts() });

      // ── NOTIFICATIONS ────────────────────────────────────────────────────
      case "send_notification": {
        const r = await sendNotification({
          event: (A.event ?? "LOAN_NOTE_ADDED") as NotificationEvent,
          recipientPhone: A.recipientPhone, recipientName: A.recipientName ?? "",
          message: A.message, channel: A.channel as NotificationChannel,
        });
        return ok(r);
      }
      case "notify_officer_of_note": {
        const r = await notifyOfficerOfNote({ ...A as any });
        return ok(r);
      }
      case "notify_pending_actions": {
        const r = await notifyOfficersOfPendingActions(client, A.channel as NotificationChannel ?? "whatsapp");
        return ok(r);
      }

      // ── ACTION QUEUES ────────────────────────────────────────────────────
      case "get_action_queue":    return ok(await getActionQueue(client, A as any));
      case "get_checker_queue":   return ok(await getCheckerQueue(client));

      // ── PORTFOLIO ────────────────────────────────────────────────────────
      case "get_portfolio_snapshot": return ok(await getPortfolioSnapshot(client, A.asOfDate));
      case "run_report":          return ok(await runReport(client, A.reportName, A.params ?? {}, A.outputType ?? "JSON"));
      case "list_reports":        return ok(await listReports(client));

      // ── AUDIT ────────────────────────────────────────────────────────────
      case "audit_gl_mapping":    return ok(await auditGlMapping(client, A.productId));
      case "validate_loan_topup": return ok(await validateTopUp(client, A.loanId, A.proposedAmount));

      // ── CUSTOMER JOURNEY ─────────────────────────────────────────────────
      case "get_customer_journey": return ok(await getCustomerJourney(client, A.loanId));
      case "get_nova_sop":         return ok(getNovaSopJourney());

      // ── LOAN PRODUCTS ────────────────────────────────────────────────────
      case "list_loan_products":  return ok(await listLoanProducts(client));
      case "get_loan_product":    return ok(await getLoanProduct(client, A.productId));
      case "update_loan_product": return ok(await updateLoanProduct(client, A.productId, A.updates));
      case "create_loan_product": return ok(await createLoanProduct(client, A.product));

      // ── GL ACCOUNTS ──────────────────────────────────────────────────────
      case "list_gl_accounts":    return ok(await listGlAccounts(client, A as any));
      case "create_gl_account":   return ok(await createGlAccount(client, A as any));
      case "update_gl_account":   return ok(await updateGlAccount(client, A.glAccountId, A.updates));

      // ── USERS & STAFF ────────────────────────────────────────────────────
      case "list_users":    return ok(await listUsers(client));
      case "create_user":   return ok(await createUser(client, A as any));
      case "list_staff":    return ok(await listStaff(client, A.officeId));
      case "create_staff":  return ok(await createStaff(client, A as any));

      // ── CHARGES ──────────────────────────────────────────────────────────
      case "list_charges":  return ok(await listCharges(client));
      case "create_charge": return ok(await createCharge(client, A as any));

      // ── OFFICES ──────────────────────────────────────────────────────────
      case "list_offices":  return ok(await listOffices(client));
      case "create_office": return ok(await createOffice(client, A as any));

      // ── PAYMENT TYPES ────────────────────────────────────────────────────
      case "list_payment_types":  return ok(await listPaymentTypes(client));
      case "create_payment_type": return ok(await createPaymentType(client, A.name, A.description, A.isCash));

      // ── WEBHOOKS ─────────────────────────────────────────────────────────
      case "list_webhooks":  return ok(await listWebhooks(client));
      case "create_webhook": return ok(await createWebhook(client, A as any));
      case "delete_webhook": return ok(await deleteWebhook(client, A.webhookId));

      // ── REPORTS ──────────────────────────────────────────────────────────
      case "create_report": return ok(await createReport(client, A as any));
      case "update_report": return ok(await updateReport(client, A.reportId, A.updates));

      // ── LOAN LIFECYCLE ───────────────────────────────────────────────────
      case "approve_loan":   return ok(await approveLoan(client, A.loanId, A as any));
      case "disburse_loan":  return ok(await disburseLoan(client, A.loanId, A as any));
      case "reject_loan":    return ok(await rejectLoan(client, A.loanId, A.reason));
      case "get_loan_notes": return ok(await getLoanNotes(client, A.loanId));
      case "add_loan_note": {
        const r = await addLoanNote(client, A.loanId, A.note);
        // Auto-notify officer if requested
        if (A.notifyOfficer !== false) {
          const loan: any = await client.get(`/loans/${A.loanId}`, { fields: "loanOfficerName,clientName,accountNo" }).catch(() => ({}));
          const staff: any[] = await listStaff(client).catch(() => []) as any[];
          const officer = staff.find((s: any) => s.displayName === loan.loanOfficerName);
          if (officer?.mobileNo) {
            await notifyOfficerOfNote({
              officerName: officer.displayName, officerPhone: officer.mobileNo,
              clientName: loan.clientName ?? "Client", accountNo: loan.accountNo ?? `#${A.loanId}`,
              note: A.note, addedBy: "System/MCP",
            });
          }
        }
        return ok(r);
      }

      // ── AUDIT LOG ────────────────────────────────────────────────────────
      case "get_audit_log": return ok(await getAuditLog(client, A as any));

      // ── ISSUE TRACKER ────────────────────────────────────────────────────
      case "list_issues":        return ok(listIssues(A as any));
      case "get_issue":          return ok(getIssue(A.issueId) ?? `Issue ${A.issueId} not found`);
      case "update_issue_status":return ok(updateStatus(A.issueId, A.newStatus as IssueStatus, A.notes));
      case "issue_summary":      return ok(issueSummary());
      case "systemic_patterns":  return ok(getPatterns().map((p, i) => `${i+1}. ${p}`).join("\n"));

      default: return err(`Unknown tool: ${name}`);
    }
  } catch (e) {
    return err(`Error in ${name}: ${e instanceof Error ? e.message : String(e)}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("🏥 Mifos System Doctor MCP server running on stdio.");
