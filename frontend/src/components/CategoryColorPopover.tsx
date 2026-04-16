import { useState } from "react";
import { Box, Button, Flex, Input, Text } from "@chakra-ui/react";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

interface CategoryColorPopoverProps {
  color: string;
  defaultColor: string;
  onSave: (color: string) => void;
  onClose: () => void;
}

export function CategoryColorPopover({
  color,
  defaultColor,
  onSave,
  onClose,
}: CategoryColorPopoverProps) {
  const [draft, setDraft] = useState(color);
  const [error, setError] = useState<string | null>(null);

  const normalize = (v: string) => (v.startsWith("#") ? v : `#${v}`).toUpperCase();

  const handleSave = () => {
    const v = normalize(draft);
    if (!HEX_RE.test(v)) {
      setError("Color must be a 6-digit hex like #AB1234.");
      return;
    }
    onSave(v);
    onClose();
  };

  return (
    <Box
      p={3}
      bg="white"
      border="1px solid"
      borderColor="brand.border"
      borderRadius="8px"
      boxShadow="md"
      w="200px"
    >
      <Flex align="center" gap={2} mb={2}>
        <input
          type="color"
          value={HEX_RE.test(draft) ? normalize(draft) : defaultColor}
          onChange={(e) => {
            setDraft(e.target.value.toUpperCase());
            setError(null);
          }}
          style={{ width: 36, height: 36, border: 0, padding: 0, background: "transparent" }}
          aria-label="Color picker"
        />
        <Input
          size="sm"
          aria-label="Hex"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          fontFamily="mono"
          fontSize="12px"
        />
      </Flex>
      {error && (
        <Text fontSize="11px" color="red.600" mb={2}>
          {error}
        </Text>
      )}
      <Flex gap={2}>
        <Button size="xs" variant="outline" onClick={() => setDraft(defaultColor)}>
          Reset
        </Button>
        <Button size="xs" bg="brand.orange" color="white" onClick={handleSave}>
          Save
        </Button>
      </Flex>
    </Box>
  );
}
