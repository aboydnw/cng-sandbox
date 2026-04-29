import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import {
  WorkspaceProvider,
  WorkspaceRedirect,
  useWorkspace,
} from "./hooks/useWorkspace";
import UploadPage from "./pages/UploadPage";
import MapPage from "./pages/MapPage";
import ExpiredPage from "./pages/ExpiredPage";
import DataPage from "./pages/DataPage";
import StoriesPage from "./pages/StoriesPage";
import StoryReaderPage from "./pages/StoryReaderPage";
import StoryEditorPage from "./pages/StoryEditorPage";
import StoryEmbedPage from "./pages/StoryEmbedPage";
import AboutPage from "./pages/AboutPage";
import DiscoverPage from "./pages/DiscoverPage";
import DiscoverDatasetPage from "./pages/DiscoverDatasetPage";
import { WelcomeToast } from "./components/WelcomeToast";
import { Toaster } from "./components/ui/toaster";
import { toaster } from "./lib/toaster";

const DevZarrSpike = lazy(() => import("./pages/DevZarrSpike"));

function StoryReaderRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/story/${id}`} replace />;
}

function DatasetsRedirect() {
  const { workspacePath } = useWorkspace();
  return <Navigate to={workspacePath("/data")} replace />;
}

function LibraryRedirect() {
  const { workspacePath } = useWorkspace();
  return <Navigate to={workspacePath("/data")} replace />;
}

function WorkspaceRoutes() {
  return (
    <WorkspaceProvider>
      <WelcomeToast />
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/map/:id" element={<MapPage />} />
        <Route path="/map/connection/:id" element={<MapPage />} />
        <Route path="/expired/:id" element={<ExpiredPage />} />
        <Route path="/data" element={<DataPage />} />
        <Route path="/stories" element={<StoriesPage />} />
        <Route path="/library" element={<LibraryRedirect />} />
        <Route path="/datasets" element={<DatasetsRedirect />} />
        <Route path="/story/new" element={<StoryEditorPage />} />
        <Route path="/story/:id" element={<StoryReaderRedirect />} />
        <Route path="/story/:id/edit" element={<StoryEditorPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/discover/:org/:name" element={<DiscoverDatasetPage />} />
      </Routes>
    </WorkspaceProvider>
  );
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/story/:id/embed" element={<StoryEmbedPage />} />
        <Route path="/map/connection/:id" element={<MapPage shared />} />
        <Route path="/map/:id" element={<MapPage shared />} />
        <Route path="/story/:id" element={<StoryReaderPage />} />
        <Route path="/w/:workspaceId/*" element={<WorkspaceRoutes />} />
        {import.meta.env.DEV && (
          <Route
            path="/dev/zarr-spike"
            element={
              <Suspense fallback={null}>
                <DevZarrSpike />
              </Suspense>
            }
          />
        )}
        <Route path="*" element={<WorkspaceRedirect />} />
      </Routes>
      <Toaster toaster={toaster} />
    </>
  );
}
