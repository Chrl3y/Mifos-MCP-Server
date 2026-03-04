import { FineractClient } from "../utils/fineract-client.js";
import { AuditResult } from "../types/index.js";

const REQUIRED = ["fundSourceAccountId","loanPortfolioAccountId","transfersInSuspenseAccountId",
  "interestOnLoanAccountId","incomeFromFeeAccountId","incomeFromPenaltyAccountId",
  "writeOffAccountId","overpaymentLiabilityAccountId"];

export async function auditGlMapping(client: FineractClient, productId?: number): Promise<AuditResult[]> {
  const results: AuditResult[] = [];
  const glAccounts: any[] = await client.get("/glaccounts");
  const glMap = new Map(glAccounts.map((g: any) => [g.id, g]));
  results.push({ checkName: "GL Accounts", status: "INFO", message: `${glAccounts.length} accounts (${glAccounts.filter((g:any)=>g.disabled).length} disabled)` });

  const products: any[] = productId
    ? [await client.get(`/loanproducts/${productId}`)]
    : await client.get("/loanproducts");

  for (const p of products) {
    const detail: any = await client.get(`/loanproducts/${p.id}`);
    const label = `[${p.id}] ${p.name}`;
    if (!detail.accountingRule || detail.accountingRule.value === "NONE") {
      results.push({ checkName: `Accounting Rule – ${label}`, status: "FAIL", issueRef: "MF-002, ISS-010",
        message: "No accounting rule set. GL posting will NOT occur.",
        suggestedFix: "Set accountingRule to 2 (CASH_BASED) or 3 (ACCRUAL_PERIODIC)" });
      continue;
    }
    results.push({ checkName: `Accounting Rule – ${label}`, status: "PASS", message: detail.accountingRule.value });
    const mappings = detail.accountingMappings ?? {};
    for (const req of REQUIRED) {
      const m = mappings[req];
      if (!m) {
        results.push({ checkName: `${req} – ${label}`, status: "FAIL", issueRef: "MF-002",
          message: `Missing GL mapping for ${req}`, suggestedFix: `Add ${req} to product config` });
        continue;
      }
      const gl = glMap.get(m.id) as any;
      if (!gl) { results.push({ checkName: `${req} – ${label}`, status: "FAIL", message: `GL ${m.glCode} not found in chart` }); continue; }
      if (gl.disabled) { results.push({ checkName: `${req} – ${label}`, status: "FAIL", issueRef: "MF-002", message: `GL ${gl.glCode} (${gl.name}) is DISABLED`, suggestedFix: `Re-enable GL ${gl.glCode}` }); continue; }
      results.push({ checkName: `${req} – ${label}`, status: "PASS", message: `${gl.glCode} – ${gl.name}` });
    }
  }
  return results;
}
