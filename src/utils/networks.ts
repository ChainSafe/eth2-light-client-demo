import {ApiError} from "@lodestar/api";
import {ChainConfig, chainConfigFromJson} from "@lodestar/config";
import {networksChainConfig} from "@lodestar/config/networks";

import {getApiClient} from "./api";

export enum NetworkName {
  mainnet = "mainnet",
  goerli = "goerli",
  sepolia = "sepolia",
  custom = "custom",
}
export const networkDefault = NetworkName.mainnet;

export type ERC20Contract = {
  contractAddress: string;
  balanceMappingIndex: number;
};

export const defaultNetworkUrls: Record<NetworkName, {beaconApiUrl: string; elRpcUrl: string}> = {
  [NetworkName.mainnet]: {
    beaconApiUrl: process.env.REACT_APP_MAINNET_BEACON_API || "https://lodestar-mainnet.chainsafe.io",
    elRpcUrl: process.env.REACT_APP_MAINNET_EXECUTION_API || "https://lodestar-mainnetrpc.chainsafe.io",
  },
  [NetworkName.goerli]: {
    beaconApiUrl: process.env.REACT_APP_PRATER_BEACON_API || "https://lodestar-goerli.chainsafe.io",
    elRpcUrl: process.env.REACT_APP_PRATER_EXECUTION_API || "https://lodestar-goerlirpc.chainsafe.io",
  },
  [NetworkName.sepolia]: {
    beaconApiUrl: process.env.REACT_APP_SEPOLIA_BEACON_API || "https://lodestar-sepolia.chainsafe.io",
    elRpcUrl: process.env.REACT_APP_SEPOLIA_EXECUTION_API || "https://lodestar-sepoliarpc.chainsafe.io",
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
    addresses: {
      // DAI contract address on mainnet, for others user will be able to input
      [NetworkName.mainnet]: "0x6b175474e89094c44da98b954eedeac495271d0f",
    },
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
  [NetworkName.goerli]: {
    full: getNetworkTokens(NetworkName.goerli),
    partial: getNetworkTokens(NetworkName.goerli, true),
  },
  [NetworkName.sepolia]: {
    full: getNetworkTokens(NetworkName.sepolia),
    partial: getNetworkTokens(NetworkName.sepolia, true),
  },
  [NetworkName.custom]: {
    full: getNetworkTokens(NetworkName.custom),
    partial: getNetworkTokens(NetworkName.custom, true),
  },
};

export async function getChainConfig(network: NetworkName, beaconApiUrl?: string): Promise<ChainConfig> {
  switch (network) {
    case NetworkName.mainnet:
    case NetworkName.goerli:
    case NetworkName.sepolia:
      return networksChainConfig[network];

    default:
      if (!beaconApiUrl) {
        throw Error(`Unknown network: ${network}, requires beaconApiUrl to load config`);
      }
      const api = getApiClient(beaconApiUrl);

      const configRes = await api.config.getSpec();
      ApiError.assert(configRes);
      const chainConfig = configRes.response.data;

      return chainConfigFromJson(chainConfig);
  }
}
