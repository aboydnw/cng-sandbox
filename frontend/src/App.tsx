import { Routes, Route, Navigate, useParams } from "react-router-dom";
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
import AboutPage from "./pages/AboutPage";
import { WelcomeToast } from "./components/WelcomeToast";

function StoryReaderRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/story/${id}`} replace />;
}

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
        <Route path="/story/:id" element={<StoryReaderRedirect />} />
        <Route path="/story/:id/edit" element={<StoryEditorPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </WorkspaceProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/story/:id/embed" element={<StoryEmbedPage />} />
      <Route path="/map/connection/:id" element={<MapPage shared />} />
      <Route path="/map/:id" element={<MapPage shared />} />
      <Route path="/story/:id" element={<StoryReaderPage />} />
      <Route path="/w/:workspaceId/*" element={<WorkspaceRoutes />} />
      <Route path="*" element={<WorkspaceRedirect />} />
    </Routes>
  );
}
