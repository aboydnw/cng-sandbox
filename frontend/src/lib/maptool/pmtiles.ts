import { Protocol } from "pmtiles";

export interface PMTilesProtocolResult {
  protocol: InstanceType<typeof Protocol>;
  cleanup: () => void;
}

export function createPMTilesProtocol(): PMTilesProtocolResult {
  const protocol = new Protocol();

  return {
    protocol,
    cleanup: () => {}
  };
}
