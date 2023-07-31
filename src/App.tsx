import {useContext, useState} from "react";
import {AccountVerification} from "./components/AccountVerification";
import Footer from "./components/Footer";
import {ProofProviderView} from "./components/ProofProviderView";
import {TrustedCheckpoint} from "./components/TrustedCheckpoint";
import {ConfigurationContext} from "./contexts/ConfigurationContext";
import {defaultNetworkTokens, networkDefault} from "./utils/networks";
import {UiContext} from "./contexts/UiContext";
import {Loader} from "./components/Loader/index";
import {ErrorView} from "./components/ErrorView/index";
import {ProofProviderContext} from "./contexts/ProofProviderContext";
import {ERC20Contract, NetworkName} from "./types";

export default function App(): JSX.Element {
  const {network, setNetwork, beaconUrl, setBeaconUrl, rpcUrl, setRpcUrl, trustedCheckpoint, setTrustedCheckpoint} =
    useContext(ConfigurationContext);
  const {error, progress, setError} = useContext(UiContext);
  const {initFromTrustedCheckpoint} = useContext(ProofProviderContext);

  const [erc20Contracts, setErc20Contracts] = useState<Record<string, ERC20Contract>>(
    defaultNetworkTokens[networkDefault].full
  );

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
              <input value={beaconUrl} onChange={(e) => setBeaconUrl(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <div className="control">
              <p>Execution Rpc URL</p>
              <input
                value={rpcUrl}
                onChange={(e) => {
                  setRpcUrl(e.target.value);
                }}
              />
            </div>
          </div>

          <AccountVerification erc20Contracts={erc20Contracts} setErc20Contracts={setErc20Contracts} />

          <br></br>
          {error ? <ErrorView error={error} /> : <></>}

          {progress && progress.toString().trim().length > 0 ? (
            <>
              <Loader></Loader>
              <p>{progress}</p>
            </>
          ) : (
            <></>
          )}

          <div>
            <TrustedCheckpoint />

            <div className="field">
              <div className="control">
                <button
                  className="strong-gradient"
                  onClick={() =>
                    initFromTrustedCheckpoint().catch((e) => {
                      setError(e as Error);
                    })
                  }
                >
                  Initialize from trusted checkpoint root
                </button>
              </div>
            </div>
          </div>
        </section>

        <ProofProviderView />
      </main>

      <Footer />
    </>
  );
}
