import { FineractClient } from "../utils/fineract-client.js";
import { AuditResult } from "../types/index.js";
import { fmt } from "../utils/formatter.js";

export async function validateTopUp(client: FineractClient, loanId: number, proposedAmount: number): Promise<{ ok: boolean; correctOffset: number; incorrectOffset: number; overstatedBy: number; message: string; audits: AuditResult[] }> {
  const loan: any = await client.get(`/loans/${loanId}`, { associations: "repaymentSchedule" });
  const principal = loan.summary?.principalOutstanding ?? 0;
  const interest  = loan.summary?.interestOutstanding  ?? 0;
  const futureInterest = (loan.repaymentSchedule?.periods ?? [])
    .filter((p: any) => !p.complete).reduce((s: number, p: any) => s + (p.interestDue ?? 0), 0);
  const correctOffset   = principal;
  const incorrectOffset = principal + (futureInterest || interest);
  const overstatedBy    = incorrectOffset - correctOffset;
  const ok = overstatedBy < 1;
  const msg = ok
    ? `✅ Offset correct: UGX ${fmt(correctOffset)} (principal only)`
    : `❌ Offset overstated by UGX ${fmt(overstatedBy)}. Use principalOutstanding (${fmt(principal)}) NOT totalOutstanding/principal+interest (${fmt(incorrectOffset)}). Net disbursement should be UGX ${fmt(proposedAmount - correctOffset)} not UGX ${fmt(proposedAmount - incorrectOffset)}.`;
  return {
    ok, correctOffset, incorrectOffset, overstatedBy, message: msg,
    audits: [{ checkName: `Top-Up Validation – ${loan.clientName} (${loan.accountNo})`, status: ok ? "PASS" : "FAIL", message: msg, issueRef: "ISS-001", suggestedFix: ok ? undefined : "Fix top-up in LoanWritePlatformServiceJpaRepositoryImpl: use getLoanSummary().getPrincipalOutstanding() only" }],
  };
}
