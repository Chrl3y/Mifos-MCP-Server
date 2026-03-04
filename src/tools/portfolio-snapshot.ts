import { FineractClient } from "../utils/fineract-client.js";
import { AuditResult, PortfolioSnapshot } from "../types/index.js";
import { dateFromArray, fmt } from "../utils/formatter.js";

export async function getPortfolioSnapshot(
  client: FineractClient, asOfDate?: string
): Promise<{ snapshot: PortfolioSnapshot; audits: AuditResult[] }> {
  const audits: AuditResult[] = [];
  const date = asOfDate ?? new Date().toISOString().split("T")[0];

  let loans: any[] = [];
  try {
    loans = await client.getAllPages("/loans", {
      loanStatus: "active",
      fields: "id,accountNo,clientName,loanProductName,loanOfficerName,loanOfficerId,status,summary,inArrears",
    });
  } catch (e) {
    audits.push({ checkName: "Loan Fetch", status: "FAIL", message: String(e) });
    return { snapshot: emptySnapshot(date), audits };
  }

  audits.push({ checkName: "Loans Loaded", status: "INFO", message: `${loans.length} active loans` });

  const snap = emptySnapshot(date);
  const aging: Record<string, { count: number; outstanding: number }> = {
    "Current": { count: 0, outstanding: 0 },
    "1-30 days": { count: 0, outstanding: 0 },
    "31-60 days": { count: 0, outstanding: 0 },
    "61-90 days": { count: 0, outstanding: 0 },
    "91-180 days": { count: 0, outstanding: 0 },
    "181+ days": { count: 0, outstanding: 0 },
  };
  const freezeCandidates: any[] = [];
  let overduePortfolio = 0;

  for (const loan of loans) {
    const outstanding = loan.summary?.totalOutstanding ?? 0;
    const overdue = loan.summary?.totalOverdue ?? 0;
    snap.totalActiveLoans++;
    snap.totalOutstanding += outstanding;
    snap.totalOverdue += overdue;

    // Aging bucket (approximate)
    const daysOv = overdue > 0 ? estimateDays(loan) : 0;
    const bucket = daysOv <= 0 ? "Current"
      : daysOv <= 30  ? "1-30 days"
      : daysOv <= 60  ? "31-60 days"
      : daysOv <= 90  ? "61-90 days"
      : daysOv <= 180 ? "91-180 days"
      : "181+ days";
    aging[bucket].count++;
    aging[bucket].outstanding += outstanding;
    if (overdue > 0) overduePortfolio += loan.summary?.principalOutstanding ?? 0;

    // Product
    const prod = loan.loanProductName ?? "Other";
    if (!snap.byProduct[prod]) snap.byProduct[prod] = { count: 0, outstanding: 0, overdue: 0 };
    snap.byProduct[prod].count++; snap.byProduct[prod].outstanding += outstanding; snap.byProduct[prod].overdue += overdue;

    // Officer
    const off = loan.loanOfficerName ?? "Unassigned";
    if (!snap.byOfficer[off]) snap.byOfficer[off] = { count: 0, outstanding: 0, overdue: 0 };
    snap.byOfficer[off].count++; snap.byOfficer[off].outstanding += outstanding; snap.byOfficer[off].overdue += overdue;

    if (daysOv > 180) freezeCandidates.push({ id: loan.id, account: loan.accountNo, client: loan.clientName, daysOv, outstanding });
  }

  snap.aging = aging;
  snap.parRatio = snap.totalOutstanding > 0 ? Math.round((overduePortfolio / snap.totalOutstanding) * 10000) / 100 : 0;
  snap.collectionEfficiency = snap.totalOutstanding > 0
    ? Math.round(((snap.totalOutstanding - snap.totalOverdue) / snap.totalOutstanding) * 10000) / 100 : 100;

  audits.push({
    checkName: "PAR Ratio",
    status: snap.parRatio > 10 ? "FAIL" : snap.parRatio > 5 ? "WARNING" : "PASS",
    message: `PAR: ${snap.parRatio}% | Collection efficiency: ${snap.collectionEfficiency}%`,
    issueRef: "RPT-006",
  });

  if (freezeCandidates.length) {
    audits.push({
      checkName: "Freeze Candidates (ISS-013)",
      status: "FAIL",
      message: `${freezeCandidates.length} loans overdue 180+ days still ACTIVE`,
      issueRef: "ISS-013",
      suggestedFix: "Use POST /loans/{id}/interestpauses or implement FROZEN status",
      details: { candidates: freezeCandidates as any },
    });
  }

  return { snapshot: snap, audits };
}

function estimateDays(loan: any): number {
  if (!loan.inArrears) return 0;
  return loan.repaymentEvery ? loan.repaymentEvery * 30 : 35;
}

function emptySnapshot(date: string): PortfolioSnapshot {
  return { asOfDate: date, totalActiveLoans: 0, totalDisbursed: 0, totalOutstanding: 0, totalOverdue: 0, parRatio: 0, collectionEfficiency: 0, byProduct: {}, byOfficer: {}, aging: {} };
}
