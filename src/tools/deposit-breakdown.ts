/**
 * Tool: calculate_deposit_breakdown / post_deposit_to_gl
 *
 * Splits a client's incoming payment into the correct GL posting lines
 * based on product fee schedule. Supports HAOJUE, SIMBA BOSS, SIMBA RAPTOR,
 * TVS, HONDA and any custom product defined in product-fee-schedules.json.
 *
 * DR side: Bank / MTN / Airtel / YO receipt account (total received)
 * CR side: All fee and wallet components per schedule
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  DepositBreakdownResult, BreakdownLine, ProductFeeSchedule, FeeComponent
} from "../types/index.js";
import { fmt, textTable } from "../utils/formatter.js";
import { FineractClient } from "../utils/fineract-client.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const SCHEDULE_PATH = resolve(__dir, "../config/product-fee-schedules.json");

interface FeeScheduleConfig {
  products: Record<string, ProductFeeSchedule>;
  paymentChannels: Record<string, { glCode: string; name: string }>;
}

function loadSchedules(): FeeScheduleConfig {
  return JSON.parse(readFileSync(SCHEDULE_PATH, "utf-8")) as FeeScheduleConfig;
}

export function listProducts(): string[] {
  return Object.keys(loadSchedules().products);
}

export function calculateDepositBreakdown(params: {
  productKey: string;
  totalReceived: number;
  loanAmount: number;
  paymentChannel: string;
  clientName?: string;
  loanAccountNo?: string;
  transactionDate?: string;
}): DepositBreakdownResult {
  const { productKey, totalReceived, loanAmount, paymentChannel } = params;
  const schedules = loadSchedules();
  const schedule = schedules.products[productKey.toUpperCase()];
  if (!schedule) {
    const available = Object.keys(schedules.products).join(", ");
    throw new Error(`Unknown product key '${productKey}'. Available: ${available}`);
  }

  const channel = schedules.paymentChannels[paymentChannel.toUpperCase()]
    ?? { glCode: "1000", name: paymentChannel };

  const lines: BreakdownLine[] = [];
  let totalCr = 0;
  let remainderAllocated = false;
  let walletAmount = 0;

  // DR line: the receipt
  lines.push({
    account: channel.name,
    glCode: channel.glCode,
    glType: "ASSET",
    dr: totalReceived,
    cr: 0,
    calcBasis: "total received",
    note: `Payment via ${paymentChannel}`,
  });

  // CR lines: fee components (all except remainder)
  for (const comp of schedule.components) {
    if (comp.calcType === "remainder") continue;
    const amount = calcAmount(comp, loanAmount, totalReceived);
    lines.push({
      account: comp.name,
      glCode: comp.glCode,
      glType: comp.glType,
      dr: comp.direction === "DR" ? amount : 0,
      cr: comp.direction === "CR" ? amount : 0,
      calcBasis: describeBasis(comp, loanAmount, totalReceived),
      note: comp.note,
    });
    if (comp.direction === "CR") totalCr += amount;
  }

  // Remainder → wallet
  const remainder = totalReceived - totalCr;
  const walletComp = schedule.components.find(c => c.calcType === "remainder");
  if (walletComp && remainder > 0) {
    walletAmount = remainder;
    remainderAllocated = true;
    lines.push({
      account: walletComp.name,
      glCode: walletComp.glCode,
      glType: walletComp.glType,
      dr: 0,
      cr: remainder,
      calcBasis: `remainder after fees (${fmt(totalReceived)} − ${fmt(totalCr)})`,
      note: walletComp.note,
    });
    totalCr += remainder;
  }

  const totalDr = totalReceived;
  const balanced = Math.abs(totalDr - totalCr) < 1;

  const formattedTable = buildFormattedTable(
    schedule.label, totalReceived, params.clientName, params.loanAccountNo,
    params.transactionDate ?? new Date().toISOString().split("T")[0], lines, balanced
  );

  const journalEntryPayload = buildJournalEntryPayload(
    lines, params.transactionDate ?? new Date().toISOString().split("T")[0],
    params.clientName, schedule.label
  );

  return {
    product: schedule.label,
    totalReceived,
    loanAmount,
    paymentChannel: channel.name,
    lines,
    totalDr,
    totalCr,
    balanced,
    walletAmount,
    formattedTable,
    journalEntryPayload,
  };
}

function calcAmount(comp: FeeComponent, loanAmount: number, dp: number): number {
  switch (comp.calcType) {
    case "fixed":     return comp.value;
    case "pct_loan":  return Math.round(loanAmount * comp.value);
    case "pct_dp":    return Math.round(dp * comp.value);
    default:          return 0;
  }
}

function describeBasis(comp: FeeComponent, loan: number, dp: number): string {
  switch (comp.calcType) {
    case "fixed":    return `fixed`;
    case "pct_loan": return `${(comp.value * 100).toFixed(1)}% × loan ${fmt(loan)}`;
    case "pct_dp":   return `${(comp.value * 100).toFixed(1)}% × down payment ${fmt(dp)}`;
    default:         return "";
  }
}

function buildFormattedTable(
  product: string, total: number, client: string | undefined,
  accountNo: string | undefined, date: string,
  lines: BreakdownLine[], balanced: boolean
): string {
  const header = [
    `POSTING DOWN PAYMENT BREAKDOWN`,
    `━`.repeat(72),
    `Product  : ${product}`,
    client   ? `Client   : ${client}`    : "",
    accountNo? `Loan A/C : ${accountNo}` : "",
    `Date     : ${date}`,
    `━`.repeat(72),
  ].filter(Boolean).join("\n");

  const rows = lines.map(l => [
    l.account.substring(0, 36),
    l.dr  > 0 ? fmt(l.dr)  : "",
    l.cr  > 0 ? fmt(l.cr)  : "",
    fmt(Math.max(l.dr, l.cr)),
    l.calcBasis,
  ]);

  const table = textTable(
    ["Account", "DR (UGX)", "CR (UGX)", "Amount", "Basis"],
    rows,
    [36, 14, 14, 14, 32]
  );

  const footer = [
    `━`.repeat(72),
    `TOTAL DR : ${fmt(total).padStart(12)} UGX`,
    `TOTAL CR : ${fmt(lines.reduce((s,l)=>s+l.cr,0)).padStart(12)} UGX`,
    balanced ? `✅  BALANCED` : `❌  IMBALANCED — review fee schedule`,
    `━`.repeat(72),
  ].join("\n");

  return `${header}\n${table}\n${footer}`;
}

function buildJournalEntryPayload(
  lines: BreakdownLine[], date: string, client?: string, product?: string
): object {
  const dateFormatted = date.replace(/-/g, " ").replace(/(\d{4}) (\d{2}) (\d{2})/, "$3 $2 $1");
  // reformat to "dd MM yyyy"
  const [y, m, d] = date.split("-");
  const formatted = `${d} ${m} ${y}`;

  return {
    officeId: 1,
    transactionDate: formatted,
    dateFormat: "dd MM yyyy",
    locale: "en",
    currencyCode: "UGX",
    comments: `Down payment – ${product ?? "loan product"} – ${client ?? "client"}`,
    debits: lines
      .filter(l => l.dr > 0)
      .map(l => ({ glAccountId: l.glCode, amount: l.dr, comments: l.account })),
    credits: lines
      .filter(l => l.cr > 0)
      .map(l => ({ glAccountId: l.glCode, amount: l.cr, comments: l.account })),
  };
}

/** Post the calculated breakdown directly to Fineract GL */
export async function postDepositToGL(
  client: FineractClient,
  breakdown: DepositBreakdownResult,
  officeId: number = 1
): Promise<{ success: boolean; journalEntryId?: number; message: string }> {
  if (!breakdown.balanced) {
    return { success: false, message: "Cannot post: breakdown is not balanced. Check fee schedule." };
  }
  try {
    const payload = { ...breakdown.journalEntryPayload as Record<string, unknown>, officeId };
    const result = await client.post<{ resourceId: number }>("/journalentries", payload);
    return {
      success: true,
      journalEntryId: result.resourceId,
      message: `Journal entry posted successfully. ID: ${result.resourceId}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `GL posting failed: ${msg}` };
  }
}
