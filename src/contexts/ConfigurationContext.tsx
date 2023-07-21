import {createContext} from "react";
import {NetworkName} from "../utils/networks";

export const ConfigurationContext = createContext<{
  trustedCheckpoint: string;
  network: NetworkName;
  beaconUrl: string;
  rpcUrl: string;
  setNetwork: (network: NetworkName) => void;
  setTrustedCheckpoint: (trustedCheckpoint: string) => void;
  setBeaconUrl: (beaconUrl: string) => void;
  setRpcUrl: (elRpcUrl: string) => void;
}>({
  trustedCheckpoint: "",
  network: NetworkName.mainnet,
  beaconUrl: "",
  rpcUrl: "",
  // We will fill these with actual state in AppContextWrapper.tsx
  setNetwork: () => {},
  setTrustedCheckpoint: () => {},
  setBeaconUrl: () => {},
  setRpcUrl: () => {},
});
