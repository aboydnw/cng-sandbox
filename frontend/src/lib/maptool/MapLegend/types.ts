export type ContinuousScaleType =
  | "linear"
  | "quantize"
  | "quantile"
  | "threshold"
  | "log"
  | "sqrt";

export interface ContinuousLegendConfig {
  type: "continuous";
  id: string;
  title: string;
  unit?: string;
  domain: [number, number];
  colors: string[];
  scaleType?: ContinuousScaleType;
  ticks?: number;
  tickFormat?: string;
  formatTick?: (value: number) => string;
  toggler?: boolean;
  visible?: boolean;
}

export interface CategoryEntry {
  value: string;
  color: string;
  label?: string;
}

export interface CategoricalLegendConfig {
  type: "categorical";
  id: string;
  title: string;
  categories: CategoryEntry[];
  shape?: "square" | "circle" | "line";
  toggler?: boolean;
  visible?: boolean;
}

export type LegendLayerConfig =
  | ContinuousLegendConfig
  | CategoricalLegendConfig;
export type LegendOrientation = "vertical" | "horizontal";
export type LegendPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface MapLegendProps {
  layers: LegendLayerConfig[];
  orientation?: LegendOrientation;
  position?: LegendPosition;
  collapsible?: boolean;
  collapsibleItems?: boolean;
  defaultCollapsed?: boolean;
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  onLayerToggle?: (layerId: string, visible: boolean) => void;
  className?: string;
}
