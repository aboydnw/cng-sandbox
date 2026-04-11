/**
 * Frontend-side mirror of the source.coop curated product registry.
 * Kept in sync manually with ingestion/src/services/source_coop_config.py.
 */

export interface SourceCoopProduct {
  slug: string;
  name: string;
  description: string;
  thumbnail: string;
  tags: string[];
  isTemporal: boolean;
}

export const sourceCoopCatalog: SourceCoopProduct[] = [
  {
    slug: "ausantarctic/ghrsst-mur-v2",
    name: "GHRSST MUR v2 — Daily SST (2024)",
    description:
      "Multi-scale Ultra-high Resolution sea surface temperature analysis, daily global coverage. v1 shows the 2024 subset (366 days).",
    thumbnail: "/thumbnails/ghrsst.jpg",
    tags: ["ocean", "temperature", "temporal"],
    isTemporal: true,
  },
  {
    slug: "alexgleith/gebco-2024",
    name: "GEBCO 2024 Bathymetry",
    description:
      "Global ocean and land terrain model from the General Bathymetric Chart of the Oceans, 2024 release.",
    thumbnail: "/thumbnails/gebco.jpg",
    tags: ["bathymetry", "terrain", "global"],
    isTemporal: false,
  },
  {
    slug: "vizzuality/lg-land-carbon-data",
    name: "Land & Carbon Lab Carbon Data",
    description:
      "Land carbon flux and stock rasters produced by the WRI Land & Carbon Lab.",
    thumbnail: "/thumbnails/lg-land-carbon.jpg",
    tags: ["carbon", "land", "climate"],
    isTemporal: false,
  },
];

export function getProduct(slug: string): SourceCoopProduct {
  const product = sourceCoopCatalog.find((p) => p.slug === slug);
  if (!product) {
    throw new Error(`Unknown source.coop product slug: ${slug}`);
  }
  return product;
}
