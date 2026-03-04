import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const FINERACT_BASE = process.env.FINERACT_BASE_URL ?? "http://localhost:8443/fineract-provider/api/v1";
const FINERACT_TENANT = process.env.FINERACT_TENANT_ID ?? "default";
const FINERACT_USER = process.env.FINERACT_USERNAME ?? "mifos";
const FINERACT_PASS = process.env.FINERACT_PASSWORD ?? "password";

function authHeader() {
  return "Basic " + Buffer.from(`${FINERACT_USER}:${FINERACT_PASS}`).toString("base64");
}

interface BreakdownLine {
  name: string;
  glCode: string;
  direction: "DR" | "CR";
  amount: number;
  note: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { breakdown, officeId } = body;

    if (!breakdown?.lines) {
      return NextResponse.json({ error: "Missing breakdown.lines" }, { status: 400 });
    }

    const lines: BreakdownLine[] = breakdown.lines;
    const debits = lines.filter((l) => l.direction === "DR").map((l) => ({ glAccountCode: l.glCode, amount: l.amount, comments: l.note }));
    const credits = lines.filter((l) => l.direction === "CR").map((l) => ({ glAccountCode: l.glCode, amount: l.amount, comments: l.note }));

    const payload = {
      officeId: officeId ?? 1,
      transactionDate: breakdown.transactionDate ?? new Date().toISOString().slice(0, 10),
      currencyCode: breakdown.currency ?? "UGX",
      debits,
      credits,
      comments: `Nova MCP – ${breakdown.summary ?? "Deposit breakdown"}`,
      dateFormat: "yyyy-MM-dd",
      locale: "en",
    };

    const resp = await axios.post(`${FINERACT_BASE}/journalentries`, payload, {
      headers: {
        Authorization: authHeader(),
        "Fineract-Platform-TenantId": FINERACT_TENANT,
        "Content-Type": "application/json",
      },
    });

    return NextResponse.json({ success: true, journalEntryId: resp.data.resourceId, message: `Journal entry ${resp.data.resourceId} posted successfully` });
  } catch (err: unknown) {
    const msg = axios.isAxiosError(err) ? (err.response?.data?.defaultUserMessage ?? err.message) : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
