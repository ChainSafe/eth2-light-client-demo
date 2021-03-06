import {networkGenesis} from "@chainsafe/lodestar-light-client/networks";
import {networksChainConfig} from "@chainsafe/lodestar-config/networks";
import {getClient} from "@chainsafe/lodestar-api";
import {config as configDefault} from "@chainsafe/lodestar-config/default";
import {toHexString} from "@chainsafe/ssz";
import {chainConfigFromJson} from "@chainsafe/lodestar-config";

export enum NetworkName {
  mainnet = "mainnet",
  prater = "prater",
  kiln = "kiln",
  custom = "custom",
}
export const networkDefault = NetworkName.kiln;

export type ERC20Contract = {
  contractAddress: string;
  balanceMappingIndex: number;
};

export async function getNetworkData(network: NetworkName, beaconApiUrl?: string) {
  switch (network) {
    case NetworkName.mainnet:
    case NetworkName.prater:
    case NetworkName.kiln:
      return {
        genesisData: networkGenesis[network],
        chainConfig: networksChainConfig[network],
      };

    default:
      if (!beaconApiUrl) {
        throw Error(`Unknown network: ${network}, requires beaconApiUrl to load config`);
      }
      const api = getClient({baseUrl: beaconApiUrl}, {config: configDefault});
      const {data: genesisData} = await api.beacon.getGenesis();
      const {data: chainConfig} = await api.config.getSpec();
      const networkData = {
        genesisData: {
          genesisTime: Number(genesisData.genesisTime),
          genesisValidatorsRoot: toHexString(genesisData.genesisValidatorsRoot),
        },
        chainConfig: chainConfigFromJson(chainConfig),
      };
      return networkData;
  }
}

export const defaultNetworkUrls: Record<NetworkName, {beaconApiUrl: string; elRpcUrl: string}> = {
  [NetworkName.mainnet]: {
    beaconApiUrl: process.env.REACT_APP_MAINNET_BEACON_API || "https://lodestar-mainnet.chainsafe.io",
    elRpcUrl: process.env.REACT_APP_MAINNET_EXECUTION_API || "https://lodestar-mainnetrpc.chainsafe.io",
  },
  [NetworkName.prater]: {
    beaconApiUrl: process.env.REACT_APP_PRATER_BEACON_API || "https://lodestar-prater.chainsafe.io",
    elRpcUrl: process.env.REACT_APP_PRATER_EXECUTION_API || "https://lodestar-praterrpc.chainsafe.io",
  },
  [NetworkName.kiln]: {
    beaconApiUrl: process.env.REACT_APP_KILN_BEACON_API || "https://lodestar-kiln.chainsafe.io",
    elRpcUrl: process.env.REACT_APP_KILN_EXECUTION_API || "https://lodestar-kilnrpc.chainsafe.io",
  },
  [NetworkName.custom]: {beaconApiUrl: "", elRpcUrl: ""},
};

export enum DefaultTokens {
  DAI = "DAI",
}
export const DefaultTokensMeta: Record<
  DefaultTokens,
  {balanceMappingIndex: number; addresses: Partial<Record<NetworkName, string>>}
> = {
  [DefaultTokens.DAI]: {
    balanceMappingIndex: 2,
    addresses: {[NetworkName.kiln]: "0x7b4343e96fa21413a8e5A15D67b529D2B9495437"},
  },
};

export function getNetworkTokens(network: NetworkName, includePartial: boolean = false): Record<string, ERC20Contract> {
  const tokens: Record<string, ERC20Contract> = {};
  for (const [tokenName, tokenMeta] of Object.entries(DefaultTokensMeta)) {
    if (tokenMeta.addresses[network] !== undefined || includePartial) {
      tokens[tokenName] = {
        balanceMappingIndex: tokenMeta.balanceMappingIndex,
        contractAddress: tokenMeta.addresses[network] ?? "",
      };
    }
  }
  return tokens;
}

export const defaultNetworkTokens: Record<
  NetworkName,
  {full: Record<string, ERC20Contract>; partial: Record<string, ERC20Contract>}
> = {
  [NetworkName.mainnet]: {
    full: getNetworkTokens(NetworkName.mainnet),
    partial: getNetworkTokens(NetworkName.mainnet, true),
  },
  [NetworkName.prater]: {
    full: getNetworkTokens(NetworkName.prater),
    partial: getNetworkTokens(NetworkName.prater, true),
  },
  [NetworkName.kiln]: {full: getNetworkTokens(NetworkName.kiln), partial: getNetworkTokens(NetworkName.kiln, true)},
  [NetworkName.custom]: {
    full: getNetworkTokens(NetworkName.custom),
    partial: getNetworkTokens(NetworkName.custom, true),
  },
};
