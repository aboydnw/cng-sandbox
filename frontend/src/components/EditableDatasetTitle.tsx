import { useState, useRef } from "react";
import { Box, Text, Input } from "@chakra-ui/react";
import { workspaceFetch } from "../lib/api";

interface EditableDatasetTitleProps {
  datasetId: string;
  title: string | null | undefined;
  filename: string;
  editable: boolean;
  onSaved: (title: string | null) => void;
  fontSize?: string;
  fontWeight?: number;
}

export function EditableDatasetTitle({
  datasetId,
  title,
  filename,
  editable,
  onSaved,
  fontSize = "16px",
  fontWeight = 600,
}: EditableDatasetTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const cancelledRef = useRef(false);

  const current = title && title.length > 0 ? title : filename;

  const handleBlur = async (raw: string) => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setIsEditing(false);
      return;
    }
    setIsEditing(false);
    const trimmed = raw.trim();
    const nextTitle = trimmed.length === 0 ? null : trimmed;
    const prevTitle = title && title.length > 0 ? title : null;
    if (nextTitle === prevTitle) return;

    try {
      const resp = await workspaceFetch(`/api/datasets/${datasetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextTitle }),
      });
      if (resp.ok) onSaved(nextTitle);
    } catch {
      // network error — title stays unchanged
    }
  };

  if (!editable) {
    return (
      <Text fontSize={fontSize} fontWeight={fontWeight} color="gray.900">
        {current}
      </Text>
    );
  }

  return (
    <Box>
      {isEditing ? (
        <Input
          size="sm"
          defaultValue={current}
          autoFocus
          onBlur={(e) => handleBlur(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              cancelledRef.current = true;
              setIsEditing(false);
            }
          }}
          fontSize={fontSize}
          fontWeight={fontWeight}
        />
      ) : (
        <Text
          fontSize={fontSize}
          fontWeight={fontWeight}
          color="gray.900"
          cursor="pointer"
          _hover={{ color: "brand.orange" }}
          onClick={() => setIsEditing(true)}
          title="Click to rename"
        >
          {current}
        </Text>
      )}
    </Box>
  );
}
