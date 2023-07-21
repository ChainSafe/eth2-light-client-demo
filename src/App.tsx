import React, {useEffect, useState, useRef} from "react";
import {Api} from "@lodestar/api";
import {createVerifiedExecutionProvider, LCTransport} from "@lodestar/prover";
import {NetworkName as ConfigNetworkName} from "@lodestar/config/networks";

import Web3 from "web3";

import Footer from "./components/Footer";
import {ProofProvider, ReqStatus} from "./types";
import {TrustedCheckpoint} from "./components/TrustedCheckpoint";
import {createChainForkConfig} from "@lodestar/config";
import {getApiClient} from "./utils/api";
import {AccountVerification} from "./components/AccountVerification";
import {ProofProviderView} from "./components/ProofProviderView";
import {
  ERC20Contract,
  NetworkName,
  defaultNetworkTokens,
  defaultNetworkUrls,
  getChainConfig,
  networkDefault,
} from "./utils/networks";

export default function App(): JSX.Element {
  const [network, setNetwork] = useState<NetworkName>(networkDefault);
  const [beaconApiUrl, setBeaconApiUrl] = useState(defaultNetworkUrls[networkDefault].beaconApiUrl);
  const [elRpcUrl, setElRpcUrl] = useState(defaultNetworkUrls[networkDefault].elRpcUrl);
  const [erc20Contracts, setErc20Contracts] = useState<Record<string, ERC20Contract>>(
    defaultNetworkTokens[networkDefault].full
  );

  const [api, setApi] = useState<Api>();
  const [isProofProviderReady, setIsProofProviderReady] = useState(false);

  const [proofProviderReq, setProofProviderReq] = useState<ReqStatus<ProofProvider, string>>({});
  const [trustedCheckpointReq, setTrustedCheckpointReq] = useState<ReqStatus<string>>({});

  const web3 = useRef<Web3>();

  useEffect(() => {
    setBeaconApiUrl(defaultNetworkUrls[network].beaconApiUrl);
    setElRpcUrl(defaultNetworkUrls[network].elRpcUrl);
    setErc20Contracts(defaultNetworkTokens[network].full);
  }, [network]);

  useEffect(() => {
    async function process() {
      const config = createChainForkConfig(await getChainConfig(network, beaconApiUrl));
      const api = getApiClient(beaconApiUrl, config);
      setApi(api);
    }

    process().catch(console.error);
  }, [beaconApiUrl]);

  useEffect(() => {
    if (!proofProviderReq.result) return;

    async function process() {
      await proofProviderReq.result?.waitToBeReady();
      setIsProofProviderReady(true);
    }

    process().catch(console.error);
  }, [proofProviderReq.result]);

  async function initializeFromCheckpointStr(checkpointRootHex?: string) {
    if (!checkpointRootHex) return;

    try {
      // Validate root
      if (!checkpointRootHex.startsWith("0x")) {
        throw Error("Root must start with 0x");
      }
      if (checkpointRootHex.length !== 64 + 2) {
        throw Error(`Root must be 32 bytes long: ${checkpointRootHex.length}`);
      }

      setProofProviderReq({loading: `Syncing from trusted checkpoint: ${checkpointRootHex}`});

      const {provider, proofProvider} = createVerifiedExecutionProvider(new Web3.providers.HttpProvider(elRpcUrl), {
        transport: LCTransport.Rest,
        urls: [beaconApiUrl],
        wsCheckpoint: checkpointRootHex,
        network: network as ConfigNetworkName,
        logger: console as any,
      });
      web3.current = new Web3(provider);
      setProofProviderReq({result: proofProvider});
    } catch (e) {
      (e as Error).message = `Error initializing from trusted checkpoint ${checkpointRootHex}: ${(e as Error).message}`;
      setProofProviderReq({error: e as Error});
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }

  return (
    <>
      <main>
        <section className="hero">
          <h1>
            Ethereum consensus <br></br> Lodestar light-client demo
          </h1>

          <p>
            Showcase of a REST-based Ethereum consensus light-client. Initialize from a trusted checkpoint, sync to the
            head and request proofs
          </p>
        </section>

        <section>
          <div className="field">
            <div className="control">
              <p>Network</p>
              <select onChange={(e) => setNetwork(e.target.value as NetworkName)} value={network}>
                {Object.entries(NetworkName).map(([_networkKey, networkValue]) => (
                  <option key={networkValue} value={networkValue}>
                    {networkValue}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <div className="control">
              <p>Beacon node API URL</p>
              <input value={beaconApiUrl} onChange={(e) => setBeaconApiUrl(e.target.value)} />
            </div>
          </div>

          <div className="field">
            <div className="control">
              <p>Execution Rpc URL</p>
              <input
                value={elRpcUrl}
                onChange={(e) => {
                  web3.current = undefined;
                  setElRpcUrl(e.target.value);
                }}
              />
            </div>
          </div>

          {proofProviderReq.result && isProofProviderReady && web3.current ? (
            <AccountVerification
              proofProvider={proofProviderReq.result}
              erc20Contracts={erc20Contracts}
              setErc20Contracts={setErc20Contracts}
              network={network}
              web3={web3.current}
            />
          ) : (
            <></>
          )}

          <br></br>
          {!isProofProviderReady && api && (
            <div>
              <TrustedCheckpoint api={api} reqHandler={setTrustedCheckpointReq} />

              <div className="field">
                <div className="control">
                  <button
                    className="strong-gradient"
                    onClick={() => initializeFromCheckpointStr(trustedCheckpointReq.result)}
                  >
                    Initialize from trusted checkpoint root
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        <ProofProviderView proofProviderReq={proofProviderReq} />
      </main>

      <Footer />
    </>
  );
}
