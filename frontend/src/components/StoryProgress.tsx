import { Box } from "@chakra-ui/react";

export function StoryProgress({ progress }: { progress: number }) {
  const normalized = Math.max(0, Math.min(1, progress));
  return (
    <Box
      role="progressbar"
      aria-label="Reading progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(normalized * 100)}
      h="3px"
      bg="brand.border"
      flexShrink={0}
    >
      <Box
        h="100%"
        w={`${normalized * 100}%`}
        bg="brand.orange"
        transition="width 120ms linear"
      />
    </Box>
  );
}
