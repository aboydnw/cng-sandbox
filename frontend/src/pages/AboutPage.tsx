import { Box, Flex, Text, Heading, Table } from "@chakra-ui/react";
import {
  UploadSimple,
  ArrowsClockwise,
  GridFour,
  GlobeHemisphereWest,
  ArrowRight,
} from "@phosphor-icons/react";
import { Header } from "../components/Header";

const PIPELINE_STEPS = [
  {
    icon: UploadSimple,
    label: "Upload",
    description: "Bring your GeoTIFF, GeoJSON, Shapefile, NetCDF, or HDF5 file",
  },
  {
    icon: ArrowsClockwise,
    label: "Convert",
    description: "Data is converted to cloud-native formats (COG, GeoParquet)",
  },
  {
    icon: GridFour,
    label: "Tile",
    description: "Tilers serve your data as map tiles on demand",
  },
  {
    icon: GlobeHemisphereWest,
    label: "View",
    description: "Explore your data on an interactive map in the browser",
  },
];

const OPEN_SOURCE_STACK = [
  {
    role: "Spatial catalog",
    project: "pgSTAC",
    url: "https://github.com/stac-utils/pgstac",
    maintainer: "stac-utils community",
  },
  {
    role: "Catalog API",
    project: "stac-fastapi",
    url: "https://github.com/stac-utils/stac-fastapi-pgstac",
    maintainer: "stac-utils community",
  },
  {
    role: "Raster tiles",
    project: "titiler",
    url: "https://github.com/developmentseed/titiler",
    maintainer: "Development Seed",
  },
  {
    role: "STAC raster tiles",
    project: "titiler-pgstac",
    url: "https://github.com/stac-utils/titiler-pgstac",
    maintainer: "stac-utils / Development Seed",
  },
  {
    role: "Vector tiles",
    project: "tipg",
    url: "https://github.com/developmentseed/tipg",
    maintainer: "Development Seed",
  },
  {
    role: "Vector maps",
    project: "MapLibre GL JS",
    url: "https://github.com/maplibre/maplibre-gl-js",
    maintainer: "MapLibre community",
  },
  {
    role: "Raster visualization",
    project: "deck.gl",
    url: "https://github.com/visgl/deck.gl",
    maintainer: "vis.gl / Open Visualization",
  },
  {
    role: "Database",
    project: "PostGIS",
    url: "https://github.com/postgis/postgis",
    maintainer: "PostGIS PSC",
  },
  {
    role: "Browser SQL",
    project: "DuckDB-WASM",
    url: "https://github.com/duckdb/duckdb-wasm",
    maintainer: "DuckDB Foundation",
  },
  {
    role: "Tile format",
    project: "PMTiles",
    url: "https://github.com/protomaps/PMTiles",
    maintainer: "Protomaps / Brandon Liu",
  },
];

export default function AboutPage() {
  return (
    <Box minH="100vh" bg="gray.50">
      <Header />
      <Box maxW="960px" mx="auto" py={8} px={4}>
        <Box mb={10}>
          <Heading size="lg" color="brand.brown" mb={4}>
            About CNG Sandbox
          </Heading>
          <Text color="gray.700" fontSize="md" lineHeight="tall" mb={3}>
            CNG Sandbox is a hands-on demonstration of the cloud-native
            geospatial ecosystem. Upload your data and see what open source
            tools from the CNG community can do — converting, tiling, and
            visualizing geospatial formats in the browser.
          </Text>
          <Text color="gray.700" fontSize="md" lineHeight="tall" mb={4}>
            It's not a SaaS platform, a conversion engine, or a data warehouse.
            It's a sandbox — a place to explore the capabilities that these
            tools make possible when assembled together.
          </Text>
          <Text fontSize="sm" color="gray.600">
            Learn more about the cloud-native geospatial movement at{" "}
            <a
              href="https://cloudnativegeo.org/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--chakra-colors-brand-orange)",
                fontWeight: 600,
              }}
            >
              cloudnativegeo.org
            </a>
          </Text>
        </Box>

        <Box mb={10}>
          <Heading size="md" color="gray.700" mb={4}>
            How it works
          </Heading>
          <Flex
            direction={{ base: "column", md: "row" }}
            gap={{ base: 4, md: 0 }}
            align={{ base: "stretch", md: "flex-start" }}
          >
            {PIPELINE_STEPS.map((step, i) => (
              <Flex
                key={step.label}
                direction={{ base: "row", md: "column" }}
                align={{ base: "center", md: "center" }}
                textAlign={{ base: "left", md: "center" }}
                flex={1}
                gap={{ base: 3, md: 0 }}
              >
                <Box flexShrink={0} mb={{ base: 0, md: 2 }}>
                  <step.icon
                    size={28}
                    weight="duotone"
                    color="var(--chakra-colors-gray-500)"
                  />
                </Box>
                <Box flex={1}>
                  <Text fontWeight={600} color="gray.800" fontSize="sm">
                    {step.label}
                  </Text>
                  <Text color="gray.600" fontSize="xs" mt={1}>
                    {step.description}
                  </Text>
                </Box>
                {i < PIPELINE_STEPS.length - 1 && (
                  <Box
                    display={{ base: "none", md: "flex" }}
                    alignItems="center"
                    px={3}
                    pt={3}
                  >
                    <ArrowRight
                      size={16}
                      color="var(--chakra-colors-gray-400)"
                    />
                  </Box>
                )}
              </Flex>
            ))}
          </Flex>
        </Box>

        <Box mb={10}>
          <Heading size="md" color="gray.700" mb={2}>
            Open source stack
          </Heading>
          <Text color="gray.600" fontSize="sm" mb={4}>
            CNG Sandbox is built entirely on open source tools from the
            geospatial community.
          </Text>
          <Box
            borderRadius="md"
            overflow="hidden"
            border="1px solid"
            borderColor="gray.200"
          >
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row bg="gray.100">
                  <Table.ColumnHeader color="gray.600" fontWeight={600}>
                    Role
                  </Table.ColumnHeader>
                  <Table.ColumnHeader color="gray.600" fontWeight={600}>
                    Project
                  </Table.ColumnHeader>
                  <Table.ColumnHeader color="gray.600" fontWeight={600}>
                    Primary maintainer(s)
                  </Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {OPEN_SOURCE_STACK.map((item) => (
                  <Table.Row key={item.project}>
                    <Table.Cell color="gray.600" fontSize="sm">
                      {item.role}
                    </Table.Cell>
                    <Table.Cell>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: "var(--chakra-colors-brand-orange)",
                          fontWeight: 500,
                          fontSize: "var(--chakra-fontSizes-sm)",
                        }}
                      >
                        {item.project}
                      </a>
                    </Table.Cell>
                    <Table.Cell color="gray.600" fontSize="sm">
                      {item.maintainer}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
        </Box>

        <Box mb={8}>
          <Text color="gray.500" fontSize="sm">
            Built by{" "}
            <a
              href="https://developmentseed.org/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--chakra-colors-brand-orange)",
                fontWeight: 600,
              }}
            >
              Development Seed
            </a>
            {" · "}v1.15.1
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
