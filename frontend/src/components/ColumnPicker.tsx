import { useMemo, useState } from "react";
import { Box, Button, Flex, Input, Text } from "@chakra-ui/react";
import type { ColumnMapping, ScannedColumn } from "../types";

interface ColumnPickerProps {
  columns: ScannedColumn[];
  onConfirm: (mapping: ColumnMapping) => void;
}

type Mode = "latlon" | "wkt";

const selectStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--chakra-colors-brand-border)",
  borderRadius: "6px",
  fontSize: "14px",
  color: "var(--chakra-colors-brand-brown)",
  background: "white",
};

function firstRole(columns: ScannedColumn[], role: string): string {
  return columns.find((c) => c.role === role)?.name ?? "";
}

export function ColumnPicker({ columns, onConfirm }: ColumnPickerProps) {
  const guessedLat = useMemo(() => firstRole(columns, "lat"), [columns]);
  const guessedLon = useMemo(() => firstRole(columns, "lon"), [columns]);
  const guessedWkt = useMemo(() => firstRole(columns, "wkt"), [columns]);

  const [mode, setMode] = useState<Mode>(
    guessedWkt && !(guessedLat && guessedLon) ? "wkt" : "latlon"
  );
  const [latColumn, setLatColumn] = useState(guessedLat);
  const [lonColumn, setLonColumn] = useState(guessedLon);
  const [wktColumn, setWktColumn] = useState(guessedWkt);
  const [crs, setCrs] = useState("EPSG:4326");

  const valid =
    mode === "latlon" ? Boolean(latColumn && lonColumn) : Boolean(wktColumn);

  function handleConfirm() {
    if (!valid) return;
    const trimmedCrs = crs.trim() || "EPSG:4326";
    if (mode === "latlon") {
      onConfirm({
        lat_column: latColumn,
        lon_column: lonColumn,
        crs: trimmedCrs,
      });
    } else {
      onConfirm({ wkt_column: wktColumn, crs: trimmedCrs });
    }
  }

  return (
    <Box py={8} px={8} maxW="520px" mx="auto">
      <Text
        color="brand.brown"
        fontSize="18px"
        fontWeight={700}
        mb={2}
        textAlign="center"
      >
        Map your geometry columns
      </Text>
      <Text
        color="brand.textSecondary"
        fontSize="13px"
        mb={6}
        textAlign="center"
      >
        Choose which columns hold the coordinates so we can place your data on
        the map.
      </Text>

      <Flex gap={2} mb={5}>
        <Button
          flex={1}
          size="sm"
          fontWeight={600}
          borderRadius="6px"
          bg={mode === "latlon" ? "brand.orange" : "transparent"}
          color={mode === "latlon" ? "white" : "brand.brown"}
          border="1px solid"
          borderColor={mode === "latlon" ? "brand.orange" : "brand.border"}
          _hover={{ borderColor: "brand.orange" }}
          onClick={() => setMode("latlon")}
        >
          Latitude / Longitude
        </Button>
        <Button
          flex={1}
          size="sm"
          fontWeight={600}
          borderRadius="6px"
          bg={mode === "wkt" ? "brand.orange" : "transparent"}
          color={mode === "wkt" ? "white" : "brand.brown"}
          border="1px solid"
          borderColor={mode === "wkt" ? "brand.orange" : "brand.border"}
          _hover={{ borderColor: "brand.orange" }}
          onClick={() => setMode("wkt")}
        >
          WKT geometry
        </Button>
      </Flex>

      {mode === "latlon" ? (
        <Flex direction="column" gap={4}>
          <Box>
            <Text fontSize="12px" fontWeight={600} color="brand.brown" mb={1}>
              Latitude column
            </Text>
            <select
              aria-label="Latitude column"
              style={selectStyle}
              value={latColumn}
              onChange={(e) => setLatColumn(e.target.value)}
            >
              <option value="">Select a column…</option>
              {columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.dtype})
                </option>
              ))}
            </select>
          </Box>
          <Box>
            <Text fontSize="12px" fontWeight={600} color="brand.brown" mb={1}>
              Longitude column
            </Text>
            <select
              aria-label="Longitude column"
              style={selectStyle}
              value={lonColumn}
              onChange={(e) => setLonColumn(e.target.value)}
            >
              <option value="">Select a column…</option>
              {columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.dtype})
                </option>
              ))}
            </select>
          </Box>
        </Flex>
      ) : (
        <Box>
          <Text fontSize="12px" fontWeight={600} color="brand.brown" mb={1}>
            WKT column
          </Text>
          <select
            aria-label="WKT column"
            style={selectStyle}
            value={wktColumn}
            onChange={(e) => setWktColumn(e.target.value)}
          >
            <option value="">Select a column…</option>
            {columns.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.dtype})
              </option>
            ))}
          </select>
        </Box>
      )}

      <Box mt={4}>
        <Text fontSize="12px" fontWeight={600} color="brand.brown" mb={1}>
          Coordinate reference system
        </Text>
        <Input
          value={crs}
          onChange={(e) => setCrs(e.target.value)}
          size="sm"
          borderColor="brand.border"
          placeholder="EPSG:4326"
        />
      </Box>

      <Button
        mt={6}
        w="100%"
        bg="brand.orange"
        color="white"
        fontWeight={600}
        borderRadius="6px"
        _hover={{ bg: "brand.orangeHover" }}
        disabled={!valid}
        onClick={handleConfirm}
      >
        Convert
      </Button>
    </Box>
  );
}
