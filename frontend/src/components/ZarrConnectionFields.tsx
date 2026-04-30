import { useEffect, useMemo, useState } from "react";
import { Box, Field, Flex, Input, Text } from "@chakra-ui/react";
import { Warning as WarningIcon } from "@phosphor-icons/react";
import type { ZarrConnectionConfig } from "../types";
import type { ZarrProbeResult, ZarrVariable } from "../lib/zarr/probeZarr";

interface ZarrConnectionFieldsProps {
  probe: ZarrProbeResult;
  onConfigChange: (config: ZarrConnectionConfig | null) => void;
}

function findCompatibleVariable(probe: ZarrProbeResult): ZarrVariable | null {
  return probe.variables.find((v) => v.compatibility.kind === "ok") ?? null;
}

export function ZarrConnectionFields({
  probe,
  onConfigChange,
}: ZarrConnectionFieldsProps) {
  const initial = useMemo(() => findCompatibleVariable(probe), [probe]);
  const [variableName, setVariableName] = useState<string>(initial?.name ?? "");
  const [minStr, setMinStr] = useState<string>(
    initial?.stats ? String(initial.stats.min) : ""
  );
  const [maxStr, setMaxStr] = useState<string>(
    initial?.stats ? String(initial.stats.max) : ""
  );

  const selected = probe.variables.find((v) => v.name === variableName) ?? null;

  useEffect(() => {
    if (!selected || selected.compatibility.kind !== "ok") {
      onConfigChange(null);
      return;
    }
    const minNum = Number(minStr);
    const maxNum = Number(maxStr);
    const validNumbers =
      minStr.trim() !== "" &&
      maxStr.trim() !== "" &&
      Number.isFinite(minNum) &&
      Number.isFinite(maxNum) &&
      minNum < maxNum;
    if (!validNumbers) {
      onConfigChange(null);
      return;
    }
    onConfigChange({
      variable: selected.name,
      timeDim: selected.timeDim,
      timeValues: selected.timeValues,
      rescaleMin: minNum,
      rescaleMax: maxNum,
    });
  }, [selected, minStr, maxStr, onConfigChange]);

  useEffect(() => {
    if (!selected || !selected.stats) return;
    setMinStr(String(selected.stats.min));
    setMaxStr(String(selected.stats.max));
  }, [variableName]);

  if (probe.variables.length === 0) {
    return (
      <Text fontSize="13px" color="red.500">
        No variables found in this Zarr store.
      </Text>
    );
  }

  const minMaxInvalid =
    minStr.trim() !== "" &&
    maxStr.trim() !== "" &&
    Number(minStr) >= Number(maxStr);

  return (
    <Flex direction="column" gap={3}>
      <Field.Root>
        <Field.Label>Variable</Field.Label>
        <select
          value={variableName}
          onChange={(e) => setVariableName(e.target.value)}
          style={{
            width: "100%",
            fontSize: "14px",
            padding: "6px 8px",
            borderRadius: "6px",
            border: "1px solid #e2e8f0",
          }}
        >
          <option value="">Select a variable…</option>
          {probe.variables.map((v) => {
            const compat = v.compatibility;
            const incompatible = compat.kind === "incompatible";
            return (
              <option key={v.name} value={v.name} disabled={incompatible}>
                {v.name}
                {incompatible ? ` — ${compat.reason}` : ""}
              </option>
            );
          })}
        </select>
        {selected?.timeDim && (
          <Field.HelperText>
            Time dimension: <b>{selected.timeDim}</b>
            {selected.timeValues
              ? ` (${selected.timeValues.length} steps)`
              : " (raw indices — time decoding unavailable)"}
          </Field.HelperText>
        )}
      </Field.Root>

      <Flex gap={3}>
        <Field.Root invalid={minMaxInvalid} flex={1}>
          <Field.Label>Min</Field.Label>
          <Input
            type="number"
            value={minStr}
            onChange={(e) => setMinStr(e.target.value)}
            size="sm"
          />
          {minMaxInvalid ? (
            <Field.ErrorText>Min must be less than max.</Field.ErrorText>
          ) : !selected?.stats ? (
            <Field.HelperText>
              Enter the rescale minimum (no attrs).
            </Field.HelperText>
          ) : (
            <Field.HelperText>From attrs; edit if needed.</Field.HelperText>
          )}
        </Field.Root>
        <Field.Root invalid={minMaxInvalid} flex={1}>
          <Field.Label>Max</Field.Label>
          <Input
            type="number"
            value={maxStr}
            onChange={(e) => setMaxStr(e.target.value)}
            size="sm"
          />
        </Field.Root>
      </Flex>

      {probe.crsWarning && (
        <Box
          p={2}
          borderRadius="6px"
          bg="orange.50"
          border="1px solid"
          borderColor="orange.200"
        >
          <Flex align="center" gap={2}>
            <WarningIcon size={14} weight="bold" color="#dd6b20" />
            <Text fontSize="12px" color="orange.700">
              {probe.crsWarning}
            </Text>
          </Flex>
        </Box>
      )}
    </Flex>
  );
}
