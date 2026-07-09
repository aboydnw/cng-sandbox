export { detectConnectionType, extractNameFromUrl } from "./detect";
export { buildConnectionTileUrl } from "./tileUrl";
export { probePMTiles, probeCOG, probeCOPC } from "./probe";
export type { PMTilesMetadata, ProbeMetadata } from "./probe";
export { parseRescaleString } from "./rescale";
export {
  registerPMTilesConnection,
  registerCogConnection,
} from "./registerFromUrl";
