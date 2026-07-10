import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useParams, Navigate, useLocation } from "react-router-dom";
import { setWorkspaceId } from "../lib/api";
import { seedExampleData } from "../lib/examples/api";

export const WORKSPACE_STORAGE_KEY = "myWorkspaceId";
const STORAGE_KEY = WORKSPACE_STORAGE_KEY;

export function generateWorkspaceId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// Ids freshly minted by this app that still need their example data seeded.
// Populated during render (side-effect-free) and drained by an effect in
// WorkspaceProvider, so the POST fires exactly once and only for workspaces we
// created — never for shared or returning workspaces opened via a direct URL.
const pendingSeedIds = new Set<string>();

function getOrCreateHomeWorkspaceId(): string {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const newId = generateWorkspaceId();
  localStorage.setItem(STORAGE_KEY, newId);
  pendingSeedIds.add(newId);
  return newId;
}

export interface WorkspaceContextValue {
  workspaceId: string;
  isHomeWorkspace: boolean;
  workspacePath: (path: string) => string;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const activeId = workspaceId!;

  // Set workspace ID synchronously so child useEffect hooks (e.g. LibraryPage
  // data fetches) can read it on the first render cycle. A useEffect here would
  // race with child effects and lose on a fresh page load.
  setWorkspaceId(activeId);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, activeId);
    }
  }, [activeId]);

  useEffect(() => {
    if (!pendingSeedIds.has(activeId)) return;
    pendingSeedIds.delete(activeId);
    void seedExampleData(activeId).catch(() => {});
  }, [activeId]);

  const value = useMemo(
    () => ({
      workspaceId: activeId,
      isHomeWorkspace: activeId === localStorage.getItem(STORAGE_KEY),
      workspacePath: (path: string) => `/w/${activeId}${path}`,
    }),
    [activeId]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function WorkspaceRedirect() {
  const location = useLocation();
  const homeId = getOrCreateHomeWorkspaceId();
  const rest = location.pathname === "/" ? "" : location.pathname;
  return <Navigate to={`/w/${homeId}${rest}${location.search}`} replace />;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx)
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

export function useOptionalWorkspace(): WorkspaceContextValue | null {
  return useContext(WorkspaceContext);
}
