import {
  Box,
  Button,
  CloseButton,
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPositioner,
  DialogRoot,
  DialogTitle,
  Heading,
  Portal,
  Spinner,
  Table,
  Text,
} from "@chakra-ui/react";
import type { Table as ArrowTable } from "apache-arrow";
import type { GeometryInfo } from "../hooks/useGeoParquetValidation";
import type { ColumnStats } from "../hooks/useGeoParquetQuery";

interface GeoParquetPreviewModalProps {
  open: boolean;
  filename: string;
  validating: boolean;
  valid: boolean;
  error: string | null;
  geometryInfo: GeometryInfo | null;
  schema: ColumnStats[];
  samples: ArrowTable | null;
  onConfirm: () => void;
  onCancel: () => void;
  sizeBytes: number | null;
  sizeSource: "head" | "footer" | "unknown";
  renderPath: "client" | "server";
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "size unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatRouteDescription(
  path: "client" | "server",
  bytes: number | null,
  source: "head" | "footer" | "unknown"
): string {
  const sz = formatBytes(bytes);
  if (path === "client") {
    return `${sz} · features load into memory and render with deck.gl.`;
  }
  return source === "unknown"
    ? "Size unknown — will convert to tiles on the server for safety."
    : `${sz} · will convert to PMTiles on the server (~30s for typical files).`;
}

export function GeoParquetPreviewModal({
  open,
  filename,
  validating,
  valid,
  error,
  geometryInfo,
  schema,
  samples,
  onConfirm,
  onCancel,
  sizeBytes,
  sizeSource,
  renderPath,
}: GeoParquetPreviewModalProps) {
  if (!open) return null;

  const isConfirmDisabled = !valid || validating;

  const truncateValue = (value: unknown, maxLength: number = 100): string => {
    if (value === null || value === undefined) return "—";
    const str = String(value);
    return str.length > maxLength ? `${str.substring(0, maxLength)}...` : str;
  };

  const getSampleRows = (): Array<Record<string, unknown>> => {
    if (!samples || samples.numRows === 0) return [];

    const rows: Array<Record<string, unknown>> = [];
    const limit = Math.min(10, samples.numRows);

    for (let i = 0; i < limit; i++) {
      const row = samples.get(i);
      if (row) {
        const record: Record<string, unknown> = {};
        for (const col of samples.schema.fields) {
          if (col.type.toString() !== "geometry") {
            record[col.name] = row[col.name];
          }
        }
        rows.push(record);
      }
    }

    return rows;
  };

  const sampleRows = getSampleRows();
  const sampleColumnNames =
    sampleRows.length > 0
      ? Object.keys(sampleRows[0]).filter((col) => col !== "__geojson")
      : [];

  return (
    <DialogRoot
      open={open}
      onOpenChange={(e) => !e.open && onCancel()}
      size="xl"
    >
      <Portal>
        <DialogBackdrop />
        <DialogPositioner>
          <DialogContent shadow="lg" maxH="80vh" overflowY="auto">
            <DialogHeader>
              <DialogTitle>Preview: {filename}</DialogTitle>
              <DialogCloseTrigger asChild>
                <CloseButton size="sm" />
              </DialogCloseTrigger>
            </DialogHeader>
            <DialogBody>
              {validating ? (
                <Box textAlign="center" py={12}>
                  <Spinner
                    size="lg"
                    color="brand.orange"
                    data-testid="validating-spinner"
                    mb={4}
                  />
                  <Text>Validating...</Text>
                </Box>
              ) : error ? (
                <Box
                  p={4}
                  bg="red.50"
                  borderRadius="md"
                  borderLeft="4px solid"
                  borderColor="red.500"
                >
                  <Text color="red.700">{error}</Text>
                </Box>
              ) : (
                <Box>
                  <Box
                    mb={4}
                    p={3}
                    bg="brand.bgSubtle"
                    border="1px solid"
                    borderColor="brand.border"
                    borderRadius="md"
                  >
                    <Text fontWeight={600} mb={1}>
                      {renderPath === "client"
                        ? "Will render directly in browser"
                        : "Will convert to tiles (server-side)"}
                    </Text>
                    <Text fontSize="sm" color="brand.textSecondary">
                      {formatRouteDescription(
                        renderPath,
                        sizeBytes,
                        sizeSource
                      )}
                    </Text>
                  </Box>
                  {geometryInfo && (
                    <Box mb={6}>
                      <Heading size="sm" mb={3}>
                        Geometry Information
                      </Heading>
                      <Box overflowX="auto">
                        <Table.Root size="sm">
                          <Table.Body>
                            <Table.Row>
                              <Table.Cell fontWeight="600" w="25%">
                                Type
                              </Table.Cell>
                              <Table.Cell>{geometryInfo.type}</Table.Cell>
                            </Table.Row>
                            {geometryInfo.bbox && (
                              <>
                                <Table.Row>
                                  <Table.Cell fontWeight="600">
                                    Min Longitude
                                  </Table.Cell>
                                  <Table.Cell>
                                    {geometryInfo.bbox.minLon}
                                  </Table.Cell>
                                </Table.Row>
                                <Table.Row>
                                  <Table.Cell fontWeight="600">
                                    Min Latitude
                                  </Table.Cell>
                                  <Table.Cell>
                                    {geometryInfo.bbox.minLat}
                                  </Table.Cell>
                                </Table.Row>
                                <Table.Row>
                                  <Table.Cell fontWeight="600">
                                    Max Longitude
                                  </Table.Cell>
                                  <Table.Cell>
                                    {geometryInfo.bbox.maxLon}
                                  </Table.Cell>
                                </Table.Row>
                                <Table.Row>
                                  <Table.Cell fontWeight="600">
                                    Max Latitude
                                  </Table.Cell>
                                  <Table.Cell>
                                    {geometryInfo.bbox.maxLat}
                                  </Table.Cell>
                                </Table.Row>
                              </>
                            )}
                          </Table.Body>
                        </Table.Root>
                      </Box>
                    </Box>
                  )}

                  {schema.length > 0 && (
                    <Box mb={6}>
                      <Heading size="sm" mb={3}>
                        Schema
                      </Heading>
                      <Box overflowX="auto">
                        <Table.Root size="sm">
                          <Table.Header>
                            <Table.Row bg="brand.bgSubtle">
                              <Table.ColumnHeader>Column</Table.ColumnHeader>
                              <Table.ColumnHeader>Type</Table.ColumnHeader>
                            </Table.Row>
                          </Table.Header>
                          <Table.Body>
                            {schema.map((col) => (
                              <Table.Row key={col.name}>
                                <Table.Cell>{col.name}</Table.Cell>
                                <Table.Cell>{col.type}</Table.Cell>
                              </Table.Row>
                            ))}
                          </Table.Body>
                        </Table.Root>
                      </Box>
                    </Box>
                  )}

                  {sampleRows.length > 0 && (
                    <Box mb={6}>
                      <Heading size="sm" mb={3}>
                        Sample Rows (first {sampleRows.length})
                      </Heading>
                      <Box overflowX="auto">
                        <Table.Root size="sm">
                          <Table.Header>
                            <Table.Row bg="brand.bgSubtle">
                              {sampleColumnNames.map((col) => (
                                <Table.ColumnHeader key={col}>
                                  {col}
                                </Table.ColumnHeader>
                              ))}
                            </Table.Row>
                          </Table.Header>
                          <Table.Body>
                            {sampleRows.map((row, idx) => (
                              <Table.Row key={idx}>
                                {sampleColumnNames.map((col) => (
                                  <Table.Cell key={`${idx}-${col}`}>
                                    {truncateValue(row[col], 100)}
                                  </Table.Cell>
                                ))}
                              </Table.Row>
                            ))}
                          </Table.Body>
                        </Table.Root>
                      </Box>
                    </Box>
                  )}
                </Box>
              )}
            </DialogBody>
            <DialogFooter gap={2}>
              <Button variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                bg="brand.orange"
                color="white"
                onClick={onConfirm}
                disabled={isConfirmDisabled}
              >
                Confirm & Connect
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPositioner>
      </Portal>
    </DialogRoot>
  );
}
