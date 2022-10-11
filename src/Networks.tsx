import {genesisData as networkGenesis} from "@lodestar/config/networks";
import {networksChainConfig} from "@lodestar/config/networks";
import {getClient} from "@lodestar/api";
import {config as configDefault} from "@lodestar/config/default";
import {toHexString} from "@chainsafe/ssz";
import {chainConfigFromJson} from "@lodestar/config";

export enum NetworkName {
  mainnet = "mainnet",
  goerli = "goerli",
  custom = "custom",
}
export const networkDefault = NetworkName.mainnet;

export type ERC20Contract = {
  contractAddress: string;
  balanceMappingIndex: number;
};

export async function getNetworkData(network: NetworkName, beaconApiUrl?: string) {
  switch (network) {
    case NetworkName.mainnet:
    case NetworkName.goerli:
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
  [NetworkName.goerli]: {
    beaconApiUrl: process.env.REACT_APP_PRATER_BEACON_API || "https://lodestar-goerli.chainsafe.io",
    elRpcUrl: process.env.REACT_APP_PRATER_EXECUTION_API || "https://lodestar-goerlirpc.chainsafe.io",
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
  [NetworkName.custom]: {
    full: getNetworkTokens(NetworkName.custom),
    partial: getNetworkTokens(NetworkName.custom, true),
  },
};
