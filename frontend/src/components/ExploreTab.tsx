import { useEffect, useCallback, useRef } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { SpinnerGap } from "@phosphor-icons/react";
import type { Table } from "apache-arrow";
import { useDuckDB } from "../hooks/useDuckDB";
import { useGeoParquetQuery } from "../hooks/useGeoParquetQuery";
import { useFilterQuery } from "../hooks/useFilterQuery";
import { FilterControls } from "./FilterControls";
import { SqlEditor } from "./SqlEditor";
import { formatCount } from "../utils/format";

interface ExploreTabProps {
  parquetUrl: string;
  onTableChange: (table: Table | null) => void;
}

export function ExploreTab({ parquetUrl, onTableChange }: ExploreTabProps) {
  const {
    db,
    conn,
    loading: duckdbLoading,
    error: duckdbError,
    initialize,
  } = useDuckDB();
  const {
    result,
    loading: queryLoading,
    runQuery,
    loadInitial,
  } = useGeoParquetQuery(conn, parquetUrl);

  const handleSqlChange = useCallback(
    (sql: string) => {
      if (conn) runQuery(sql);
    },
    [conn, runQuery]
  );

  const filterQuery = useFilterQuery({
    parquetUrl,
    onSqlChange: handleSqlChange,
  });

  // Initialize DuckDB on mount
  useEffect(() => {
    if (!db && !duckdbLoading) {
      initialize();
    }
  }, [db, duckdbLoading, initialize]);

  // Load initial data once connected
  useEffect(() => {
    if (conn && result.totalCount === 0 && !queryLoading) {
      loadInitial();
    }
  }, [conn, result.totalCount, queryLoading, loadInitial]);

  // Build filters once we have stats (only once)
  const filtersInitialized = useRef(false);
  useEffect(() => {
    if (result.columnStats.length > 0 && !filtersInitialized.current) {
      filtersInitialized.current = true;
      filterQuery.buildFiltersFromStats(result.columnStats);
    }
  }, [result.columnStats, filterQuery.buildFiltersFromStats]);

  // Propagate Arrow table to parent for DuckDBMap rendering
  useEffect(() => {
    onTableChange(result.table);
  }, [result.table, onTableChange]);

  if (duckdbLoading) {
    return (
      <Flex
        align="center"
        justify="center"
        h="200px"
        direction="column"
        gap={3}
      >
        <SpinnerGap
          size={24}
          color="#CF3F02"
          style={{ animation: "spin 1s linear infinite" }}
        />
        <Text fontSize="sm" color="gray.500">
          Loading DuckDB...
        </Text>
      </Flex>
    );
  }

  if (duckdbError) {
    return (
      <Box p={4}>
        <Text fontSize="sm" color="red.500">
          {duckdbError}
        </Text>
        <Text fontSize="xs" color="gray.500" mt={2}>
          Your browser may not support WebAssembly.
        </Text>
      </Box>
    );
  }

  return (
    <Box p={4} fontSize="sm">
      {/* Feature count */}
      <Box mb={4}>
        <Text fontSize="2xl" fontWeight={700} lineHeight={1}>
          {queryLoading ? "..." : formatCount(result.filteredCount)}
          {result.totalCount > 0 &&
            result.filteredCount !== result.totalCount && (
              <Text as="span" fontSize="sm" fontWeight={400} color="gray.500">
                {" "}
                of {formatCount(result.totalCount)}
              </Text>
            )}
        </Text>
        <Text fontSize="xs" color="gray.500">
          features
        </Text>
        {result.truncated && (
          <Text fontSize="xs" color="orange.500" mt={1}>
            Showing first 100,000 features. Add filters to narrow results.
          </Text>
        )}
      </Box>

      {/* Filters */}
      <Box mb={4}>
        <Text fontSize="xs" fontWeight={600} color="gray.600" mb={2}>
          Filters
        </Text>
        <FilterControls
          filters={filterQuery.filters}
          availableColumns={filterQuery.availableColumns}
          onUpdateFilter={filterQuery.updateFilter}
          onAddFilter={filterQuery.addFilter}
          onRemoveFilter={filterQuery.removeFilter}
          disabled={filterQuery.isCustomMode || queryLoading}
        />
      </Box>

      {/* SQL Editor */}
      <Box mb={4}>
        <SqlEditor
          sql={filterQuery.currentSql}
          isCustomMode={filterQuery.isCustomMode}
          error={result.error}
          loading={queryLoading}
          onRunQuery={runQuery}
          onSetCustomSql={filterQuery.setCustomSql}
          onReset={filterQuery.resetToFilters}
        />
      </Box>

      {/* Column Stats */}
      {result.columnStats.length > 0 && (
        <Box>
          <Text fontSize="xs" fontWeight={600} color="gray.600" mb={2}>
            Column stats
          </Text>
          {result.columnStats.slice(0, 6).map((stat) => (
            <Box key={stat.name} mb={2}>
              <Text fontSize="xs" fontWeight={500}>
                {stat.name}
              </Text>
              {stat.type === "numeric" && (
                <Text fontSize="2xs" color="gray.500">
                  {stat.min?.toLocaleString()} – {stat.max?.toLocaleString()}
                  {stat.mean != null && ` · avg ${stat.mean.toLocaleString()}`}
                </Text>
              )}
              {stat.type === "categorical" && (
                <Text fontSize="2xs" color="gray.500">
                  {stat.uniqueCount} unique values
                </Text>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
