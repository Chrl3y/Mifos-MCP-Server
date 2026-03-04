/**
 * Tool: fineract_admin
 *
 * Full CRUD control over the Mifos X / Fineract platform:
 *  - Loan products (create, read, update)
 *  - GL accounts (create, read, update, enable/disable)
 *  - Users (list, create, update, assign roles)
 *  - Reports (list, run, create Stretchy reports)
 *  - Offices (list, create)
 *  - Charges & fees
 *  - Audit log
 *  - Webhooks (register, list, delete)
 *  - Codes & code values
 *  - Payment types
 */
import { FineractClient } from "../utils/fineract-client.js";
import { LoanProduct, GlAccount, FineractUser } from "../types/index.js";

// ─── LOAN PRODUCTS ──────────────────────────────────────────────────────────
export async function listLoanProducts(client: FineractClient): Promise<LoanProduct[]> {
  return client.get<LoanProduct[]>("/loanproducts");
}

export async function getLoanProduct(client: FineractClient, id: number): Promise<LoanProduct> {
  return client.get<LoanProduct>(`/loanproducts/${id}`);
}

export async function updateLoanProduct(
  client: FineractClient, id: number, updates: Record<string, unknown>
): Promise<{ resourceId: number }> {
  return client.put(`/loanproducts/${id}`, updates);
}

export async function createLoanProduct(
  client: FineractClient, product: Record<string, unknown>
): Promise<{ resourceId: number }> {
  return client.post("/loanproducts", product);
}

// ─── GL ACCOUNTS ────────────────────────────────────────────────────────────
export async function listGlAccounts(
  client: FineractClient,
  filters?: { type?: number; disabled?: boolean; usage?: number }
): Promise<GlAccount[]> {
  return client.get<GlAccount[]>("/glaccounts", filters as Record<string, unknown>);
}

export async function createGlAccount(
  client: FineractClient, account: {
    glCode: string; name: string; type: number; usage: number;
    manualEntriesAllowed?: boolean; parentId?: number; description?: string;
  }
): Promise<{ resourceId: number }> {
  return client.post("/glaccounts", account as Record<string, unknown>);
}

export async function updateGlAccount(
  client: FineractClient, id: number, updates: Record<string, unknown>
): Promise<{ resourceId: number }> {
  return client.put(`/glaccounts/${id}`, updates);
}

// ─── USERS ──────────────────────────────────────────────────────────────────
export async function listUsers(client: FineractClient): Promise<FineractUser[]> {
  return client.get<FineractUser[]>("/users");
}

export async function getUser(client: FineractClient, id: number): Promise<FineractUser> {
  return client.get<FineractUser>(`/users/${id}`);
}

export async function createUser(client: FineractClient, user: {
  username: string; firstname: string; lastname: string; email: string;
  officeId: number; roles: number[]; staffId?: number; password?: string;
}): Promise<{ resourceId: number }> {
  return client.post("/users", user as Record<string, unknown>);
}

export async function updateUser(
  client: FineractClient, id: number, updates: Record<string, unknown>
): Promise<{ resourceId: number }> {
  return client.put(`/users/${id}`, updates);
}

// ─── CHARGES / FEES ─────────────────────────────────────────────────────────
export async function listCharges(client: FineractClient): Promise<unknown[]> {
  return client.get<unknown[]>("/charges");
}

export async function createCharge(client: FineractClient, charge: {
  name: string; currencyCode: string; amount: number;
  chargeAppliesTo: number;  // 1=Loan, 2=Savings
  chargeTimeType: number;   // 1=Disbursement, 2=Specified Due, 4=Instalment Fee
  chargeCalculationType: number; // 1=Flat, 2=% Amount, 3=% LoanInterest
  active: boolean;
}): Promise<{ resourceId: number }> {
  return client.post("/charges", charge as Record<string, unknown>);
}

// ─── OFFICES ────────────────────────────────────────────────────────────────
export async function listOffices(client: FineractClient): Promise<unknown[]> {
  return client.get<unknown[]>("/offices");
}

export async function createOffice(client: FineractClient, office: {
  name: string; parentId: number; openingDate: string; dateFormat?: string; locale?: string;
}): Promise<{ resourceId: number }> {
  return client.post("/offices", {
    dateFormat: "dd MMMM yyyy", locale: "en", ...office,
  } as Record<string, unknown>);
}

// ─── PAYMENT TYPES ──────────────────────────────────────────────────────────
export async function listPaymentTypes(client: FineractClient): Promise<unknown[]> {
  return client.get<unknown[]>("/paymenttypes");
}

export async function createPaymentType(client: FineractClient, name: string, description?: string, isCash?: boolean): Promise<{ resourceId: number }> {
  return client.post("/paymenttypes", { name, description: description ?? name, isCash: isCash ?? false, position: 1 });
}

// ─── REPORTS (STRETCHY) ─────────────────────────────────────────────────────
export async function listReports(client: FineractClient): Promise<unknown[]> {
  return client.get<unknown[]>("/reports");
}

export async function runReport(
  client: FineractClient,
  reportName: string,
  params: Record<string, string>,
  outputType: "JSON" | "CSV" | "XLS" = "JSON"
): Promise<unknown> {
  const queryParams = Object.entries(params)
    .reduce((acc, [k, v]) => ({ ...acc, [`R_${k}`]: v }), {});
  return client.get(`/runreports/${encodeURIComponent(reportName)}`, {
    "output-type": outputType,
    genericResultSet: true,
    ...queryParams,
  });
}

export async function createReport(client: FineractClient, report: {
  reportName: string;
  reportType: string;   // "Table" | "Pentaho"
  reportSubType?: string;
  reportCategory?: string;
  reportSql: string;
  description?: string;
  useReport?: boolean;
}): Promise<{ resourceId: number }> {
  return client.post("/reports", { useReport: true, ...report } as Record<string, unknown>);
}

export async function updateReport(
  client: FineractClient, id: number, updates: Record<string, unknown>
): Promise<{ resourceId: number }> {
  return client.put(`/reports/${id}`, updates);
}

// ─── WEBHOOKS ───────────────────────────────────────────────────────────────
export async function listWebhooks(client: FineractClient): Promise<unknown[]> {
  return client.get<unknown[]>("/hooks");
}

export async function createWebhook(client: FineractClient, webhook: {
  name: string;
  displayName?: string;
  isActive?: boolean;
  payloadURL: string;
  contentType?: string;
  events?: Array<{ actionName: string; entityName: string }>;
  headers?: Record<string, string>;
}): Promise<{ resourceId: number }> {
  return client.post("/hooks", {
    name: webhook.name,
    displayName: webhook.displayName ?? webhook.name,
    isActive: webhook.isActive ?? true,
    payloadURL: webhook.payloadURL,
    contentType: webhook.contentType ?? "json",
    events: webhook.events ?? [
      { actionName: "CREATE", entityName: "LOAN" },
      { actionName: "APPROVE", entityName: "LOAN" },
      { actionName: "DISBURSE", entityName: "LOAN" },
      { actionName: "CREATE", entityName: "REPAYMENT" },
      { actionName: "CREATE", entityName: "NOTE" },
    ],
    headers: webhook.headers ? Object.entries(webhook.headers).map(([k, v]) => ({ name: k, value: v })) : [],
  } as Record<string, unknown>);
}

export async function deleteWebhook(client: FineractClient, id: number): Promise<{ resourceId: number }> {
  return client.delete(`/hooks/${id}`);
}

// ─── AUDIT LOG ──────────────────────────────────────────────────────────────
export async function getAuditLog(
  client: FineractClient,
  filters?: {
    actionName?: string;
    entityName?: string;
    makerId?: number;
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }
): Promise<unknown[]> {
  const params: Record<string, unknown> = {
    limit: filters?.limit ?? 100,
    ...(filters?.actionName  ? { actionName: filters.actionName }  : {}),
    ...(filters?.entityName  ? { entityName: filters.entityName }  : {}),
    ...(filters?.makerId     ? { makerId:    filters.makerId }     : {}),
    ...(filters?.fromDate    ? { fromMakerDate: filters.fromDate } : {}),
    ...(filters?.toDate      ? { toMakerDate:   filters.toDate }   : {}),
  };
  return client.get<unknown[]>("/audits", params);
}

// ─── STAFF ──────────────────────────────────────────────────────────────────
export async function listStaff(client: FineractClient, officeId?: number): Promise<unknown[]> {
  const params = officeId ? { officeId } : {};
  return client.get<unknown[]>("/staff", params as Record<string, unknown>);
}

export async function createStaff(client: FineractClient, staff: {
  firstname: string; lastname: string; officeId: number;
  isLoanOfficer?: boolean; mobileNo?: string; emailAddress?: string;
}): Promise<{ resourceId: number }> {
  return client.post("/staff", { isActive: true, isLoanOfficer: true, ...staff } as Record<string, unknown>);
}

// ─── LOAN LIFECYCLE ─────────────────────────────────────────────────────────
export async function approveLoan(
  client: FineractClient, loanId: number,
  params: { approvedOnDate: string; note?: string }
): Promise<{ resourceId: number }> {
  return client.post(`/loans/${loanId}?command=approve`, {
    dateFormat: "dd MMMM yyyy", locale: "en",
    approvedOnDate: params.approvedOnDate,
    note: params.note ?? "",
  });
}

export async function disburseLoan(
  client: FineractClient, loanId: number,
  params: { actualDisbursementDate: string; paymentTypeId?: number; note?: string }
): Promise<{ resourceId: number }> {
  return client.post(`/loans/${loanId}?command=disburse`, {
    dateFormat: "dd MMMM yyyy", locale: "en",
    actualDisbursementDate: params.actualDisbursementDate,
    paymentTypeId: params.paymentTypeId ?? 1,
    note: params.note ?? "",
  });
}

export async function rejectLoan(
  client: FineractClient, loanId: number, reason: string
): Promise<{ resourceId: number }> {
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  return client.post(`/loans/${loanId}?command=reject`, {
    dateFormat: "dd MMMM yyyy", locale: "en",
    rejectedOnDate: today,
    note: reason,
  });
}

export async function addLoanNote(
  client: FineractClient, loanId: number, note: string
): Promise<{ resourceId: number }> {
  return client.post(`/loans/${loanId}/notes`, { note });
}

export async function getLoanNotes(
  client: FineractClient, loanId: number
): Promise<Array<{ id: number; note: string; createdBy: string; createdOn: string }>> {
  return client.get(`/loans/${loanId}/notes`);
}
