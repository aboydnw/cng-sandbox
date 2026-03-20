import { Routes, Route } from "react-router-dom";
import UploadPage from "./pages/UploadPage";
import MapPage from "./pages/MapPage";
import ExpiredPage from "./pages/ExpiredPage";
import StoryReaderPage from "./pages/StoryReaderPage";
import StoryEditorPage from "./pages/StoryEditorPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<UploadPage />} />
      <Route path="/map/:id" element={<MapPage />} />
      <Route path="/expired/:id" element={<ExpiredPage />} />
      <Route path="/story/new" element={<StoryEditorPage />} />
      <Route path="/story/:id" element={<StoryReaderPage />} />
      <Route path="/story/:id/edit" element={<StoryEditorPage />} />
    </Routes>
  );
}
