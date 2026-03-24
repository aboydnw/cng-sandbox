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
  crs: string | null;
  crs_name: string | null;
  pixel_width: number | null;
  pixel_height: number | null;
  resolution: number | null;
  compression: string | null;
}

export interface StageInfo {
  name: string;
  status: "pending" | "active" | "done" | "error";
  detail?: string;
}

export interface ScannedVariable {
  name: string;
  group: string;
  shape: number[];
  dtype: string;
}

export interface ScanResult {
  scan_id: string;
  variables: ScannedVariable[];
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
}
