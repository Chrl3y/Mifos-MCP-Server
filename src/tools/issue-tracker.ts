import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { IssueRecord, IssuePriority, IssueStatus } from "../types/index.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const REG = resolve(__dir, "../config/issues-register.json");

interface Register { meta: Record<string,string>; issues: IssueRecord[]; systemicPatterns: string[]; priorityMatrix: Record<string,string[]>; }

const load = (): Register => JSON.parse(readFileSync(REG, "utf-8"));
const save = (r: Register) => writeFileSync(REG, JSON.stringify(r, null, 2));

export const listIssues = (f?: { domain?: string; priority?: IssuePriority; status?: IssueStatus; assignedTo?: string }) => {
  let issues = load().issues;
  if (f?.domain)     issues = issues.filter(i => i.domain.toLowerCase().includes(f.domain!.toLowerCase()));
  if (f?.priority)   issues = issues.filter(i => i.priority === f.priority);
  if (f?.status)     issues = issues.filter(i => i.status === f.status);
  if (f?.assignedTo) issues = issues.filter(i => i.assignedTo?.toLowerCase().includes(f.assignedTo!.toLowerCase()));
  return issues;
};

export const getIssue = (id: string) => load().issues.find(i => i.id === id);

export const updateStatus = (id: string, newStatus: IssueStatus, notes?: string): string => {
  const r = load();
  const iss = r.issues.find(i => i.id === id);
  if (!iss) return `Issue ${id} not found`;
  const old = iss.status;
  iss.status = newStatus;
  if (notes) iss.suggestedFix = (iss.suggestedFix ?? "") + `\n[${new Date().toISOString()}] ${notes}`;
  save(r);
  return `${id}: ${old} → ${newStatus}`;
};

export const issueSummary = () => {
  const issues = load().issues;
  const by = (key: keyof IssueRecord) => issues.reduce((acc, i) => ({ ...acc, [i[key] as string]: (acc[i[key] as string] ?? 0) + 1 }), {} as Record<string,number>);
  return { total: issues.length, byPriority: by("priority"), byStatus: by("status"), byDomain: by("domain") };
};

export const getPatterns = () => load().systemicPatterns;
