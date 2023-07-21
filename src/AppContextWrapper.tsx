import {useEffect, useRef, useState} from "react";
import App from "./App";
import {ProofProviderContext} from "./contexts/ProofProviderContext";
import {UiContext} from "./contexts/UiContext";
import {ConfigurationContext} from "./contexts/ConfigurationContext";
import {ApiContext} from "./contexts/ApiContext";
import {Web3Context} from "./contexts/Web3Context";
import {NetworkName, defaultNetworkUrls, getChainConfig, networkDefault} from "./utils/networks";
import {ProofProvider} from "./types";
import Web3 from "web3";
import {Api} from "@lodestar/api";
import {createChainForkConfig} from "@lodestar/config";
import {getApiClient} from "./utils/api";
import {createVerifiedExecutionProvider, LCTransport} from "@lodestar/prover";
import {NetworkName as ConfigNetworkName} from "@lodestar/config/networks";

export const AppContextWrapper = () => {
  const [network, setNetwork] = useState<NetworkName>(networkDefault);
  const [beaconUrl, setBeaconUrl] = useState(defaultNetworkUrls[networkDefault].beaconApiUrl);
  const [rpcUrl, setRpcUrl] = useState(defaultNetworkUrls[networkDefault].elRpcUrl);
  const [trustedCheckpoint, setTrustedCheckpoint] = useState("");
  const [isProofProviderReady, setIsProofProviderReady] = useState(false);
  const [error, setError] = useState<Error>();
  const [progress, setProgress] = useState<string | boolean>();

  const [proofProvider, setProofProvider] = useState<ProofProvider>();
  const [api, setApi] = useState<Api>();
  const web3 = useRef<Web3>();

  useEffect(() => {
    setBeaconUrl(defaultNetworkUrls[network].beaconApiUrl);
    setRpcUrl(defaultNetworkUrls[network].elRpcUrl);
  }, [network]);

  useEffect(() => {
    (async function initApiClient() {
      const config = createChainForkConfig(await getChainConfig(network, beaconUrl));
      const api = getApiClient(beaconUrl, config);
      setApi(api);
    })().catch(console.error);
  }, [beaconUrl]);

  async function initFromTrustedCheckpoint(localTrustedCheckpoint?: string) {
    if (!trustedCheckpoint && !localTrustedCheckpoint) return;

    const checkpoint = localTrustedCheckpoint ?? trustedCheckpoint;

    try {
      // Validate root
      if (!checkpoint.startsWith("0x")) {
        throw Error("Root must start with 0x");
      }
      if (checkpoint.length !== 64 + 2) {
        throw Error(`Root must be 32 bytes long: ${checkpoint.length}`);
      }

      setProgress(`Syncing from trusted checkpoint: ${checkpoint}`);

      const {provider, proofProvider} = createVerifiedExecutionProvider(new Web3.providers.HttpProvider(rpcUrl), {
        transport: LCTransport.Rest,
        urls: [beaconUrl],
        wsCheckpoint: checkpoint,
        network: network as ConfigNetworkName,
        logger: console as any,
      });
      setProofProvider(proofProvider);
      web3.current = new Web3(provider);
      await proofProvider.waitToBeReady();
      setIsProofProviderReady(true);
      setProgress(undefined);
    } catch (e) {
      (e as Error).message = `Error initializing from trusted checkpoint ${trustedCheckpoint}: ${(e as Error).message}`;
      setError(e as Error);
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }

  return (
    <UiContext.Provider
      value={{
        error,
        progress,
        setError,
        setProgress,
        unsetError: () => setError(undefined),
        unsetProgress: () => setProgress(undefined),
      }}
    >
      <ConfigurationContext.Provider
        value={{
          network,
          setNetwork,
          beaconUrl,
          setBeaconUrl,
          rpcUrl,
          setRpcUrl,
          trustedCheckpoint,
          setTrustedCheckpoint,
        }}
      >
        <ApiContext.Provider value={{api}}>
          <ProofProviderContext.Provider
            value={{
              isProofProviderReady,
              proofProvider,
              initFromTrustedCheckpoint,
            }}
          >
            <Web3Context.Provider value={{web3: web3.current}}>
              <App />
            </Web3Context.Provider>
          </ProofProviderContext.Provider>
        </ApiContext.Provider>
      </ConfigurationContext.Provider>
    </UiContext.Provider>
  );
};
