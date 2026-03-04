import axios from "axios";

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const api = axios.create({ baseURL: BASE });

// ---------------------------------------------------------------------------
// Demo data shown on GitHub Pages (no live backend)
// ---------------------------------------------------------------------------
const DEMO_RESPONSES: Record<string, unknown> = {
  get_portfolio_snapshot: {
    asAt: new Date().toISOString().slice(0, 10),
    totalActiveLoans: 312,
    totalPortfolioUGX: 487_500_000,
    parAmount: 38_200_000,
    par30Rate: 7.84,
    collectionEfficiency: 91.3,
    agingBuckets: [
      { label: "Current",  days: "0",      amount: 449_300_000, count: 287 },
      { label: "1-30 days", days: "1-30",  amount: 18_600_000,  count: 14  },
      { label: "31-60",    days: "31-60",  amount: 11_400_000,  count: 7   },
      { label: "61-90",    days: "61-90",  amount: 5_200_000,   count: 3   },
      { label: ">90 days", days: "90+",    amount: 3_000_000,   count: 1   },
    ],
    byProduct: [
      { product: "HAOJUE",         count: 128, disbursedUGX: 201_600_000, par: 5.2  },
      { product: "SIMBA BOSS 110", count: 89,  disbursedUGX: 133_500_000, par: 8.1  },
      { product: "SIMBA RAPTOR",   count: 62,  disbursedUGX: 99_200_000,  par: 10.4 },
      { product: "TVS",            count: 21,  disbursedUGX: 33_600_000,  par: 6.7  },
      { product: "HONDA",          count: 12,  disbursedUGX: 19_600_000,  par: 4.3  },
    ],
  },
  get_action_queue: [
    { id: "L-1042", officerName: "Lubega Kenneth", clientName: "Okello James",   note: "Please review repayment schedule and adjust installment dates", priority: "HIGH",   daysOpen: 3 },
    { id: "L-1078", officerName: "Anyayo Doreen",  clientName: "Nakato Sarah",   note: "Client requests top-up approval — confirm outstanding principal", priority: "HIGH",   daysOpen: 1 },
    { id: "L-0994", officerName: "Adongo Winnie",  clientName: "Mugisha Robert", note: "Down payment received via MTN — please verify and disburse",      priority: "MEDIUM", daysOpen: 2 },
  ],
  list_issues: "demo",
  default: { message: "Connect your live Mifos/Fineract instance to see real data.", demo: true },
};

export const callMcp = async (tool: string, args: Record<string, unknown> = {}): Promise<unknown> => {
  if (DEMO) {
    await new Promise(r => setTimeout(r, 400)); // simulate latency
    return DEMO_RESPONSES[tool] ?? DEMO_RESPONSES.default;
  }
  const { data } = await api.post(`/api/mcp/${tool}`, args);
  return data;
};

export const getEvents = async () => {
  if (DEMO) return { events: [], demo: true };
  return api.get("/api/events").then(r => r.data);
};

export const getHealth = async () => {
  if (DEMO) return { status: "demo", fineract: "not connected", demo: true };
  return api.get("/api/health").then(r => r.data);
};
