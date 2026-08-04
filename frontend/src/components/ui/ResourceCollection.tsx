import type { ReactNode } from "react";
import { Box, Grid, Text } from "@chakra-ui/react";

interface ResourceCollectionProps {
  columns: string;
  headers: ReactNode[];
  children: ReactNode;
}

export function ResourceCollection({
  columns,
  headers,
  children,
}: ResourceCollectionProps) {
  return (
    <Box as="section" aria-label="Resource collection">
      <Grid
        display={{ base: "none", md: "grid" }}
        gridTemplateColumns={columns}
        gap={3}
        px={3}
        py={2}
        borderBottom="1px solid"
        borderColor="border"
      >
        {headers.map((header, index) => (
          <Text key={index} textStyle="label" color="fg.muted">
            {header}
          </Text>
        ))}
      </Grid>
      <Box display="grid" gap={{ base: 3, md: 0 }}>
        {children}
      </Box>
    </Box>
  );
}

interface ResourceCollectionRowProps {
  columns: string;
  children: ReactNode;
}

export function ResourceCollectionRow({
  columns,
  children,
}: ResourceCollectionRowProps) {
  return (
    <Grid
      as="article"
      gridTemplateColumns={{ base: "1fr", md: columns }}
      gap={{ base: 3, md: 3 }}
      alignItems={{ md: "center" }}
      p={{ base: 4, md: 3 }}
      bg="bg.raised"
      border="1px solid"
      borderColor="border"
      borderRadius={{ base: "panel", md: 0 }}
      borderTopWidth={{ md: 0 }}
    >
      {children}
    </Grid>
  );
}

interface ResourceCollectionCellProps {
  label: string;
  primary?: boolean;
  children: ReactNode;
}

export function ResourceCollectionCell({
  label,
  primary = false,
  children,
}: ResourceCollectionCellProps) {
  return (
    <Box
      minW={0}
      display={{ base: primary ? "block" : "flex", md: "block" }}
      alignItems="center"
      justifyContent="space-between"
      gap={3}
    >
      {!primary && (
        <Text
          display={{ base: "block", md: "none" }}
          textStyle="label"
          color="fg.muted"
        >
          {label}
        </Text>
      )}
      {children}
    </Box>
  );
}
