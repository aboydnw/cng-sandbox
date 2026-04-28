import { useRef, useState } from "react";
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
import type { ChapterType, ChartChapter, ChartViz, CsvSource } from "../../lib/story";
import { uploadCsvAsset } from "../../lib/story/assets";
import { ChapterTypePicker } from "../ChapterTypePicker";

interface ChartChapterEditorProps {
  chapter: ChartChapter;
  onChange: (next: ChartChapter) => void;
  onChapterTypeChange: (type: ChapterType) => void;
}

function CsvBranch({ chapter, onChange }: Omit<ChartChapterEditorProps, "onChapterTypeChange">) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const source = chapter.chart.source as CsvSource;
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
    onChange({ ...chapter, chart: { ...chapter.chart, viz: { ...viz, ...patch } } });
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
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
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
                  updateViz({ y_fields: e.target.value ? [e.target.value] : [] })
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

// DatasetBranch is implemented in Task 8.
function DatasetBranchPlaceholder() {
  return (
    <Text fontSize="sm" color="gray.500">
      Dataset-source charts are wired up in the next step.
    </Text>
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
        onValueChange={(d) => (d.value === "csv" ? switchToCsv() : switchToDataset())}
      >
        <Tabs.List>
          <Tabs.Trigger value="csv">Upload CSV</Tabs.Trigger>
          <Tabs.Trigger value="dataset">From dataset</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="csv">
          <CsvBranch chapter={chapter} onChange={onChange} />
        </Tabs.Content>
        <Tabs.Content value="dataset">
          <DatasetBranchPlaceholder />
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
