import { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Field,
  Flex,
  Input,
  NativeSelect,
  Tabs,
  Text,
  Textarea,
} from "@chakra-ui/react";
import type {
  ChapterType,
  ChartChapter,
  ChartViz,
  CsvSource,
} from "../../lib/story";
import { uploadCsvAsset } from "../../lib/story/assets";
import { ChapterTypePicker } from "../ChapterTypePicker";
import { workspaceFetch } from "../../lib/api";
import type { Dataset } from "../../types";
import { PointPickerMap } from "./PointPickerMap";

interface ChartChapterEditorProps {
  chapter: ChartChapter;
  onChange: (next: ChartChapter) => void;
  onChapterTypeChange: (type: ChapterType) => void;
}

function CsvBranch({
  chapter,
  onChange,
}: Omit<ChartChapterEditorProps, "onChapterTypeChange">) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  if (chapter.chart.source.kind !== "csv") return null;
  const source: CsvSource = chapter.chart.source;
  const viz = chapter.chart.viz;

  async function handleFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const uploaded = await uploadCsvAsset(file);
      const xField = uploaded.columns[0] ?? "";
      const yField = uploaded.columns[1] ?? "";
      onChange({
        ...chapter,
        chart: {
          source: {
            kind: "csv",
            asset_id: uploaded.asset_id,
            url: uploaded.url,
            columns: uploaded.columns,
          },
          viz: { ...viz, x_field: xField, y_fields: yField ? [yField] : [] },
        },
      });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "upload failed");
    } finally {
      setUploading(false);
    }
  }

  function updateViz(patch: Partial<ChartViz>) {
    onChange({
      ...chapter,
      chart: { ...chapter.chart, viz: { ...viz, ...patch } },
    });
  }

  return (
    <Flex direction="column" gap={4}>
      <Field.Root>
        <Field.Label>CSV file</Field.Label>
        {source.url ? (
          <Flex gap={2} align="center">
            <Text fontSize="sm" flex={1} truncate>
              {source.columns.length} columns
            </Text>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
            >
              Replace
            </Button>
          </Flex>
        ) : (
          <Box
            as="button"
            border="1px dashed"
            borderColor="gray.300"
            borderRadius="6px"
            p={4}
            textAlign="center"
            color="gray.500"
            cursor="pointer"
            _hover={{ borderColor: "brand.orange", color: "brand.orange" }}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? "Uploading…" : "Click to upload a CSV"}
          </Box>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
        {uploadError && (
          <Text color="red.600" fontSize="xs" mt={1}>
            {uploadError}
          </Text>
        )}
      </Field.Root>

      {source.columns.length > 0 && (
        <>
          <Field.Root>
            <Field.Label>Chart kind</Field.Label>
            <NativeSelect.Root size="sm">
              <NativeSelect.Field
                value={viz.kind}
                onChange={(e) =>
                  updateViz({ kind: e.target.value as "line" | "bar" })
                }
              >
                <option value="line">Line</option>
                <option value="bar">Bar</option>
              </NativeSelect.Field>
            </NativeSelect.Root>
          </Field.Root>

          <Field.Root>
            <Field.Label>X column</Field.Label>
            <NativeSelect.Root size="sm">
              <NativeSelect.Field
                value={viz.x_field}
                onChange={(e) => updateViz({ x_field: e.target.value })}
              >
                {source.columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect.Field>
            </NativeSelect.Root>
          </Field.Root>

          <Field.Root>
            <Field.Label>Y column</Field.Label>
            <NativeSelect.Root size="sm">
              <NativeSelect.Field
                value={viz.y_fields[0] ?? ""}
                onChange={(e) =>
                  updateViz({
                    y_fields: e.target.value ? [e.target.value] : [],
                  })
                }
              >
                {source.columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect.Field>
            </NativeSelect.Root>
          </Field.Root>

          <Field.Root>
            <Field.Label>Y-axis scale</Field.Label>
            <NativeSelect.Root size="sm">
              <NativeSelect.Field
                value={viz.y_scale ?? "linear"}
                onChange={(e) =>
                  updateViz({ y_scale: e.target.value as "linear" | "log" })
                }
              >
                <option value="linear">Linear</option>
                <option value="log">Log</option>
              </NativeSelect.Field>
            </NativeSelect.Root>
          </Field.Root>
        </>
      )}
    </Flex>
  );
}

function DatasetBranch({
  chapter,
  onChange,
}: Omit<ChartChapterEditorProps, "onChapterTypeChange">) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadDatasets() {
      try {
        const r = await workspaceFetch("/api/datasets");
        if (cancelled) return;
        if (!r.ok) {
          console.error("Failed to load datasets:", r.status);
          setDatasets([]);
          return;
        }
        const body = await r.json();
        if (cancelled) return;
        setDatasets(Array.isArray(body) ? body : (body.datasets ?? []));
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load datasets:", err);
          setDatasets([]);
        }
      }
    }
    void loadDatasets();
    return () => {
      cancelled = true;
    };
  }, []);

  const source = chapter.chart.source;
  const datasetId =
    source.kind === "dataset_timeseries" || source.kind === "dataset_histogram"
      ? source.dataset_id
      : "";
  const picked = datasets.find((d) => d.id === datasetId) ?? null;

  function selectDataset(ds: Dataset) {
    if (ds.is_temporal) {
      onChange({
        ...chapter,
        chart: {
          source: {
            kind: "dataset_timeseries",
            dataset_id: ds.id,
            point: ds.bounds
              ? [
                  (ds.bounds[0] + ds.bounds[2]) / 2,
                  (ds.bounds[1] + ds.bounds[3]) / 2,
                ]
              : [0, 0],
          },
          viz: {
            ...chapter.chart.viz,
            kind: "line",
            x_field: "datetime",
            y_fields: ["value"],
          },
        },
      });
    } else {
      onChange({
        ...chapter,
        chart: {
          source: { kind: "dataset_histogram", dataset_id: ds.id, bins: 20 },
          viz: {
            ...chapter.chart.viz,
            kind: "bar",
            x_field: "bin",
            y_fields: ["count"],
          },
        },
      });
    }
  }

  function updatePoint(point: [number, number]) {
    if (source.kind !== "dataset_timeseries") return;
    onChange({
      ...chapter,
      chart: { ...chapter.chart, source: { ...source, point } },
    });
  }

  function updateBins(bins: number) {
    if (source.kind !== "dataset_histogram") return;
    onChange({
      ...chapter,
      chart: { ...chapter.chart, source: { ...source, bins } },
    });
  }

  return (
    <Flex direction="column" gap={4}>
      <Field.Root>
        <Field.Label>Dataset</Field.Label>
        <NativeSelect.Root>
          <NativeSelect.Field
            value={datasetId}
            onChange={(e) => {
              const ds = datasets.find((d) => d.id === e.target.value);
              if (ds) selectDataset(ds);
            }}
          >
            <option value="">Select…</option>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title || d.filename} {d.is_temporal ? "(temporal)" : ""}
              </option>
            ))}
          </NativeSelect.Field>
        </NativeSelect.Root>
      </Field.Root>

      {source.kind === "dataset_timeseries" && picked && (
        <Field.Root>
          <Field.Label>Sample point (click on the map)</Field.Label>
          <PointPickerMap
            initialPoint={source.point}
            bounds={picked.bounds ?? null}
            onPick={updatePoint}
          />
          <Field.HelperText>
            lon {source.point[0].toFixed(3)}, lat {source.point[1].toFixed(3)}
          </Field.HelperText>
        </Field.Root>
      )}

      {source.kind === "dataset_histogram" &&
        picked &&
        !picked.is_categorical && (
          <Field.Root>
            <Field.Label>Bins</Field.Label>
            <Input
              type="number"
              min={2}
              max={100}
              value={source.bins ?? 20}
              onChange={(e) => {
                const parsed = Number(e.target.value);
                if (!Number.isFinite(parsed)) return;
                const clamped = Math.min(100, Math.max(2, Math.trunc(parsed)));
                updateBins(clamped);
              }}
            />
          </Field.Root>
        )}
    </Flex>
  );
}

export function ChartChapterEditor({
  chapter,
  onChange,
  onChapterTypeChange,
}: ChartChapterEditorProps) {
  const sourceKind = chapter.chart.source.kind;
  const tab = sourceKind === "csv" ? "csv" : "dataset";

  function switchToCsv() {
    if (sourceKind === "csv") return;
    onChange({
      ...chapter,
      chart: {
        source: { kind: "csv", asset_id: "", url: "", columns: [] },
        viz: { ...chapter.chart.viz, x_field: "", y_fields: [] },
      },
    });
  }

  function switchToDataset() {
    if (sourceKind !== "csv") return;
    onChange({
      ...chapter,
      chart: {
        source: { kind: "dataset_histogram", dataset_id: "" },
        viz: chapter.chart.viz,
      },
    });
  }

  return (
    <Flex direction="column" p={3} gap={4}>
      <ChapterTypePicker value="chart" onChange={onChapterTypeChange} />

      <Field.Root>
        <Field.Label>Title</Field.Label>
        <Input
          value={chapter.title}
          onChange={(e) => onChange({ ...chapter, title: e.target.value })}
        />
      </Field.Root>

      <Tabs.Root
        value={tab}
        onValueChange={(d) =>
          d.value === "csv" ? switchToCsv() : switchToDataset()
        }
      >
        <Tabs.List>
          <Tabs.Trigger value="csv">Upload CSV</Tabs.Trigger>
          <Tabs.Trigger value="dataset">From dataset</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="csv">
          <CsvBranch chapter={chapter} onChange={onChange} />
        </Tabs.Content>
        <Tabs.Content value="dataset">
          <DatasetBranch chapter={chapter} onChange={onChange} />
        </Tabs.Content>
      </Tabs.Root>

      <Field.Root>
        <Field.Label>Caption (markdown)</Field.Label>
        <Textarea
          rows={6}
          value={chapter.narrative}
          onChange={(e) => onChange({ ...chapter, narrative: e.target.value })}
        />
      </Field.Root>
    </Flex>
  );
}
