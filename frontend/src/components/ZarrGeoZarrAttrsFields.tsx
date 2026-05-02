import { useEffect, useState } from "react";
import { Box, Field, Flex, Input, Text } from "@chakra-ui/react";
import { CaretDown, CaretRight } from "@phosphor-icons/react";
import type { GeoZarrAttrs } from "../types";

interface Props {
  initialAttrs: GeoZarrAttrs | null;
  /** True when the live zarr's root group.attrs already carries the four
   *  required GeoZarr keys. We collapse the section by default in that case. */
  storeHasGeoZarrAttrs: boolean;
  onChange: (attrs: GeoZarrAttrs | null) => void;
}

const EPSG_RE = /^EPSG:\d+$/;

function parseTransform(s: string): GeoZarrAttrs["spatial:transform"] | null {
  const parts = s.split(",").map((p) => Number(p.trim()));
  if (parts.length !== 6 || parts.some((n) => !Number.isFinite(n))) return null;
  return parts as GeoZarrAttrs["spatial:transform"];
}

function parseShape(s: string): GeoZarrAttrs["spatial:shape"] | null {
  const parts = s.split(",").map((p) => Number(p.trim()));
  if (parts.length !== 2 || parts.some((n) => !Number.isInteger(n) || n <= 0))
    return null;
  return parts as GeoZarrAttrs["spatial:shape"];
}

function parseDims(s: string): GeoZarrAttrs["spatial:dimensions"] | null {
  const parts = s
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length !== 2) return null;
  return parts as GeoZarrAttrs["spatial:dimensions"];
}

export function ZarrGeoZarrAttrsFields({
  initialAttrs,
  storeHasGeoZarrAttrs,
  onChange,
}: Props) {
  const [open, setOpen] = useState(!storeHasGeoZarrAttrs || !!initialAttrs);
  const [dimsStr, setDimsStr] = useState(
    initialAttrs?.["spatial:dimensions"].join(", ") ?? ""
  );
  const [transformStr, setTransformStr] = useState(
    initialAttrs?.["spatial:transform"].join(", ") ?? ""
  );
  const [shapeStr, setShapeStr] = useState(
    initialAttrs?.["spatial:shape"].join(", ") ?? ""
  );
  const [code, setCode] = useState(initialAttrs?.["proj:code"] ?? "");

  useEffect(() => {
    const dims = parseDims(dimsStr);
    const transform = parseTransform(transformStr);
    const shape = parseShape(shapeStr);
    const codeOk = EPSG_RE.test(code);
    if (!dims || !transform || !shape || !codeOk) {
      onChange(null);
      return;
    }
    onChange({
      "spatial:dimensions": dims,
      "spatial:transform": transform,
      "spatial:shape": shape,
      "proj:code": code,
    });
  }, [dimsStr, transformStr, shapeStr, code, onChange]);

  const codeInvalid = code !== "" && !EPSG_RE.test(code);

  return (
    <Box>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          fontSize: "13px",
          color: "var(--chakra-colors-brand-brown)",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      >
        {open ? <CaretDown size={12} /> : <CaretRight size={12} />}
        Advanced — GeoZarr metadata override
      </button>
      {storeHasGeoZarrAttrs && !open && (
        <Text fontSize="12px" color="brand.brown" mt={1}>
          This store already has GeoZarr metadata; override not needed.
        </Text>
      )}
      {!storeHasGeoZarrAttrs && (
        <Text fontSize="12px" color="brand.orange" mt={1}>
          This zarr store is missing GeoZarr metadata. Fill in all four fields
          or it won't render.
        </Text>
      )}
      {open && (
        <Flex direction="column" gap={3} mt={2}>
          <Field.Root>
            <Field.Label>spatial:dimensions (Y, X)</Field.Label>
            <Input
              size="sm"
              placeholder="latitude, longitude"
              value={dimsStr}
              onChange={(e) => setDimsStr(e.target.value)}
            />
            <Field.HelperText>
              Two dim names, comma-separated.
            </Field.HelperText>
          </Field.Root>
          <Field.Root>
            <Field.Label>spatial:transform (a, b, c, d, e, f)</Field.Label>
            <Input
              size="sm"
              placeholder="0.1, 0, -180, 0, 0.1, -90"
              value={transformStr}
              onChange={(e) => setTransformStr(e.target.value)}
            />
            <Field.HelperText>
              Affine: x = a·col + b·row + c; y = d·col + e·row + f.
            </Field.HelperText>
          </Field.Root>
          <Field.Root>
            <Field.Label>spatial:shape (height, width)</Field.Label>
            <Input
              size="sm"
              placeholder="1800, 3600"
              value={shapeStr}
              onChange={(e) => setShapeStr(e.target.value)}
            />
          </Field.Root>
          <Field.Root invalid={codeInvalid}>
            <Field.Label>proj:code</Field.Label>
            <Input
              size="sm"
              placeholder="EPSG:4326"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            {codeInvalid ? (
              <Field.ErrorText>Must match EPSG:&lt;digits&gt;.</Field.ErrorText>
            ) : null}
          </Field.Root>
        </Flex>
      )}
    </Box>
  );
}
