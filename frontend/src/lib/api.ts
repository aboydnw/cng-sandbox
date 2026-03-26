let _workspaceId = "";

export function setWorkspaceId(id: string): void {
  _workspaceId = id;
}

export function getWorkspaceId(): string {
  return _workspaceId;
}

export function workspaceFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (_workspaceId) {
    headers.set("X-Workspace-Id", _workspaceId);
  }
  return fetch(input, { ...init, headers });
}
