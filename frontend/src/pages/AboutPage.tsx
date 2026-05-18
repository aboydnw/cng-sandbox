import { Box, Flex, Text, Heading, Table } from "@chakra-ui/react";
import {
  UploadSimple,
  ArrowsClockwise,
  GridFour,
  GlobeHemisphereWest,
  ArrowRight,
  ArrowSquareOut,
} from "@phosphor-icons/react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";

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
    <Flex direction="column" minH="100vh" bg="gray.50">
      <Header />
      <Box maxW="960px" mx="auto" py={8} px={4}>
        <Box mb={10}>
          <Heading size="lg" color="brand.brown" mb={4}>
            About CNG Sandbox
          </Heading>
          <Text color="gray.700" fontSize="md" lineHeight="tall" mb={3}>
            The cloud-native geospatial ecosystem has produced an incredible set
            of open source tools for working with spatial data. CNG Sandbox lets
            you see them in action. Upload a GeoTIFF, GeoJSON, Shapefile, or
            NetCDF file and watch it get converted, tiled, and rendered as an
            interactive map in your browser.
          </Text>
          <Text color="gray.700" fontSize="md" lineHeight="tall" mb={3}>
            Think of it as a playground for the CNG stack. We built it to show
            what these tools can do when wired together, and to make it easy for
            anyone to try them without setting up infrastructure.
          </Text>
          <Text color="gray.700" fontSize="md" lineHeight="tall" mb={4}>
            CNG Sandbox is a{" "}
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
            </a>{" "}
            project, built on top of tools maintained by the broader geospatial
            community.
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
          <Heading size="md" color="gray.700" mb={2}>
            What this is — and what it isn&apos;t
          </Heading>
          <Text color="gray.700" fontSize="sm" lineHeight="tall" mb={3}>
            CNG Sandbox is an open-source demo of cloud-native geospatial
            storytelling, built by Development Seed. It exists to show
            what&apos;s possible when you wire COGs, GeoParquet, Zarr, and STAC
            together with a modern web stack — not to be the platform you run
            your team on.
          </Text>
          <Text color="gray.700" fontSize="sm" lineHeight="tall" mb={3}>
            Concretely: no SLA, no production support, no account or auth
            guarantees, and uploaded data expires after 30 days. The whole stack
            is open source — fork it, host it, or get in touch if you want
            something production-grade.
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

        <Box mb={10}>
          <Heading size="md" color="gray.700" mb={2}>
            Privacy & data
          </Heading>
          <Text color="gray.700" fontSize="sm" lineHeight="tall" mb={3}>
            CNG Sandbox is a public demo. Here is how we treat the data you
            upload and the activity you generate while using the site.
          </Text>

          <Text fontWeight={600} color="gray.800" fontSize="sm" mt={4} mb={1}>
            Your uploads and stories
          </Text>
          <Text color="gray.700" fontSize="sm" lineHeight="tall" mb={3}>
            Datasets you upload and stories you create are stored under a
            workspace ID generated for you. To protect against unbounded storage
            costs, both datasets and stories are automatically deleted 30 days
            after they are created. Treat the sandbox as a place to experiment,
            not a place to store work long-term. If you would like to explore a
            more permanent storage solution, please reach out to{" "}
            <a
              href="mailto:info@developmentseed.org"
              style={{
                color: "var(--chakra-colors-brand-orange)",
                fontWeight: 600,
              }}
            >
              info@developmentseed.org
            </a>
            .
          </Text>

          <Text fontWeight={600} color="gray.800" fontSize="sm" mt={4} mb={1}>
            Workspaces
          </Text>
          <Text color="gray.700" fontSize="sm" lineHeight="tall" mb={3}>
            You are automatically assigned a unique workspace code. This allows
            you to share your work with collaborators, but only if you directly
            share the URL or workspace ID with them. The workspace itself does
            not expire, but the datasets and stories inside it follow the 30-day
            policy above.
          </Text>

          <Text fontWeight={600} color="gray.800" fontSize="sm" mt={4} mb={1}>
            Analytics
          </Text>
          <Text color="gray.700" fontSize="sm" lineHeight="tall" mb={3}>
            We use{" "}
            <a
              href="https://plausible.io/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--chakra-colors-brand-orange)",
                fontWeight: 600,
              }}
            >
              Plausible Analytics
            </a>
            , which is privacy-friendly and does not use cookies,
            fingerprinting, or persistent identifiers. We track aggregate page
            views and events; we do not see who you are.
          </Text>

          <Text fontWeight={600} color="gray.800" fontSize="sm" mt={4} mb={1}>
            Account &amp; login
          </Text>
          <Text color="gray.700" fontSize="sm" lineHeight="tall" mb={3}>
            There is no account system. We don't ask for your email, name, or
            any other personal information.
          </Text>

          <Text fontWeight={600} color="gray.800" fontSize="sm" mt={4} mb={1}>
            Source code
          </Text>
          <Text color="gray.700" fontSize="sm" lineHeight="tall">
            The full source for this site is open on{" "}
            <a
              href="https://github.com/aboydnw/cng-sandbox"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--chakra-colors-brand-orange)",
                fontWeight: 600,
              }}
            >
              GitHub
            </a>
            .
          </Text>
        </Box>

        <Box mb={10}>
          <Heading size="md" color="gray.700" mb={2}>
            How to engage further
          </Heading>
          <Text color="gray.700" fontSize="sm" lineHeight="tall" mb={3}>
            Want to dig into the code, host your own copy, or talk about a
            production engagement? Here&apos;s where to start.
          </Text>
          <Box as="ul" pl={5} color="gray.700" fontSize="sm" lineHeight="tall">
            <Box as="li" mb={2}>
              <a
                href="https://github.com/aboydnw/cng-sandbox"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "var(--chakra-colors-brand-orange)",
                  fontWeight: 600,
                }}
              >
                <ArrowSquareOut
                  size={14}
                  weight="bold"
                  style={{
                    display: "inline",
                    marginRight: 4,
                    verticalAlign: "text-bottom",
                  }}
                  aria-hidden="true"
                />
                CNG Sandbox on GitHub
              </a>{" "}
              — the full source for this site.
            </Box>
            <Box as="li" mb={2}>
              <a
                href="https://github.com/developmentseed"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "var(--chakra-colors-brand-orange)",
                  fontWeight: 600,
                }}
              >
                <ArrowSquareOut
                  size={14}
                  weight="bold"
                  style={{
                    display: "inline",
                    marginRight: 4,
                    verticalAlign: "text-bottom",
                  }}
                  aria-hidden="true"
                />
                developmentseed on GitHub
              </a>{" "}
              — titiler, tipg, stac-fastapi, and other CNG building blocks.
            </Box>
            <Box as="li" mb={2}>
              <a
                href="https://developmentseed.org/contact"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "var(--chakra-colors-brand-orange)",
                  fontWeight: 600,
                }}
              >
                Contact Development Seed
              </a>{" "}
              — for production geospatial platform work.
            </Box>
          </Box>
        </Box>

        <Box mb={8}>
          <Text color="gray.500" fontSize="sm">
            <a
              href="https://github.com/aboydnw/cng-sandbox/releases"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--chakra-colors-brand-orange)",
                fontWeight: 600,
              }}
            >
              v{__APP_VERSION__}
            </a>
          </Text>
        </Box>
      </Box>
      <Footer />
    </Flex>
  );
}
