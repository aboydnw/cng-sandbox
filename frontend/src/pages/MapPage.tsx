import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { Box, Button, Flex, Spinner, Text } from "@chakra-ui/react";
import { Header } from "../components/Header";
import { ShareButton } from "../components/ShareButton";
import { CreditsPanel } from "../components/CreditsPanel";
import { RasterMap } from "../components/RasterMap";
import { DirectRasterMap } from "../components/DirectRasterMap";
import { VectorMap } from "../components/VectorMap";
import { DuckDBMap } from "../components/DuckDBMap";
import { ExploreTab } from "../components/ExploreTab";
import { ReportCard } from "../components/ReportCard";
import { config } from "../config";
import type { Dataset } from "../types";
import type { Table } from "apache-arrow";
import type { MapViewState } from "@deck.gl/core";
import { findGaps } from "../utils/temporal";
import { ErrorBoundary } from "../components/ErrorBoundary";

export default function MapPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportCardOpen, setReportCardOpen] = useState(false);
  const creditsPanelRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTimestep = Number(searchParams.get("t") ?? 0);
  const [activeTab, setActiveTab] = useState("credits");
  const [basemap, setBasemap] = useState("streets");
  const [viewState, setViewState] = useState<MapViewState>({
    longitude: 0,
    latitude: 0,
    zoom: 2,
  });
  const [arrowTable, setArrowTable] = useState<Table | null>(null);

  useEffect(() => {
    if (dataset?.bounds) {
      const [west, south, east, north] = dataset.bounds;
      setViewState({
        longitude: (west + east) / 2,
        latitude: (south + north) / 2,
        zoom: 3,
      });
    }
  }, [dataset?.bounds]);

  useEffect(() => {
    async function fetchDataset() {
      try {
        const resp = await fetch(`${config.apiBase}/api/datasets/${id}`);
        if (resp.status === 404) {
          navigate(`/expired/${id}`, { replace: true });
          return;
        }
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data: Dataset = await resp.json();

        const created = new Date(data.created_at);
        const expiry = new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000);
        if (new Date() > expiry) {
          navigate(`/expired/${id}`, { replace: true });
          return;
        }

        setDataset(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load dataset");
      } finally {
        setLoading(false);
      }
    }
    fetchDataset();
  }, [id, navigate]);

  if (loading) {
    return (
      <Box minH="100vh" bg="white">
        <Header />
        <Flex align="center" justify="center" h="calc(100vh - 56px)">
          <Spinner size="lg" color="brand.orange" />
        </Flex>
      </Box>
    );
  }

  if (error) {
    return (
      <Box minH="100vh" bg="white">
        <Header />
        <Flex direction="column" align="center" justify="center" h="calc(100vh - 56px)" gap={4}>
          <Text color="red.500">{error}</Text>
          <Button
            bg="brand.orange"
            color="white"
            onClick={() => {
              setError(null);
              setLoading(true);
              window.location.reload();
            }}
          >
            Retry
          </Button>
        </Flex>
      </Box>
    );
  }

  const scrollToCredits = () => {
    setReportCardOpen(false);
    creditsPanelRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (!dataset) return null;

  const gapCount = dataset.is_temporal
    ? findGaps(dataset.timesteps.map((t: { datetime: string }) => t.datetime)).length
    : 0;

  // Client-side COG rendering uses Web Mercator which can't represent poles.
  // Only offer it when the COG's bounds are within Mercator limits.
  const canClientRender =
    !dataset.is_temporal &&
    !!dataset.cog_url &&
    !!dataset.bounds &&
    Math.abs(dataset.bounds[1]) < 85.05 &&
    Math.abs(dataset.bounds[3]) < 85.05;

  return (
    <Box h="100vh" display="flex" flexDirection="column">
      <Header>
        <ShareButton />
        {/* Gate on tile_url: the dataset record exists as soon as the job starts,
            but tile_url is only set after conversion completes. Hiding the button
            until then avoids opening an incomplete report card mid-processing. */}
        {dataset.tile_url && (
          <Button
            variant="ghost"
            color="brand.orange"
            size="sm"
            fontWeight={600}
            borderRadius="4px"
            onClick={() => setReportCardOpen(true)}
          >
            See what changed →
          </Button>
        )}
        <Button
          bg="brand.bgSubtle"
          color="brand.brown"
          size="sm"
          fontWeight={500}
          borderRadius="4px"
          asChild
        >
          <Link to="/">New upload</Link>
        </Button>
      </Header>

      <ErrorBoundary>
        <Flex flex={1} overflow="hidden">
          <Box flex={7} position="relative">
            {dataset.dataset_type === "raster" ? (
              activeTab === "client" && canClientRender ? (
                <DirectRasterMap dataset={dataset} />
              ) : (
                <RasterMap
                  dataset={dataset}
                  initialTimestep={dataset.is_temporal ? initialTimestep : undefined}
                  onTimestepChange={(index) => {
                    setSearchParams(
                      (prev) => {
                        const next = new URLSearchParams(prev);
                        next.set("t", String(index));
                        return next;
                      },
                      { replace: true },
                    );
                  }}
                />
              )
            ) : activeTab === "explore" ? (
              <DuckDBMap
                table={arrowTable}
                viewState={viewState}
                onViewStateChange={setViewState}
                basemap={basemap}
                onBasemapChange={setBasemap}
              />
            ) : (
              <VectorMap
                dataset={dataset}
                basemap={basemap}
                onBasemapChange={setBasemap}
                onViewportChange={(vp) => setViewState((prev) => ({ ...prev, ...vp }))}
              />
            )}
          </Box>

          <Box
            ref={creditsPanelRef}
            flex={3}
            display={{ base: "none", md: "block" }}
            overflow="auto"
          >
            <CreditsPanel
              dataset={dataset}
              gapCount={gapCount}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              exploreContent={
                dataset.parquet_url ? (
                  <ExploreTab
                    dataset={dataset}
                    active={activeTab === "explore"}
                    onTableChange={setArrowTable}
                  />
                ) : undefined
              }
              clientRenderContent={
                canClientRender ? (
                  <Box p={6}>
                    <Text fontSize="sm" color="brand.textSecondary" mb={3}>
                      Client-side rendering reads the COG file directly from storage
                      using HTTP Range requests and renders pixels on the GPU — no tile
                      server involved.
                    </Text>
                    <Text fontSize="xs" color="brand.textSecondary">
                      Powered by{" "}
                      <Text as="span" fontWeight={600}>
                        @developmentseed/deck.gl-geotiff
                      </Text>
                    </Text>
                  </Box>
                ) : undefined
              }
            />
          </Box>
        </Flex>
      </ErrorBoundary>
      <ReportCard
        dataset={dataset}
        isOpen={reportCardOpen}
        onClose={() => setReportCardOpen(false)}
        onScrollToCredits={scrollToCredits}
      />
    </Box>
  );
}
