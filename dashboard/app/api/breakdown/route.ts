import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";

// Load fee schedules at startup
const schedulesPath = path.resolve(process.cwd(), "../src/config/product-fee-schedules.json");
let schedules: Record<string, unknown>;
try {
  schedules = JSON.parse(readFileSync(schedulesPath, "utf-8"));
} catch {
  schedules = {};
}

interface FeeComponent {
  name: string;
  glCode: string;
  glType: string;
  direction: "DR" | "CR";
  calcType: "fixed" | "pct_loan" | "pct_dp" | "remainder";
  value: number;
}

interface ProductSchedule {
  label: string;
  loanGlCode: string;
  currency: string;
  downPaymentPct: number;
  components: FeeComponent[];
  paymentChannels: Record<string, number>;
}

function fmt(n: number) {
  return n.toLocaleString("en-UG", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { productKey, totalReceived, loanAmount, paymentChannel, clientName, loanAccountNo, transactionDate } = body;

    if (!productKey || !totalReceived || !loanAmount || !paymentChannel) {
      return NextResponse.json({ error: "Missing required fields: productKey, totalReceived, loanAmount, paymentChannel" }, { status: 400 });
    }

    const product = (schedules as Record<string, ProductSchedule>)[productKey];
    if (!product) {
      return NextResponse.json({ error: `Product '${productKey}' not found. Available: ${Object.keys(schedules).join(", ")}` }, { status: 404 });
    }

    const downPayment = loanAmount * (product.downPaymentPct / 100);
    const lines: Array<{ name: string; glCode: string; direction: "DR" | "CR"; amount: number; note: string }> = [];
    let totalAllocated = 0;

    // DR line: cash received
    const channelGlCode = product.paymentChannels?.[paymentChannel]?.toString() ?? "1000";
    lines.push({ name: `Cash / ${paymentChannel}`, glCode: channelGlCode, direction: "DR", amount: totalReceived, note: "Total received from client" });

    // CR lines per fee component
    for (const comp of product.components) {
      if (comp.direction !== "CR") continue;
      if (comp.calcType === "remainder") continue; // handled last

      let amount = 0;
      if (comp.calcType === "fixed") amount = comp.value;
      else if (comp.calcType === "pct_loan") amount = Math.round(loanAmount * comp.value / 100);
      else if (comp.calcType === "pct_dp") amount = Math.round(downPayment * comp.value / 100);

      lines.push({ name: comp.name, glCode: comp.glCode, direction: "CR", amount, note: comp.calcType === "fixed" ? `Fixed fee` : `${comp.value}% of ${comp.calcType === "pct_loan" ? "loan" : "down payment"}` });
      totalAllocated += amount;
    }

    // Remainder to wallet
    const remainderComp = product.components.find(c => c.calcType === "remainder");
    const walletAmount = totalReceived - totalAllocated;
    if (remainderComp && walletAmount > 0) {
      lines.push({ name: remainderComp.name, glCode: remainderComp.glCode, direction: "CR", amount: walletAmount, note: "Loan repayment wallet (remainder)" });
    }

    const totalDr = lines.filter(l => l.direction === "DR").reduce((s, l) => s + l.amount, 0);
    const totalCr = lines.filter(l => l.direction === "CR").reduce((s, l) => s + l.amount, 0);

    return NextResponse.json({
      productKey,
      productLabel: product.label,
      clientName: clientName ?? "—",
      loanAccountNo: loanAccountNo ?? "—",
      transactionDate: transactionDate ?? new Date().toISOString().slice(0, 10),
      currency: product.currency,
      loanAmount,
      downPayment,
      totalReceived,
      lines,
      totalDr,
      totalCr,
      balanced: Math.abs(totalDr - totalCr) < 1,
      walletAmount: walletAmount > 0 ? walletAmount : 0,
      summary: `${clientName ?? "Client"} | ${product.label} | ${fmt(totalReceived)} UGX received | Wallet: ${fmt(walletAmount > 0 ? walletAmount : 0)} UGX`,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
