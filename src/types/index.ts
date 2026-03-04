// ─── Fineract Core ─────────────────────────────────────────────────────────
export interface FineractConfig {
  baseUrl: string;
  tenantId: string;
  username: string;
  password: string;
}

export type LoanStatusCode = "submitted" | "approved" | "active" | "closed" | "overpaid" | "written-off" | "chargedOff";

export interface LoanSummary {
  id: number;
  accountNo: string;
  clientName: string;
  clientId: number;
  productName: string;
  loanOfficerName?: string;
  loanOfficerId?: number;
  status: { value: LoanStatusCode; active?: boolean; approved?: boolean };
  summary: {
    principalOutstanding: number;
    interestOutstanding: number;
    totalOutstanding: number;
    totalOverdue: number;
    principalDisbursed: number;
    totalRepaymentExpected: number;
    totalRepayment: number;
  };
  inArrears?: boolean;
  timeline?: {
    submittedOnDate?: number[];
    approvedOnDate?: number[];
    actualDisbursementDate?: number[];
    expectedMaturityDate?: number[];
  };
}

export interface LoanNote {
  id: number;
  loanId: number;
  clientId: number;
  note: string;
  createdBy: string;
  createdOn: string;
  updatedBy?: string;
  updatedOn?: string;
  noteType: { value: string };
}

export interface GlAccount {
  id: number;
  glCode: string;
  name: string;
  type: { value: string };
  usage: { value: string };
  disabled: boolean;
  manualEntriesAllowed: boolean;
  parentId?: number;
}

export interface StandingInstruction {
  id: number;
  name: string;
  status: { value: string };
  fromAccountType: { value: string };
  toAccountType: { value: string };
  fromAccount: { id: number; accountNo: string };
  toAccount: { id: number; accountNo: string };
  fromClient?: { id: number; displayName: string };
  amount: number;
  transferType: { value: string };
  recurrenceType: { value: string };
  nextDueDate?: number[];
}

export interface SavingsAccount {
  id: number;
  accountNo: string;
  clientName: string;
  clientId: number;
  productName: string;
  status: { value: string };
  summary: {
    accountBalance: number;
    availableBalance: number;
    totalDeposits: number;
    totalWithdrawals: number;
  };
}

export interface LoanTransaction {
  id: number;
  type: { value: string; code: string; deposit?: boolean; repayment?: boolean };
  date: number[];
  submittedOnDate?: number[];
  amount: number;
  outstandingLoanBalance?: number;
  manuallyReversed?: boolean;
  paymentDetailData?: {
    paymentType?: { id: number; name: string };
    accountNumber?: string;
    receiptNumber?: string;
    routingCode?: string;
  };
}

export interface FineractUser {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  email: string;
  officeId: number;
  officeName: string;
  roles: Array<{ id: number; name: string }>;
  staff?: { id: number; displayName: string };
}

export interface LoanProduct {
  id: number;
  name: string;
  shortName: string;
  currencyCode: string;
  principal: number;
  minPrincipal?: number;
  maxPrincipal?: number;
  numberOfRepayments: number;
  repaymentEvery: number;
  repaymentFrequencyType: { value: string };
  interestRatePerPeriod: number;
  accountingRule?: { value: string };
  accountingMappings?: Record<string, { id: number; glCode: string; name: string }>;
}

// ─── Deposit Breakdown ─────────────────────────────────────────────────────
export type CalcType = "fixed" | "pct_loan" | "pct_dp" | "remainder";
export type GlDirection = "DR" | "CR";

export interface FeeComponent {
  name: string;
  glCode: string;
  glType: "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE";
  direction: GlDirection;
  calcType: CalcType;
  value: number;
  note?: string;
}

export interface ProductFeeSchedule {
  label: string;
  loanGlCode: string;
  currency: string;
  downPaymentPct: number;
  components: FeeComponent[];
}

export interface BreakdownLine {
  account: string;
  glCode: string;
  glType: string;
  dr: number;
  cr: number;
  calcBasis: string;
  note?: string;
}

export interface DepositBreakdownResult {
  product: string;
  totalReceived: number;
  loanAmount: number;
  paymentChannel: string;
  lines: BreakdownLine[];
  totalDr: number;
  totalCr: number;
  balanced: boolean;
  walletAmount: number;
  formattedTable: string;
  journalEntryPayload: object;
}

// ─── Notifications ─────────────────────────────────────────────────────────
export type NotificationChannel = "sms" | "whatsapp" | "both";
export type NotificationEvent =
  | "LOAN_NOTE_ADDED"
  | "LOAN_APPROVED"
  | "LOAN_REJECTED"
  | "LOAN_DISBURSED"
  | "LOAN_OVERDUE"
  | "CHECKER_ACTION_REQUIRED"
  | "LOAN_RESTRUCTURED"
  | "LOAN_CHARGE_OFF"
  | "PAYMENT_RECEIVED"
  | "STANDING_INSTRUCTION_FAILED"
  | "DOWN_PAYMENT_RECEIVED";

export interface NotificationPayload {
  event: NotificationEvent;
  recipientPhone: string;
  recipientName: string;
  message: string;
  channel: NotificationChannel;
  metadata?: Record<string, unknown>;
}

export interface NotificationResult {
  success: boolean;
  channel: NotificationChannel;
  recipient: string;
  messageId?: string;
  error?: string;
  cost?: string;
}

// ─── Action Queue ──────────────────────────────────────────────────────────
export interface ActionItem {
  loanId: number;
  accountNo: string;
  clientName: string;
  clientId: number;
  officerName?: string;
  officerPhone?: string;
  noteText: string;
  noteCreatedBy: string;
  noteCreatedOn: string;
  actionType: "REVIEW" | "ADJUST" | "APPROVE" | "DISBURSE" | "OTHER";
  priority: "HIGH" | "MEDIUM" | "LOW";
  loanStatus: string;
  daysPending: number;
}

// ─── Customer Journey ──────────────────────────────────────────────────────
export type JourneyStage =
  | "LEAD"
  | "APPLICATION"
  | "CREDIT_REVIEW"
  | "MANAGER_APPROVAL"
  | "COMPLIANCE_CHECK"
  | "DOWN_PAYMENT"
  | "DISBURSEMENT"
  | "ACTIVE_REPAYMENT"
  | "ARREARS"
  | "RESTRUCTURED"
  | "REPOSSESSED"
  | "CLOSED"
  | "WRITTEN_OFF";

export interface JourneyEvent {
  stage: JourneyStage;
  date: string;
  actor: string;
  description: string;
  daysInStage?: number;
  notes?: string;
}

export interface CustomerJourney {
  clientId: number;
  clientName: string;
  loanId: number;
  accountNo: string;
  product: string;
  currentStage: JourneyStage;
  daysInCurrentStage: number;
  events: JourneyEvent[];
  bottleneck?: string;
  nextActions: string[];
}

// ─── Audit ─────────────────────────────────────────────────────────────────
export interface AuditResult {
  checkName: string;
  status: "PASS" | "FAIL" | "WARNING" | "INFO";
  message: string;
  details?: Record<string, unknown>;
  issueRef?: string;
  suggestedFix?: string;
}

// ─── Portfolio ─────────────────────────────────────────────────────────────
export interface PortfolioSnapshot {
  asOfDate: string;
  totalActiveLoans: number;
  totalDisbursed: number;
  totalOutstanding: number;
  totalOverdue: number;
  parRatio: number;
  collectionEfficiency: number;
  byProduct: Record<string, { count: number; outstanding: number; overdue: number }>;
  byOfficer: Record<string, { count: number; outstanding: number; overdue: number; phone?: string }>;
  aging: Record<string, { count: number; outstanding: number }>;
}

// ─── Issue Register ────────────────────────────────────────────────────────
export type IssuePriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type IssueStatus =
  | "OPEN" | "NEW" | "IDENTIFIED" | "ESCALATED" | "AWAITING DEV"
  | "PENDING GUIDANCE" | "IN PROGRESS" | "RESOLVED" | "ENHANCEMENT" | "BUG" | "CONFIG";

export interface IssueRecord {
  id: string;
  domain: string;
  category: string;
  title: string;
  priority: IssuePriority;
  status: IssueStatus;
  description: string;
  businessImpact: string;
  rootCause?: string;
  suggestedFix?: string;
  assignedTo?: string;
  codebaseMapping?: {
    repo?: string; module?: string; package?: string;
    file?: string; relevantClasses?: string[]; frontendComponent?: string;
  };
}

export interface ReconciliationEntry {
  reference: string;
  amount: number;
  date: string;
  provider: "MTN" | "AIRTEL" | "YO" | "CASH" | "BANK";
  phone?: string;
  status: "MATCHED" | "UNMATCHED" | "PENDING" | "MISROUTED";
  matchedLoanId?: number;
  notes?: string;
}
