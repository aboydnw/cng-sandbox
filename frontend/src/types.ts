export type DatasetType = "raster" | "vector";

export type JobStatus =
  | "pending"
  | "scanning"
  | "converting"
  | "validating"
  | "ingesting"
  | "ready"
  | "failed";

export interface ValidationCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface Credit {
  tool: string;
  url: string;
  role: string;
}

export interface Timestep {
  datetime: string;
  index: number;
}

export interface Dataset {
  id: string;
  filename: string;
  dataset_type: DatasetType;
  format_pair: string;
  tile_url: string;
  bounds: [number, number, number, number] | null;
  band_count: number | null;
  band_names: string[] | null;
  color_interpretation: string[] | null;
  dtype: string | null;
  original_file_size: number | null;
  converted_file_size: number | null;
  geoparquet_file_size: number | null;
  feature_count: number | null;
  geometry_types: string[] | null;
  min_zoom: number | null;
  max_zoom: number | null;
  stac_collection_id: string | null;
  pg_table: string | null;
  parquet_url: string | null;
  cog_url: string | null;
  validation_results: ValidationCheck[];
  credits: Credit[];
  created_at: string;
  is_temporal: boolean;
  timesteps: Timestep[];
  raster_min: number | null;
  raster_max: number | null;
  is_categorical: boolean;
  categories: { value: number; color: string; label: string }[] | null;
  crs: string | null;
  crs_name: string | null;
  pixel_width: number | null;
  pixel_height: number | null;
  resolution: number | null;
  compression: string | null;
  is_mosaic: boolean;
  is_zero_copy: boolean;
  is_example?: boolean;
  source_url: string | null;
  expires_at: string | null;
}

export type ConnectionType = "xyz_raster" | "xyz_vector" | "cog" | "pmtiles" | "geoparquet";

export interface Connection {
  id: string;
  name: string;
  url: string;
  connection_type: ConnectionType;
  bounds: [number, number, number, number] | null;
  min_zoom: number | null;
  max_zoom: number | null;
  tile_type: "raster" | "vector" | null;
  band_count: number | null;
  rescale: string | null;
  workspace_id: string | null;
  is_categorical: boolean;
  categories: { value: number; color: string; label: string }[] | null;
  created_at: string;
}

export interface StageProgress {
  percent: number | null;
  current: number | null;
  total: number | null;
  detail: string | null;
}

export interface StageInfo {
  name: string;
  status: "pending" | "active" | "done" | "error";
  detail?: string;
  progress?: StageProgress;
}

export interface TimeDimInfo {
  name: string;
  size: number;
  values: string[] | null;
}

export interface ScannedVariable {
  name: string;
  group: string;
  shape: number[];
  dtype: string;
  is_complex?: boolean;
  time_dim: TimeDimInfo | null;
}

export interface ScanResult {
  scan_id: string;
  variables: ScannedVariable[];
}

export interface DuplicateInfo {
  datasetId: string;
  filename: string;
}

export interface ConversionJobState {
  jobId: string | null;
  status: JobStatus;
  datasetId: string | null;
  error: string | null;
  stages: StageInfo[];
  progressCurrent: number | null;
  progressTotal: number | null;
  isUploading: boolean;
  scanResult: ScanResult | null;
  duplicate: DuplicateInfo | null;
}

export type MapItemSource = "dataset" | "connection";

export interface MapItem {
  id: string;
  name: string;
  source: MapItemSource;
  dataType: "raster" | "vector";
  tileUrl: string;
  bounds: [number, number, number, number] | null;
  minZoom: number | null;
  maxZoom: number | null;
  bandCount: number | null;
  bandNames: string[] | null;
  colorInterpretation: string[] | null;
  rasterMin: number | null;
  rasterMax: number | null;
  isCategorical: boolean;
  categories: { value: number; color: string; label: string }[] | null;
  cogUrl: string | null;
  rescale: string | null;
  parquetUrl: string | null;
  isTemporal: boolean;
  timesteps: Timestep[];
  dataset: Dataset | null;
  connection: Connection | null;
}
