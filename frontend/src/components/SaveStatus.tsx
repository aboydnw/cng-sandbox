import { Flex, Text } from "@chakra-ui/react";
import { Check, SpinnerGap, Warning } from "@phosphor-icons/react";
import type { SaveState } from "../hooks/useSaveStatus";

const STATUS_MAP: Record<SaveState, { label: string; color: string; icon: React.ReactNode } | null> = {
  idle: null,
  saving: { label: "Saving...", color: "gray.500", icon: <SpinnerGap size={12} style={{ animation: "spin 1s linear infinite" }} /> },
  saved: { label: "Saved", color: "green.600", icon: <Check size={12} /> },
  error: { label: "Save failed", color: "red.500", icon: <Warning size={12} /> },
};

export function SaveStatus({ state }: { state: SaveState }) {
  const info = STATUS_MAP[state];
  if (!info) return null;
  return (
    <Flex align="center" gap={1}>
      {info.icon}
      <Text fontSize="xs" color={info.color} fontWeight={500}>{info.label}</Text>
    </Flex>
  );
}
