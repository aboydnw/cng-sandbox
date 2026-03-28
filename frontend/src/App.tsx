import { Routes, Route, Navigate } from "react-router-dom";
import {
  WorkspaceProvider,
  WorkspaceRedirect,
  useWorkspace,
} from "./hooks/useWorkspace";
import UploadPage from "./pages/UploadPage";
import MapPage from "./pages/MapPage";
import ExpiredPage from "./pages/ExpiredPage";
import LibraryPage from "./pages/LibraryPage";
import StoryReaderPage from "./pages/StoryReaderPage";
import StoryEditorPage from "./pages/StoryEditorPage";
import StoryEmbedPage from "./pages/StoryEmbedPage";
import { WelcomeToast } from "./components/WelcomeToast";

function DatasetsRedirect() {
  const { workspacePath } = useWorkspace();
  return <Navigate to={workspacePath("/library")} replace />;
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
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/datasets" element={<DatasetsRedirect />} />
        <Route path="/story/new" element={<StoryEditorPage />} />
        <Route path="/story/:id" element={<StoryReaderPage />} />
        <Route path="/story/:id/edit" element={<StoryEditorPage />} />
      </Routes>
    </WorkspaceProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/story/:id/embed" element={<StoryEmbedPage />} />
      <Route path="/w/:workspaceId/*" element={<WorkspaceRoutes />} />
      <Route path="*" element={<WorkspaceRedirect />} />
    </Routes>
  );
}
