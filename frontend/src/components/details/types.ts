export interface MetadataTileData {
  label: string;
  value: string;
  subValue?: string;
  colSpan?: number;
}

export interface ToolCardData {
  name: string;
  url: string;
  description: string;
}

export interface BeforeAfter {
  beforeLabel: string;
  beforeValue: string;
  afterLabel: string;
  afterValue: string;
  note: string;
}

export interface StepContent {
  label: string;
  subtitle: string;
  badge: string;
  title: string;
  explanation: string[];
  beforeAfter?: BeforeAfter;
  metadata: MetadataTileData[];
  tools: ToolCardData[];
  toolSectionTitle: string;
}
