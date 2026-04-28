import { useEffect, useRef, useState } from "react";
import { Box } from "@chakra-ui/react";
import maplibregl from "maplibre-gl";
import { BASEMAPS } from "../MapShell";

interface PointPickerMapProps {
  initialPoint: [number, number] | null;
  bounds?: [number, number, number, number] | null;
  onPick: (point: [number, number]) => void;
}

export function PointPickerMap({
  initialPoint,
  bounds,
  onPick,
}: PointPickerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onPickRef = useRef(onPick);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  // Mount effect — create map and click handler
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAPS.streets,
      center: [0, 0],
      zoom: 2,
    });
    mapRef.current = map;
    map.once("load", () => {
      setReady(true);
    });
    map.on("click", (e) => {
      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      if (!markerRef.current) {
        markerRef.current = new maplibregl.Marker({ color: "#c46a1d" })
          .setLngLat(lngLat)
          .addTo(map);
      } else {
        markerRef.current.setLngLat(lngLat);
      }
      onPickRef.current(lngLat);
    });
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Bounds-fitting effect — runs when bounds changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !bounds) return;
    map.fitBounds(
      [[bounds[0], bounds[1]], [bounds[2], bounds[3]]],
      { padding: 20, animate: false }
    );
  }, [bounds, ready]);

  // Marker effect — runs when initialPoint changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (initialPoint) {
      if (!markerRef.current) {
        markerRef.current = new maplibregl.Marker({ color: "#c46a1d" })
          .setLngLat(initialPoint)
          .addTo(map);
      } else {
        markerRef.current.setLngLat(initialPoint);
      }
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [initialPoint, ready]);

  return (
    <Box
      ref={containerRef}
      h="200px"
      borderRadius="6px"
      overflow="hidden"
      border="1px solid"
      borderColor="gray.200"
    >
      {!ready && null}
    </Box>
  );
}
