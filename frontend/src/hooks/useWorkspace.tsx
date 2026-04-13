import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useParams, Navigate, useLocation } from "react-router-dom";
import { setWorkspaceId } from "../lib/api";

const STORAGE_KEY = "myWorkspaceId";

export function generateWorkspaceId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function getOrCreateHomeWorkspaceId(): string {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const newId = generateWorkspaceId();
  localStorage.setItem(STORAGE_KEY, newId);
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
