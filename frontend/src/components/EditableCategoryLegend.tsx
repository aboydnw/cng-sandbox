import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Box, Flex, Text, Input } from "@chakra-ui/react";
import { workspaceFetch } from "../lib/api";
import { CategoryColorPopover } from "./CategoryColorPopover";

interface Category {
  value: number;
  color: string;
  label: string;
  defaultColor?: string;
}

interface EditableCategoryLegendProps {
  datasetId: string;
  source?: "dataset" | "connection";
  categories: Category[];
  onCategoriesChange: (categories: Category[]) => void;
}

export function EditableCategoryLegend({
  datasetId,
  source = "dataset",
  categories,
  onCategoriesChange,
}: EditableCategoryLegendProps) {
  const [editingValue, setEditingValue] = useState<number | null>(null);
  const [colorEditingValue, setColorEditingValue] = useState<number | null>(
    null
  );
  const cancelledRef = useRef(false);
  const swatchRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const popupRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  useEffect(() => {
    if (colorEditingValue === null) return;
    function handleClickOutside(e: MouseEvent) {
      const swatchEl = swatchRefs.current.get(colorEditingValue!);
      if (swatchEl && swatchEl.contains(e.target as Node)) {
        return;
      }
      if (popupRef.current && popupRef.current.contains(e.target as Node)) {
        return;
      }
      setColorEditingValue(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [colorEditingValue]);

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
    const endpoint =
      source === "connection"
        ? `/api/connections/${datasetId}/categories`
        : `/api/datasets/${datasetId}/categories`;
    workspaceFetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ value, label: newLabel }]),
    }).catch(() => {
      // Revert on failure
      onCategoriesChange(categories);
    });
  };

  const handleColorSave = (value: number, nextColor: string) => {
    const original = categories.find((c) => c.value === value);
    if (!original || original.color === nextColor) return;

    const updated = categories.map((c) =>
      c.value === value
        ? { ...c, color: nextColor, defaultColor: c.defaultColor ?? c.color }
        : c
    );
    onCategoriesChange(updated);

    const endpoint =
      source === "connection"
        ? `/api/connections/${datasetId}/categories`
        : `/api/datasets/${datasetId}/categories`;
    workspaceFetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ value, color: nextColor }]),
    }).catch(() => {
      onCategoriesChange(categories.map((c) => (c.value === value ? original : c)));
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
              as="button"
              aria-label={`Edit color for ${cat.label}`}
              ref={(el: HTMLButtonElement | null) => {
                if (el) swatchRefs.current.set(cat.value, el);
                else swatchRefs.current.delete(cat.value);
              }}
              flexShrink={0}
              w="12px"
              h="12px"
              rounded="sm"
              style={{ backgroundColor: cat.color }}
              border="1px solid"
              borderColor="brand.border"
              onClick={() => {
                const btn = swatchRefs.current.get(cat.value);
                if (btn) {
                  const rect = btn.getBoundingClientRect();
                  setPopoverPos({ top: rect.bottom + 4, left: rect.left });
                }
                setColorEditingValue(cat.value);
              }}
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
      {colorEditingValue !== null &&
        popoverPos !== null &&
        createPortal(
          <Box
            ref={popupRef}
            position="fixed"
            top={`${popoverPos.top}px`}
            left={`${popoverPos.left}px`}
            zIndex={1000}
          >
            {(() => {
              const cat = categories.find((c) => c.value === colorEditingValue);
              if (!cat) return null;
              return (
                <CategoryColorPopover
                  color={cat.color}
                  defaultColor={cat.defaultColor ?? cat.color}
                  onClose={() => setColorEditingValue(null)}
                  onSave={(nextColor) => {
                    handleColorSave(colorEditingValue, nextColor);
                    setColorEditingValue(null);
                  }}
                />
              );
            })()}
          </Box>,
          document.body
        )}
    </Box>
  );
}
