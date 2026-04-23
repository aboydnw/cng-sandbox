import { useState } from "react";
import { Box, Button, Text } from "@chakra-ui/react";
import { workspaceFetch } from "../lib/api";

interface MarkAsContinuousLinkProps {
  datasetId: string;
  onSuccess: () => void;
}

export function MarkAsContinuousLink({
  datasetId,
  onSuccess,
}: MarkAsContinuousLinkProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const resp = await workspaceFetch(
        `/api/datasets/${datasetId}/unmark-categorical`,
        { method: "POST" }
      );
      if (!resp.ok) {
        setError("Could not mark as continuous.");
        return;
      }
      onSuccess();
    } catch {
      setError("Could not mark as continuous.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Box mt={1} mb={3}>
      <Button
        type="button"
        variant="plain"
        size="xs"
        h="auto"
        minW={0}
        p={0}
        fontSize="10px"
        fontWeight={400}
        color="brand.textSecondary"
        bg="transparent"
        cursor={pending ? "wait" : "pointer"}
        opacity={pending ? 0.6 : 1}
        _hover={{ color: pending ? "brand.textSecondary" : "brand.orange" }}
        onClick={handleClick}
        disabled={pending}
      >
        {pending ? "Marking as continuous…" : "Mark as continuous →"}
      </Button>
      {error && (
        <Text mt={1} fontSize="10px" color="red.600">
          {error}
        </Text>
      )}
    </Box>
  );
}
