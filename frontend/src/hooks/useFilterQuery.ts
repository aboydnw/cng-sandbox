import { useState, useCallback, useRef, useEffect } from "react";
import type { ColumnStats } from "./useGeoParquetQuery";
import { toAbsoluteUrl } from "../lib/url";

export interface NumericFilter {
  column: string;
  type: "numeric";
  min: number;
  max: number;
  currentMin: number;
  currentMax: number;
}

export interface CategoricalFilter {
  column: string;
  type: "categorical";
  values: string[];
  selected: string[];
}

export type Filter = NumericFilter | CategoricalFilter;

interface UseFilterQueryOptions {
  parquetUrl: string;
  onSqlChange: (sql: string) => void;
  debounceMs?: number;
}

const MAX_AUTO_FILTERS = 8;

export function useFilterQuery({ parquetUrl, onSqlChange, debounceMs = 300 }: UseFilterQueryOptions) {
  const [filters, setFilters] = useState<Filter[]>([]);
  const [customSql, setCustomSql] = useState<string | null>(null);
  const [availableColumns, setAvailableColumns] = useState<ColumnStats[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fullUrl = toAbsoluteUrl(parquetUrl);
  const baseSql = `SELECT * FROM read_parquet('${fullUrl}')`;

  const buildFiltersFromStats = useCallback((stats: ColumnStats[]) => {
    setAvailableColumns(stats);
    const autoFilters: Filter[] = [];

    // Priority 1: numeric with variance
    const numerics = stats.filter(
      (s) => s.type === "numeric" && s.min != null && s.max != null && s.min !== s.max,
    );
    for (const s of numerics) {
      if (autoFilters.length >= MAX_AUTO_FILTERS) break;
      autoFilters.push({
        column: s.name,
        type: "numeric",
        min: s.min!,
        max: s.max!,
        currentMin: s.min!,
        currentMax: s.max!,
      });
    }

    // Priority 2: categorical with 2-20 unique values
    const categoricals = stats.filter(
      (s) => s.type === "categorical" && s.uniqueCount != null && s.uniqueCount >= 2 && s.uniqueCount! <= 20 && s.topValues?.length,
    );
    for (const s of categoricals) {
      if (autoFilters.length >= MAX_AUTO_FILTERS) break;
      const values = s.topValues!.map((v) => v.value);
      autoFilters.push({
        column: s.name,
        type: "categorical",
        values,
        selected: [...values], // all selected by default
      });
    }

    setFilters(autoFilters);
  }, []);

  const generateSql = useCallback(() => {
    if (customSql !== null) return customSql;

    const clauses: string[] = [];
    for (const f of filters) {
      if (f.type === "numeric") {
        if (f.currentMin !== f.min || f.currentMax !== f.max) {
          clauses.push(`"${f.column}" BETWEEN ${f.currentMin} AND ${f.currentMax}`);
        }
      } else if (f.type === "categorical") {
        if (f.selected.length < f.values.length) {
          const escaped = f.selected.map((v) => `'${v.replace(/'/g, "''")}'`);
          clauses.push(`"${f.column}" IN (${escaped.join(", ")})`);
        }
      }
    }

    return clauses.length > 0 ? `${baseSql} WHERE ${clauses.join(" AND ")}` : baseSql;
  }, [filters, customSql, baseSql]);

  const updateFilter = useCallback(
    (column: string, update: Partial<NumericFilter> | Partial<CategoricalFilter>) => {
      setCustomSql(null); // revert to filter mode
      setFilters((prev) =>
        prev.map((f) => (f.column === column ? ({ ...f, ...update } as Filter) : f)),
      );
    },
    [],
  );

  const addFilter = useCallback(
    (stat: ColumnStats) => {
      if (filters.some((f) => f.column === stat.name)) return;
      if (stat.type === "numeric" && stat.min != null && stat.max != null) {
        setFilters((prev) => [
          ...prev,
          { column: stat.name, type: "numeric", min: stat.min!, max: stat.max!, currentMin: stat.min!, currentMax: stat.max! },
        ]);
      } else if (stat.type === "categorical" && stat.topValues?.length) {
        const values = stat.topValues.map((v) => v.value);
        setFilters((prev) => [
          ...prev,
          { column: stat.name, type: "categorical", values, selected: [...values] },
        ]);
      }
    },
    [filters],
  );

  const removeFilter = useCallback((column: string) => {
    setFilters((prev) => prev.filter((f) => f.column !== column));
  }, []);

  const resetToFilters = useCallback(() => {
    setCustomSql(null);
  }, []);

  // Debounced SQL emission
  useEffect(() => {
    const sql = generateSql();
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSqlChange(sql), debounceMs);
    return () => clearTimeout(debounceRef.current);
  }, [generateSql, onSqlChange, debounceMs]);

  const isCustomMode = customSql !== null;
  const currentSql = generateSql();

  return {
    filters,
    availableColumns,
    isCustomMode,
    currentSql,
    buildFiltersFromStats,
    updateFilter,
    addFilter,
    removeFilter,
    setCustomSql,
    resetToFilters,
  };
}
