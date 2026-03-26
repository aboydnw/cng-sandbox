import { Box, Flex, Text, Slider, Button } from "@chakra-ui/react";
import { X, Plus } from "@phosphor-icons/react";
import type {
  Filter,
  NumericFilter,
  CategoricalFilter,
} from "../hooks/useFilterQuery";
import type { ColumnStats } from "../hooks/useGeoParquetQuery";

interface FilterControlsProps {
  filters: Filter[];
  availableColumns: ColumnStats[];
  onUpdateFilter: (
    column: string,
    update: Partial<NumericFilter> | Partial<CategoricalFilter>
  ) => void;
  onAddFilter: (stat: ColumnStats) => void;
  onRemoveFilter: (column: string) => void;
  disabled: boolean;
}

function NumericFilterControl({
  filter,
  onUpdate,
  onRemove,
  disabled,
}: {
  filter: NumericFilter;
  onUpdate: (update: Partial<NumericFilter>) => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const formatNum = (n: number) =>
    Math.abs(n) >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : Math.abs(n) >= 1_000
        ? `${(n / 1_000).toFixed(1)}K`
        : n.toFixed(n % 1 === 0 ? 0 : 1);

  return (
    <Box mb={3}>
      <Flex justify="space-between" align="center" mb={1}>
        <Text fontSize="xs" fontWeight={500} truncate>
          {filter.column}
        </Text>
        <Text
          fontSize="xs"
          color="gray.400"
          cursor="pointer"
          onClick={onRemove}
          display="flex"
          alignItems="center"
        >
          <X size={10} weight="bold" />
        </Text>
      </Flex>
      <Slider.Root
        min={filter.min}
        max={filter.max}
        step={(filter.max - filter.min) / 100}
        value={[filter.currentMin, filter.currentMax]}
        onValueChange={({ value }: { value: number[] }) =>
          onUpdate({ currentMin: value[0], currentMax: value[1] })
        }
        disabled={disabled}
      >
        <Slider.Control>
          <Slider.Track>
            <Slider.Range />
          </Slider.Track>
          <Slider.Thumb index={0} />
          <Slider.Thumb index={1} />
        </Slider.Control>
      </Slider.Root>
      <Flex justify="space-between" mt={0.5}>
        <Text fontSize="2xs" color="gray.500">
          {formatNum(filter.currentMin)}
        </Text>
        <Text fontSize="2xs" color="gray.500">
          {formatNum(filter.currentMax)}
        </Text>
      </Flex>
    </Box>
  );
}

function CategoricalFilterControl({
  filter,
  onUpdate,
  onRemove,
  disabled,
}: {
  filter: CategoricalFilter;
  onUpdate: (update: Partial<CategoricalFilter>) => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const toggle = (value: string) => {
    const selected = filter.selected.includes(value)
      ? filter.selected.filter((v) => v !== value)
      : [...filter.selected, value];
    onUpdate({ selected });
  };

  return (
    <Box mb={3}>
      <Flex justify="space-between" align="center" mb={1}>
        <Text fontSize="xs" fontWeight={500} truncate>
          {filter.column}
        </Text>
        <Text
          fontSize="xs"
          color="gray.400"
          cursor="pointer"
          onClick={onRemove}
          display="flex"
          alignItems="center"
        >
          <X size={10} weight="bold" />
        </Text>
      </Flex>
      <Flex wrap="wrap" gap={1}>
        {filter.values.map((v) => (
          <Button
            key={v}
            size="2xs"
            variant={filter.selected.includes(v) ? "solid" : "outline"}
            colorPalette={filter.selected.includes(v) ? "orange" : "gray"}
            onClick={() => toggle(v)}
            disabled={disabled}
            fontSize="2xs"
          >
            {v}
          </Button>
        ))}
      </Flex>
    </Box>
  );
}

export function FilterControls({
  filters,
  availableColumns,
  onUpdateFilter,
  onAddFilter,
  onRemoveFilter,
  disabled,
}: FilterControlsProps) {
  const activeColumnNames = new Set(filters.map((f) => f.column));
  const addableColumns = availableColumns.filter(
    (s) =>
      !activeColumnNames.has(s.name) &&
      (s.type === "numeric" || s.type === "categorical")
  );

  return (
    <Box>
      {filters.map((f) =>
        f.type === "numeric" ? (
          <NumericFilterControl
            key={f.column}
            filter={f}
            onUpdate={(u) => onUpdateFilter(f.column, u)}
            onRemove={() => onRemoveFilter(f.column)}
            disabled={disabled}
          />
        ) : (
          <CategoricalFilterControl
            key={f.column}
            filter={f as CategoricalFilter}
            onUpdate={(u) => onUpdateFilter(f.column, u)}
            onRemove={() => onRemoveFilter(f.column)}
            disabled={disabled}
          />
        )
      )}

      {addableColumns.length > 0 && (
        <Box mt={2}>
          <Flex align="center" gap={1.5} mb={1}>
            <Plus size={12} weight="bold" />
            <Text fontSize="xs" color="gray.500">
              Add filter
            </Text>
          </Flex>
          <Flex wrap="wrap" gap={1}>
            {addableColumns.slice(0, 10).map((s) => (
              <Button
                key={s.name}
                size="2xs"
                variant="outline"
                onClick={() => onAddFilter(s)}
                fontSize="2xs"
              >
                {s.name}
              </Button>
            ))}
          </Flex>
        </Box>
      )}
    </Box>
  );
}
