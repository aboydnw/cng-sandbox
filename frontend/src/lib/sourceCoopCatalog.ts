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
    name: "GHRSST MUR v2 — Daily Global SST",
    description:
      "Multi-scale Ultra-high Resolution sea surface temperature analysis, daily global coverage across the product's full temporal range.",
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
    name: "Land & Carbon Lab: Deforestation Carbon Emissions",
    description:
      "Gross carbon emissions from deforestation at 100 m resolution, produced by the WRI Land & Carbon Lab.",
    thumbnail: "/thumbnails/lg-land-carbon.jpg",
    tags: ["carbon", "deforestation", "climate"],
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
