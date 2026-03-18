import { useState, useEffect } from "react";
import { Box, Button, Flex, Text, Textarea, Badge } from "@chakra-ui/react";

interface SqlEditorProps {
  sql: string;
  isCustomMode: boolean;
  error: string | null;
  loading: boolean;
  onRunQuery: (sql: string) => void;
  onSetCustomSql: (sql: string) => void;
  onReset: () => void;
}

export function SqlEditor({
  sql,
  isCustomMode,
  error,
  loading,
  onRunQuery,
  onSetCustomSql,
  onReset,
}: SqlEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const [editValue, setEditValue] = useState(sql);

  // Keep editValue in sync when filters generate new SQL (only in filter mode)
  useEffect(() => {
    if (!isCustomMode) setEditValue(sql);
  }, [sql, isCustomMode]);

  return (
    <Box>
      <Flex
        align="center"
        gap={2}
        cursor="pointer"
        onClick={() => setExpanded((e) => !e)}
        py={1}
      >
        <Text fontSize="xs" fontWeight={600} color="gray.600">
          {expanded ? "▼" : "▶"} SQL
        </Text>
        {isCustomMode && (
          <Badge colorPalette="orange" size="sm">Custom SQL</Badge>
        )}
      </Flex>

      {!expanded && (
        <Text fontSize="xs" color="gray.500" truncate fontFamily="mono">
          {sql}
        </Text>
      )}

      {expanded && (
        <Box>
          <Textarea
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              onSetCustomSql(e.target.value);
            }}
            fontFamily="mono"
            fontSize="xs"
            rows={4}
            resize="vertical"
            mb={2}
          />
          <Flex gap={2}>
            <Button
              size="xs"
              colorPalette="orange"
              onClick={() => onRunQuery(editValue)}
              loading={loading}
            >
              Run query
            </Button>
            {isCustomMode && (
              <Button size="xs" variant="ghost" onClick={onReset}>
                Reset to filters
              </Button>
            )}
          </Flex>
        </Box>
      )}

      {error && (
        <Text fontSize="xs" color="red.500" mt={1}>
          {error}
        </Text>
      )}
    </Box>
  );
}
