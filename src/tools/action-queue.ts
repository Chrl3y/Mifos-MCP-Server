/**
 * Tool: get_action_queue / get_officer_queue / notify_pending_actions
 *
 * Surfaces all pending checker/officer actions:
 *  - Notes written on loans awaiting officer action
 *  - Loans at approval stages with no activity for N hours
 *  - Overdue items per officer
 *
 * Replaces the current manual "search each client one by one" workflow.
 * Officers receive WhatsApp/SMS alerts instead.
 */
import { FineractClient } from "../utils/fineract-client.js";
import { ActionItem, LoanSummary, LoanNote } from "../types/index.js";
import { dateFromArray, daysBetween, todayStr } from "../utils/formatter.js";
import { notifyOfficerOfNote } from "./notification-engine.js";
import type { NotificationChannel } from "../types/index.js";

interface StaffInfo {
  id: number;
  displayName: string;
  mobileNo?: string;
  emailAddress?: string;
  officeId: number;
}

/** Fetch all staff with their phone numbers */
async function getStaffMap(client: FineractClient): Promise<Map<number, StaffInfo>> {
  const map = new Map<number, StaffInfo>();
  try {
    const staff = await client.get<StaffInfo[]>("/staff?status=active");
    for (const s of staff) map.set(s.id, s);
  } catch { /* non-fatal */ }
  return map;
}

/** Get all loans at actionable stages with notes requiring officer action */
export async function getActionQueue(
  client: FineractClient,
  options: { officerId?: number; maxAgeHours?: number; includeApprovedWaiting?: boolean } = {}
): Promise<ActionItem[]> {
  const { officerId, maxAgeHours = 72, includeApprovedWaiting = true } = options;
  const items: ActionItem[] = [];
  const staffMap = await getStaffMap(client);

  // Loans in submitted/approved/active state
  const statusesToCheck = ["submitted", "approved", ...(includeApprovedWaiting ? [] : [])];
  let loans: LoanSummary[] = [];
  try {
    loans = await client.getAllPages<LoanSummary>("/loans", {
      loanStatus: "active,submitted,approved",
      fields: "id,accountNo,clientName,clientId,productName,loanOfficerName,loanOfficerId,status",
      ...(officerId ? { staffId: officerId } : {}),
    });
  } catch { return items; }

  for (const loan of loans) {
    // Fetch notes on this loan
    let notes: LoanNote[] = [];
    try {
      notes = await client.get<LoanNote[]>(`/loans/${loan.id}/notes`);
    } catch { continue; }

    if (!notes.length) continue;

    // Find the most recent unresolved action note
    for (const note of notes.slice(-3)) {
      const noteDate = note.updatedOn ?? note.createdOn ?? "";
      const daysOld = noteDate ? daysBetween(noteDate.split("T")[0]) : 0;

      if (daysOld > (maxAgeHours / 24) * 3) continue; // skip very old notes

      const text = note.note ?? "";
      const isActionable = /adjust|action|review|correct|fix|update|change|require|pending|approve/i.test(text);
      if (!isActionable) continue;

      const staff = loan.loanOfficerId ? staffMap.get(loan.loanOfficerId) : undefined;
      items.push({
        loanId: loan.id,
        accountNo: loan.accountNo,
        clientName: loan.clientName,
        clientId: loan.clientId,
        officerName: loan.loanOfficerName ?? staff?.displayName,
        officerPhone: staff?.mobileNo,
        noteText: text,
        noteCreatedBy: note.createdBy,
        noteCreatedOn: noteDate,
        actionType: classifyAction(text),
        priority: daysOld > 2 ? "HIGH" : daysOld > 1 ? "MEDIUM" : "LOW",
        loanStatus: loan.status?.value ?? "unknown",
        daysPending: daysOld,
      });
    }
  }

  // Sort: HIGH first, then by days pending
  items.sort((a, b) => {
    const p = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return (p[a.priority] - p[b.priority]) || (b.daysPending - a.daysPending);
  });

  return items;
}

function classifyAction(noteText: string): ActionItem["actionType"] {
  if (/adjust|correct|fix|change/i.test(noteText))  return "ADJUST";
  if (/approve|approval/i.test(noteText))             return "APPROVE";
  if (/disburse|disbursement/i.test(noteText))        return "DISBURSE";
  if (/review/i.test(noteText))                       return "REVIEW";
  return "OTHER";
}

/** Push WhatsApp/SMS notifications to each affected officer */
export async function notifyOfficersOfPendingActions(
  client: FineractClient,
  channel: NotificationChannel = "whatsapp"
): Promise<{ notified: number; failed: number; skipped: number; details: string[] }> {
  const items = await getActionQueue(client);
  const byOfficer = new Map<string, { phone: string; items: ActionItem[] }>();

  for (const item of items) {
    if (!item.officerPhone) continue;
    const key = item.officerName ?? item.officerPhone;
    if (!byOfficer.has(key)) {
      byOfficer.set(key, { phone: item.officerPhone, items: [] });
    }
    byOfficer.get(key)!.items.push(item);
  }

  let notified = 0, failed = 0, skipped = 0;
  const details: string[] = [];

  for (const [name, { phone, items: officerItems }] of byOfficer) {
    if (!phone) { skipped++; details.push(`${name}: no phone on file`); continue; }

    // Consolidate into one message per officer
    const summary = officerItems
      .slice(0, 5)
      .map(i => `• ${i.clientName} (${i.accountNo}): "${i.noteText.substring(0, 60)}..."`)
      .join("\n");

    const results = await notifyOfficerOfNote({
      officerName: name,
      officerPhone: phone,
      clientName: `${officerItems.length} client(s) need your attention`,
      accountNo: officerItems.map(i => i.accountNo).join(", "),
      note: summary,
      addedBy: "System",
      channel,
    });

    const ok = results.some(r => r.success);
    if (ok) { notified++; details.push(`✅ ${name} (${phone}): ${officerItems.length} items`); }
    else     { failed++;   details.push(`❌ ${name} (${phone}): send failed`); }
  }

  skipped += items.filter(i => !i.officerPhone).length;
  return { notified, failed, skipped, details };
}

/** Get checker queue: loans in "submitted" state awaiting checker review */
export async function getCheckerQueue(
  client: FineractClient
): Promise<Array<{ loanId: number; accountNo: string; clientName: string; submittedDaysAgo: number; productName: string; status: string; notes: string[] }>> {
  const loans = await client.getAllPages<LoanSummary>("/loans", {
    loanStatus: "submitted",
    fields: "id,accountNo,clientName,productName,status,timeline",
  });

  const result = [];
  for (const loan of loans) {
    const submittedDate = (loan as any).timeline?.submittedOnDate;
    const daysAgo = submittedDate ? daysBetween(dateFromArray(submittedDate)) : 0;
    let noteTexts: string[] = [];
    try {
      const notes = await client.get<LoanNote[]>(`/loans/${loan.id}/notes`);
      noteTexts = notes.slice(-3).map(n => n.note);
    } catch { /* skip */ }

    result.push({
      loanId: loan.id,
      accountNo: loan.accountNo,
      clientName: loan.clientName,
      submittedDaysAgo: daysAgo,
      productName: loan.productName,
      status: loan.status?.value ?? "",
      notes: noteTexts,
    });
  }
  return result.sort((a, b) => b.submittedDaysAgo - a.submittedDaysAgo);
}
