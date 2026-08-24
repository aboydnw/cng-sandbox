import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useParams, Navigate, useLocation } from "react-router-dom";
import { setWorkspaceId } from "../lib/api";
import { getExampleState, seedExampleData } from "../lib/examples/api";

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
  const [examplesRevision, setExamplesRevision] = useState(0);

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
    let cancelled = false;

    // Workspace URLs are shareable and may be opened before this browser ever
    // minted the id. Seed every untouched workspace once, while respecting an
    // explicit "removed" state so examples never reappear against user intent.
    getExampleState(activeId)
      .then(async (state) => {
        if (state.state !== "none") return;
        await seedExampleData(activeId);
        // Resource views may have completed their first GET while examples
        // were being cloned. Remount once so they immediately read the copies.
        if (!cancelled) setExamplesRevision((revision) => revision + 1);
      })
      .catch((err) => {
        // Example setup is best-effort; a temporary failure must not prevent
        // users from reaching their own workspace content. Report it anyway —
        // swallowing it silently makes a failed seed look identical to a
        // genuinely empty workspace, which is indistinguishable to the user
        // and invisible in a bug report.
        console.error("Example data setup failed for this workspace", err);
      });

    return () => {
      cancelled = true;
    };
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
      <Fragment key={`${activeId}-${examplesRevision}`}>{children}</Fragment>
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
