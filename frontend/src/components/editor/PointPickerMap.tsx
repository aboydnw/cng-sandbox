import { useEffect, useRef, useState } from "react";
import { Box } from "@chakra-ui/react";
import maplibregl from "maplibre-gl";

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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: initialPoint ?? [0, 0],
      zoom: 2,
    });
    mapRef.current = map;
    map.once("load", () => {
      setReady(true);
      if (bounds) {
        map.fitBounds(
          [
            [bounds[0], bounds[1]],
            [bounds[2], bounds[3]],
          ],
          { padding: 20, animate: false }
        );
      }
      if (initialPoint) {
        markerRef.current = new maplibregl.Marker({ color: "#c46a1d" })
          .setLngLat(initialPoint)
          .addTo(map);
      }
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
      onPick(lngLat);
    });
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
