import { useState, useRef } from "react";
import { Box, Flex, Text, Input } from "@chakra-ui/react";
import { workspaceFetch } from "../lib/api";

interface Category {
  value: number;
  color: string;
  label: string;
}

interface EditableCategoryLegendProps {
  datasetId: string;
  categories: Category[];
  onCategoriesChange: (categories: Category[]) => void;
}

export function EditableCategoryLegend({
  datasetId,
  categories,
  onCategoriesChange,
}: EditableCategoryLegendProps) {
  const [editingValue, setEditingValue] = useState<number | null>(null);
  const cancelledRef = useRef(false);

  const handleBlur = (value: number, newLabel: string) => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setEditingValue(null);
      return;
    }
    setEditingValue(null);
    const original = categories.find((c) => c.value === value);
    if (!original || original.label === newLabel) return;

    // Optimistic update
    const updated = categories.map((c) =>
      c.value === value ? { ...c, label: newLabel } : c
    );
    onCategoriesChange(updated);

    // Persist
    workspaceFetch(`/api/datasets/${datasetId}/categories`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ value, label: newLabel }]),
    }).catch(() => {
      // Revert on failure
      onCategoriesChange(categories);
    });
  };

  return (
    <Box>
      <Text
        fontSize="11px"
        color="brand.textSecondary"
        fontWeight={600}
        textTransform="uppercase"
        letterSpacing="1px"
        mb={2}
      >
        Categories
      </Text>
      <Box
        as="ul"
        listStyleType="none"
        m={0}
        p={0}
        display="flex"
        flexDirection="column"
        gap={1}
      >
        {categories.map((cat) => (
          <Flex
            as="li"
            key={cat.value}
            alignItems="center"
            gap={2}
            fontSize="12px"
          >
            <Box
              flexShrink={0}
              w="12px"
              h="12px"
              rounded="sm"
              style={{ backgroundColor: cat.color }}
            />
            {editingValue === cat.value ? (
              <Input
                size="xs"
                defaultValue={cat.label}
                autoFocus
                onBlur={(e) => handleBlur(cat.value, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                  }
                  if (e.key === "Escape") {
                    cancelledRef.current = true;
                    setEditingValue(null);
                  }
                }}
                px={1}
                py={0}
                h="20px"
                fontSize="12px"
                border="1px solid"
                borderColor="brand.border"
                borderRadius="4px"
              />
            ) : (
              <Text
                as="span"
                color="gray.800"
                cursor="pointer"
                _hover={{ color: "brand.orange" }}
                onClick={() => setEditingValue(cat.value)}
                title="Click to edit"
              >
                {cat.label}
              </Text>
            )}
          </Flex>
        ))}
      </Box>
    </Box>
  );
}
