import { Routes, Route } from "react-router-dom";
import UploadPage from "./pages/UploadPage";
import MapPage from "./pages/MapPage";
import ExpiredPage from "./pages/ExpiredPage";
import DatasetsPage from "./pages/DatasetsPage";
import StoryReaderPage from "./pages/StoryReaderPage";
import StoryEditorPage from "./pages/StoryEditorPage";
import StoryEmbedPage from "./pages/StoryEmbedPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<UploadPage />} />
      <Route path="/map/:id" element={<MapPage />} />
      <Route path="/expired/:id" element={<ExpiredPage />} />
      <Route path="/datasets" element={<DatasetsPage />} />
      <Route path="/story/new" element={<StoryEditorPage />} />
      <Route path="/story/:id/embed" element={<StoryEmbedPage />} />
      <Route path="/story/:id" element={<StoryReaderPage />} />
      <Route path="/story/:id/edit" element={<StoryEditorPage />} />
    </Routes>
  );
}
