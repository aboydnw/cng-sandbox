import type { LogEntry } from "./consoleCapture";

export interface BugReportPayload {
  description: string;
  page_url: string;
  dataset_id?: string;
  story_id?: string;
  dataset_ids?: string[];
  console_logs: LogEntry[];
}

interface BugReportResponse {
  issue_url: string;
}

export async function submitBugReport(payload: BugReportPayload): Promise<BugReportResponse> {
  const resp = await fetch("/api/bug-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    throw new Error("Unable to submit report. Please try again later.");
  }
  return resp.json();
}
