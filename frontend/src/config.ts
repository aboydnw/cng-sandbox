export const config = {
  apiBase: import.meta.env.VITE_API_BASE || "",
  rasterTilerUrl: import.meta.env.VITE_RASTER_TILER_URL || "/raster",
  vectorTilerUrl: import.meta.env.VITE_VECTOR_TILER_URL || "/vector",
};
