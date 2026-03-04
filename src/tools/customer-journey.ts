/**
 * Tool: get_customer_journey
 *
 * Reconstructs the full lifecycle of a client/loan:
 * LEAD → APPLICATION → CREDIT_REVIEW → MANAGER_APPROVAL → COMPLIANCE_CHECK
 * → DOWN_PAYMENT → DISBURSEMENT → ACTIVE_REPAYMENT → [ARREARS | RESTRUCTURED
 * | REPOSSESSED | CLOSED | WRITTEN_OFF]
 *
 * Identifies bottlenecks and surfaces next required actions.
 * Also documents the standard Nova process flow as a reference.
 */
import { FineractClient } from "../utils/fineract-client.js";
import { CustomerJourney, JourneyEvent, JourneyStage } from "../types/index.js";
import { dateFromArray, daysBetween, todayStr } from "../utils/formatter.js";

export async function getCustomerJourney(
  client: FineractClient,
  loanId: number
): Promise<CustomerJourney> {
  const loan = await client.get<any>(`/loans/${loanId}`, {
    associations: "repaymentSchedule,transactions,charges",
    fields: "id,accountNo,clientName,clientId,productName,loanOfficerName,status,timeline,summary,transactions",
  });

  const notes = await client.get<any[]>(`/loans/${loanId}/notes`).catch(() => []);
  const events: JourneyEvent[] = [];

  const tl = loan.timeline ?? {};
  const push = (stage: JourneyStage, dateArr: number[] | undefined, actor: string, desc: string, noteText?: string) => {
    if (!dateArr) return;
    events.push({
      stage,
      date: dateFromArray(dateArr),
      actor,
      description: desc,
      notes: noteText,
    });
  };

  push("APPLICATION", tl.submittedOnDate, tl.submittedByUsername ?? "officer", "Loan application submitted");
  push("CREDIT_REVIEW", tl.submittedOnDate, "credit_analyst", "Credit analyst review period begins");
  push("MANAGER_APPROVAL", tl.approvedOnDate ?? tl.rejectedOnDate, tl.approvedByUsername ?? tl.rejectedByUsername ?? "manager",
    tl.approvedOnDate ? "Loan approved by manager" : "Loan rejected by manager");
  push("DOWN_PAYMENT", tl.actualDisbursementDate, "teller",
    "Down payment received and posted", "Down payment breakdown applied per product schedule");
  push("DISBURSEMENT", tl.actualDisbursementDate, tl.disbursedByUsername ?? "officer", "Loan disbursed");

  // Derive current stage from status
  const status: string = loan.status?.value ?? "";
  const overdue = (loan.summary?.totalOverdue ?? 0) > 0;
  let currentStage: JourneyStage = "ACTIVE_REPAYMENT";
  if (status === "submitted")    currentStage = "APPLICATION";
  else if (status === "approved") currentStage = "DOWN_PAYMENT";
  else if (status === "active" && overdue) currentStage = "ARREARS";
  else if (status === "active")  currentStage = "ACTIVE_REPAYMENT";
  else if (status === "closed" || status === "overpaid") currentStage = "CLOSED";
  else if (status === "written-off")  currentStage = "WRITTEN_OFF";
  else if (status === "chargedOff")   currentStage = "REPOSSESSED";

  // Add note events
  for (const note of notes.slice(-5)) {
    events.push({
      stage: currentStage,
      date: (note.createdOn ?? "").split("T")[0] || todayStr(),
      actor: note.createdBy ?? "system",
      description: "Note added",
      notes: note.note,
    });
  }

  // Sort by date
  events.sort((a, b) => a.date.localeCompare(b.date));

  // Measure days in current stage
  const stageStart = events.filter(e => e.stage === currentStage).at(-1)?.date ?? todayStr();
  const daysInCurrentStage = daysBetween(stageStart);

  // Identify bottleneck
  let bottleneck: string | undefined;
  if (currentStage === "APPLICATION" && daysInCurrentStage > 2)
    bottleneck = `Loan has been in APPLICATION for ${daysInCurrentStage} days without approval.`;
  if (currentStage === "DOWN_PAYMENT" && daysInCurrentStage > 3)
    bottleneck = `Waiting for down payment for ${daysInCurrentStage} days post-approval.`;
  if (currentStage === "ARREARS" && daysInCurrentStage > 30)
    bottleneck = `Loan in arrears for ${daysInCurrentStage} days. Consider restructuring or repossession.`;

  // Next actions
  const nextActions = deriveNextActions(currentStage, loan, daysInCurrentStage);

  return {
    clientId: loan.clientId,
    clientName: loan.clientName,
    loanId: loan.id,
    accountNo: loan.accountNo,
    product: loan.productName,
    currentStage,
    daysInCurrentStage,
    events,
    bottleneck,
    nextActions,
  };
}

function deriveNextActions(stage: JourneyStage, loan: any, days: number): string[] {
  const map: Partial<Record<JourneyStage, string[]>> = {
    APPLICATION: [
      "Credit analyst to complete risk assessment",
      "Verify client documents (NIN, guarantor, photo, boda ownership docs)",
      "Run CRB check",
      "Complete loan scoring checklist",
    ],
    CREDIT_REVIEW: [
      "Credit analyst to add review notes",
      "Escalate to manager for approval decision",
      "Verify compliance requirements",
    ],
    MANAGER_APPROVAL: [
      "Manager to approve or reject with clear notes",
      "Notify loan officer of decision via WhatsApp",
    ],
    COMPLIANCE_CHECK: [
      "Final compliance sign-off",
      "Confirm product accounting mappings are correct",
    ],
    DOWN_PAYMENT: [
      "Receive and post down payment breakdown per product schedule",
      "Verify Tracking Payable, Insurance, Arrangement Fees are correctly split",
      "Use calculate_deposit_breakdown tool to generate GL posting",
      "Post journal entry to Fineract",
    ],
    DISBURSEMENT: [
      "Disburse via MTN/Airtel/YO or cash",
      "Confirm standing instruction setup for repayments",
      "Send repayment schedule to client",
      "Set up SMS/WhatsApp repayment reminders",
    ],
    ACTIVE_REPAYMENT: [
      days > 14 ? "Check if repayment is on schedule" : "Monitor next repayment date",
      "Send pre-due-date reminder 3 days before",
    ],
    ARREARS: [
      `Contact client immediately — ${days} days overdue`,
      "Field visit if phone unreachable",
      days > 30 ? "Initiate restructuring or repossession assessment" : "Negotiate payment plan",
      days > 90 ? "Escalate to management — consider charge-off" : "Send formal arrears notice",
    ],
    RESTRUCTURED: [
      "Monitor new repayment schedule",
      "Weekly officer check-in",
    ],
    REPOSSESSED: [
      "Document asset recovery",
      "Value repossessed asset",
      "Process write-off entry for remaining balance",
    ],
    CLOSED: [
      "Issue loan clearance certificate",
      "Archive client file",
      "Assess eligibility for top-up loan",
    ],
  };
  return map[stage] ?? ["No specific actions identified for current stage"];
}

/** Returns the full standardised Nova customer journey as a reference document */
export function getNovaSopJourney(): string {
  return `
═══════════════════════════════════════════════════════════════════
     NOVA MICROFINANCE – STANDARD CUSTOMER JOURNEY (SOP)
═══════════════════════════════════════════════════════════════════

STAGE 1: LEAD / PROSPECT
  Actor: Loan Officer
  Activities:
    • Client walk-in or field referral
    • Explain products (HAOJUE, TVS, HONDA, SIMBA BOSS, SIMBA RAPTOR)
    • Pre-qualification: income, employment, guarantor availability
    • CRB pre-screen (verbal)
  System: Create client record in Mifos X

STAGE 2: APPLICATION
  Actor: Loan Officer
  Activities:
    • Collect documents: NIN, passport photo, guarantor docs, boda reg
    • Complete loan application form in Mifos X
    • Attach required files to loan record
    • Submit for credit review
  System: POST /loans (status → submitted)

STAGE 3: CREDIT REVIEW
  Actor: Credit Analyst
  Activities:
    • Verify all documents
    • Run formal CRB check (post CRB fee: UGX 5,000)
    • Complete credit scoring worksheet
    • Write assessment note on loan in Mifos X
    • ⚡ System notifies Loan Officer & Manager of note via WhatsApp
  System: Add notes to loan, trigger notification

STAGE 4: MANAGER APPROVAL
  Actor: Branch Manager
  Activities:
    • Review credit analyst note
    • Approve or reject with written reason in Mifos X
    • ⚡ System notifies Loan Officer of decision via WhatsApp
  System: POST /loans/{id}?command=approve|reject

STAGE 5: COMPLIANCE CHECK
  Actor: Compliance / Checker
  Activities:
    • Verify GL product mapping is active
    • Confirm down payment amount matches product schedule
    • Sign off compliance checklist
  System: validate_loan_topup, audit_gl_mapping tools

STAGE 6: DOWN PAYMENT
  Actor: Teller / Loan Officer
  Activities:
    • Receive down payment (MTN/Airtel/YO/Cash)
    • Run calculate_deposit_breakdown to get GL posting
    • Post breakdown to Fineract journal entries
    • DR: Bank/Mobile Money receipt account
    • CR: Tracking Payable / Insurance / Fees / Wallet (per schedule)
    • ⚡ System notifies Officer of down payment receipt
  System: calculate_deposit_breakdown → post_deposit_to_gl

STAGE 7: DISBURSEMENT
  Actor: Loan Officer / Teller
  Activities:
    • Transfer loan amount to client (MTN/Airtel/cash)
    • Record disbursement in Mifos X
    • Set up standing instruction for repayments (if applicable)
    • Send repayment schedule to client
    • ⚡ Client receives WhatsApp/SMS: disbursement confirmation + schedule
  System: POST /loans/{id}?command=disburse

STAGE 8: ACTIVE REPAYMENT
  Actor: System / Teller
  Activities:
    • Standing instruction auto-debit OR manual payment via MTN/Airtel/YO
    • HUB reconciliation: upload CSV, match payments, post to Fineract
    • ⚡ Client receives payment confirmation via WhatsApp/SMS
    • ⚡ Loan Officer notified of any missed payments
  System: HUB reconciliation, standing instruction batch job

STAGE 9A: ARREARS (if overdue)
  Actor: Loan Officer / Management
  Activities:
    1–30 days:  Phone call + WhatsApp reminder
    31–60 days: Field visit + formal notice
    61–90 days: Management escalation + payment plan negotiation
    91–180 days: Restructuring assessment
    180+ days:  Repossession assessment or write-off

STAGE 9B: RESTRUCTURED
  Actor: Manager / Credit Analyst
  Activities:
    • Reschedule via /rescheduleloans
    • ⚡ Notify officer and client of new schedule

STAGE 9C: REPOSSESSION
  Actor: Field Officer / Manager
  Activities:
    • Document asset recovery
    • Charge-off in Mifos X: POST /loans/{id}?command=chargeOff
    • Value and sell asset
    • Post recovery proceeds as repayment

STAGE 10: CLOSED
  Actor: System
  Activities:
    • Loan fully repaid / closed
    • Issue clearance letter
    • Assess top-up eligibility
    • ⚡ Client receives WhatsApp: "Loan fully repaid. Thank you!"

═══════════════════════════════════════════════════════════════════
  COMMUNICATION MATRIX (WhatsApp/SMS triggers)
═══════════════════════════════════════════════════════════════════
  Event                          Recipient          Channel
  ─────────────────────────────────────────────────────────
  Note added on loan             Loan Officer       WhatsApp
  Approval required              Checker/Manager    WhatsApp
  Loan approved/rejected         Loan Officer       WhatsApp
  Down payment received          Loan Officer       WhatsApp
  Loan disbursed                 Client             WhatsApp+SMS
  Payment received               Client             SMS
  Payment overdue (Day 1)        Client             SMS
  Payment overdue (Day 3)        Client + Officer   WhatsApp
  Payment overdue (Day 7+)       Officer + Manager  WhatsApp
  Standing instruction failed    Officer            WhatsApp
  Loan restructured              Officer + Client   WhatsApp
═══════════════════════════════════════════════════════════════════
`.trim();
}
