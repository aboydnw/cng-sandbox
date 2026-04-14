import {
  Button,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Box,
  Spinner,
  Text,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
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
  const sampleColumnNames = sampleRows.length > 0
    ? Object.keys(sampleRows[0]).filter((col) => col !== "__geojson")
    : [];

  return (
    <Modal isOpen={open} onClose={onCancel} size="2xl">
      <ModalOverlay />
      <ModalContent maxH="80vh" overflowY="auto">
        <ModalHeader>
          <Heading size="md">Preview: {filename}</Heading>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>

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
          <Box p={4} bg="red.50" borderRadius="md" borderLeft="4px solid" borderColor="red.500">
            <Text color="red.700">{error}</Text>
          </Box>
        ) : (
          <Box>
            {geometryInfo && (
              <Box mb={6}>
                <Heading size="sm" mb={3}>
                  Geometry Information
                </Heading>
                <Box overflowX="auto">
                  <Table size="sm">
                    <Tbody>
                      <Tr>
                        <Td fontWeight="600" w="25%">
                          Type
                        </Td>
                        <Td>{geometryInfo.type}</Td>
                      </Tr>
                      {geometryInfo.bbox && (
                        <>
                          <Tr>
                            <Td fontWeight="600">Min Longitude</Td>
                            <Td>{geometryInfo.bbox.minLon}</Td>
                          </Tr>
                          <Tr>
                            <Td fontWeight="600">Min Latitude</Td>
                            <Td>{geometryInfo.bbox.minLat}</Td>
                          </Tr>
                          <Tr>
                            <Td fontWeight="600">Max Longitude</Td>
                            <Td>{geometryInfo.bbox.maxLon}</Td>
                          </Tr>
                          <Tr>
                            <Td fontWeight="600">Max Latitude</Td>
                            <Td>{geometryInfo.bbox.maxLat}</Td>
                          </Tr>
                        </>
                      )}
                    </Tbody>
                  </Table>
                </Box>
              </Box>
            )}

            {schema.length > 0 && (
              <Box mb={6}>
                <Heading size="sm" mb={3}>
                  Schema
                </Heading>
                <Box overflowX="auto">
                  <Table size="sm">
                    <Thead>
                      <Tr bg="brand.bgSubtle">
                        <Th>Column</Th>
                        <Th>Type</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {schema.map((col) => (
                        <Tr key={col.name}>
                          <Td>{col.name}</Td>
                          <Td>{col.type}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              </Box>
            )}

            {sampleRows.length > 0 && (
              <Box mb={6}>
                <Heading size="sm" mb={3}>
                  Sample Rows (first {sampleRows.length})
                </Heading>
                <Box overflowX="auto">
                  <Table size="sm">
                    <Thead>
                      <Tr bg="brand.bgSubtle">
                        {sampleColumnNames.map((col) => (
                          <Th key={col}>{col}</Th>
                        ))}
                      </Tr>
                    </Thead>
                    <Tbody>
                      {sampleRows.map((row, idx) => (
                        <Tr key={idx}>
                          {sampleColumnNames.map((col) => (
                            <Td key={`${idx}-${col}`}>
                              {truncateValue(row[col], 100)}
                            </Td>
                          ))}
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              </Box>
            )}
          </Box>
        )}
        </ModalBody>
        <ModalFooter gap={2}>
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
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
