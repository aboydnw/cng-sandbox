/**
 * API client for the source.coop curated connection endpoint.
 */

export interface ConnectSourceCoopResponse {
  dataset_id: string;
  job_id: string;
}

export async function connectSourceCoop(
  productSlug: string,
  workspaceId: string,
): Promise<ConnectSourceCoopResponse> {
  const resp = await fetch("/api/connect-source-coop", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Workspace-Id": workspaceId,
    },
    body: JSON.stringify({ product_slug: productSlug }),
  });

  if (!resp.ok) {
    let detail: string;
    try {
      const body = await resp.json();
      detail = body?.detail ?? `Request failed: ${resp.status}`;
    } catch {
      detail = `Request failed: ${resp.status}`;
    }
    throw new Error(detail);
  }

  return resp.json();
}
