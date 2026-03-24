export const config = {
  apiBase: import.meta.env.VITE_BACKEND_URL || "",
  backendUrl: import.meta.env.VITE_BACKEND_URL || "",
  rasterTilerUrl: import.meta.env.VITE_RASTER_TILER_URL || "/raster",
  vectorTilerUrl: import.meta.env.VITE_VECTOR_TILER_URL || "/vector",
};
