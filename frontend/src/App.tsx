import { lazy, Suspense } from "react";
import { Flex } from "@chakra-ui/react";
import { Routes, Route, Navigate } from "react-router-dom";
import {
  WorkspaceProvider,
  WorkspaceRedirect,
  useWorkspace,
} from "./hooks/useWorkspace";
import { Toaster } from "./components/ui/toaster";
import { toaster } from "./lib/toaster";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { BrandSpinner } from "./components/ui/BrandSpinner";

const AboutPage = lazy(() => import("./pages/AboutPage"));
const DataPage = lazy(() => import("./pages/DataPage"));
const DiscoverDatasetPage = lazy(() => import("./pages/DiscoverDatasetPage"));
const DiscoverPage = lazy(() => import("./pages/DiscoverPage"));
const ExpiredPage = lazy(() => import("./pages/ExpiredPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const MapPage = lazy(() => import("./pages/MapPage"));
const UploadPage = lazy(() => import("./pages/UploadPage"));
const WorkspaceHomePage = lazy(() => import("./pages/WorkspaceHomePage"));

function RouteLoadingFallback() {
  return (
    <Flex
      minH="100vh"
      align="center"
      justify="center"
      aria-label="Loading page"
    >
      <BrandSpinner size={32} />
    </Flex>
  );
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
      <Routes>
        <Route path="/" element={<WorkspaceHomePage />} />
        <Route path="/quick-map" element={<UploadPage />} />
        <Route path="/map/:id" element={<MapPage />} />
        <Route path="/map/connection/:id" element={<MapPage />} />
        <Route path="/expired/:id" element={<ExpiredPage />} />
        <Route path="/data" element={<DataPage />} />
        <Route path="/library" element={<LibraryRedirect />} />
        <Route path="/datasets" element={<DatasetsRedirect />} />
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
      <ErrorBoundary>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/map/connection/:id" element={<MapPage shared />} />
            <Route path="/map/:id" element={<MapPage shared />} />
            <Route path="/w/:workspaceId/*" element={<WorkspaceRoutes />} />
            <Route path="*" element={<WorkspaceRedirect />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      <Toaster toaster={toaster} />
    </>
  );
}
