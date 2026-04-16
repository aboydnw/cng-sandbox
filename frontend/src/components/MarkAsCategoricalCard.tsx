import { useState } from "react";
import { Box, Button, Text } from "@chakra-ui/react";
import { workspaceFetch } from "../lib/api";

interface MarkAsCategoricalCardProps {
  datasetId: string;
  onSuccess: () => void;
}

export function MarkAsCategoricalCard({
  datasetId,
  onSuccess,
}: MarkAsCategoricalCardProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    setError(null);
    setPending(true);
    try {
      const resp = await workspaceFetch(
        `/api/datasets/${datasetId}/mark-categorical`,
        {
          method: "POST",
        }
      );
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        const detail = body?.detail;
        if (detail?.error === "too_many_values") {
          setError(
            `Found ${detail.count} unique values; only rasters with 30 or fewer categories can be marked categorical.`
          );
        } else if (detail?.error === "unsupported_dtype") {
          setError(
            `Raster dtype ${detail.dtype} cannot be treated as categorical.`
          );
        } else {
          setError("Could not mark as categorical.");
        }
        return;
      }
      onSuccess();
    } catch {
      setError("Could not mark as categorical.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Box
      mb={3}
      p={3}
      border="1px solid"
      borderColor="brand.border"
      borderRadius="8px"
      bg="brand.bgSubtle"
    >
      <Text fontSize="12px" color="gray.800" mb={2}>
        This looks like a categorical raster?
      </Text>
      <Button
        size="xs"
        variant="outline"
        borderColor="brand.border"
        bg="white"
        _hover={{ borderColor: "brand.orange", color: "brand.orange" }}
        onClick={handleClick}
        loading={pending}
      >
        Mark as categorical
      </Button>
      {error && (
        <Text mt={2} fontSize="11px" color="red.600">
          {error}
        </Text>
      )}
    </Box>
  );
}
