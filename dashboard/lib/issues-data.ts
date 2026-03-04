import issuesRegister from "../../src/config/issues-register.json";

export interface Issue {
  id: string;
  domain: string;
  category: string;
  title: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  system: string;
  description: string;
  businessImpact?: string;
  rootCause?: string;
  codebaseMapping?: Record<string, unknown>;
  suggestedFix?: string;
  status: string;
  assignedTo?: string;
}

const issues: Issue[] = issuesRegister.issues as Issue[];
export default issues;
