import React, {useEffect, useState} from "react";
import {getClient} from "@chainsafe/lodestar-api";
import {Lightclient, LightclientEvent} from "@chainsafe/lodestar-light-client";
import {init} from "@chainsafe/bls";
import {fromHexString, toHexString} from "@chainsafe/ssz";
import {createIChainForkConfig} from "@chainsafe/lodestar-config";
import {config as configDefault} from "@chainsafe/lodestar-config/default";
import Footer from "./components/Footer";
import {ErrorView} from "./components/ErrorView";
import {Loader} from "./components/Loader";
import {SyncStatus} from "./SyncStatus";
import {TimeMonitor} from "./TimeMonitor";
import {ProofReqResp} from "./ProofReqResp";
import {ReqStatus} from "./types";
import {readSnapshot, hasSnapshot, deleteSnapshot} from "./storage";
import {phase0, SyncPeriod} from "@chainsafe/lodestar-types";
import {networkGenesis} from "@chainsafe/lodestar-light-client/lib/networks";
import {networksChainConfig} from "@chainsafe/lodestar-config/networks";
import {computeSyncPeriodAtSlot} from "@chainsafe/lodestar-light-client/lib/utils/clock";

const networkDefault = "mainnet";

function getNetworkData(network: string) {
  if (network === "mainnet") {
    return {
      genesisData: networkGenesis.mainnet,
      chainConfig: networksChainConfig.mainnet,
    };
  } else if (network === "prater") {
    return {
      genesisData: networkGenesis.prater,
      chainConfig: networksChainConfig.prater,
    };
  } else {
    throw Error(`Unknown network: ${network}`);
  }
}

function getNetworkUrl(network: string) {
  if (network === "mainnet") {
    return "https://mainnet.lodestar.casa";
  } else if (network === "prater") {
    return "https://prater.lodestar.casa";
  } else {
    throw Error(`Unknown network: ${network}`);
  }
}

export default function App(): JSX.Element {
  const [network, setNetwork] = useState(networkDefault);
  const [beaconApiUrl, setBeaconApiUrl] = useState(getNetworkUrl(networkDefault));
  const [checkpointRootStr, setCheckpointRootStr] = useState("");
  const [reqStatusInit, setReqStatusInit] = useState<ReqStatus<Lightclient, string>>({});
  const [localAvailable, setLocalAvailable] = useState(false);
  const [head, setHead] = useState<phase0.BeaconBlockHeader>();
  const [latestSyncedPeriod, setLatestSyncedPeriod] = useState<number>();

  useEffect(() => {
    init("herumi").catch((e) => {
      setReqStatusInit({error: e});
    });
  }, []);

  useEffect(() => {
    setBeaconApiUrl(getNetworkUrl(network));
  }, [network]);

  // Check if local snapshot is available
  useEffect(() => {
    setLocalAvailable(hasSnapshot());
  }, [reqStatusInit.result]);

  useEffect(() => {
    const client = reqStatusInit.result;
    if (!client) return;

    client.start();

    function onNewHead(newHeader: phase0.BeaconBlockHeader) {
      setHead(newHeader);
    }

    function onNewCommittee(period: SyncPeriod) {
      setLatestSyncedPeriod(period);
    }

    client.emitter.on(LightclientEvent.head, onNewHead);
    client.emitter.on(LightclientEvent.committee, onNewCommittee);

    return function () {
      client.emitter.off(LightclientEvent.head, onNewHead);
      client.emitter.off(LightclientEvent.committee, onNewCommittee);
    };
  }, [reqStatusInit.result]);

  async function initializeFromLocalSnapshot() {
    try {
      // Check if there is state persisted
      const prevSnapshot = readSnapshot();
      if (!prevSnapshot) {
        throw Error("No snapshot stored locally");
      }

      const {genesisData, chainConfig} = getNetworkData(network);
      const config = createIChainForkConfig(chainConfig);

      setReqStatusInit({
        loading: `Restoring prevSnapshot at slot ${prevSnapshot.header.slot}`,
      });

      const client = await Lightclient.initializeFromCheckpointRoot({
        config,
        beaconApiUrl,
        genesisData,
        checkpointRoot: fromHexString("0x9f810339d6c30bf360b531b1bfb7c9a80dbbd4caa54c7bb1b98e44752c07ea98"),
      });
      setReqStatusInit({result: client});

      const head = client.getHead();
      setHead(head);
      setLatestSyncedPeriod(computeSyncPeriodAtSlot(client.config, head.slot));
    } catch (e) {
      setReqStatusInit({error: e as Error});
      console.error(e);
    }
  }

  async function initializeFromCheckpointStr(checkpointRootHex: string) {
    try {
      // Validate root
      if (!checkpointRootHex.startsWith("0x")) {
        throw Error(`Root must start with 0x`);
      }
      const checkpointRoot = fromHexString(checkpointRootHex);
      if (checkpointRoot.length !== 32) {
        throw Error(`Root must be 32 bytes long: ${checkpointRoot.length}`);
      }

      setReqStatusInit({loading: `Syncing from trusted checkpoint: ${checkpointRootHex}`});

      const {genesisData, chainConfig} = getNetworkData(network);
      const config = createIChainForkConfig(chainConfig);

      const client = await Lightclient.initializeFromCheckpointRoot({
        config,
        beaconApiUrl,
        genesisData,
        checkpointRoot,
      });

      setReqStatusInit({result: client});
    } catch (e) {
      (e as Error).message = `Error initializing from trusted checkpoint ${checkpointRootHex}: ${(e as Error).message}`;
      setReqStatusInit({error: e as Error});
      console.error(e);
    }
  }

  async function fillCheckpointFromNode() {
    try {
      setReqStatusInit({loading: "Fetching checkpoint from trusted node"});

      const client = getClient(configDefault, {baseUrl: beaconApiUrl});
      const res = await client.beacon.getStateFinalityCheckpoints("head");
      const finalizedCheckpoint = res.data.finalized;
      setCheckpointRootStr(toHexString(finalizedCheckpoint.root));

      // Hasn't load clint, just disable loader
      setReqStatusInit({});
    } catch (e) {
      (e as Error).message = `Error initializing from trusted node: ${(e as Error).message}`;
      setReqStatusInit({error: e as Error});
      console.error(e);
    }
  }

  function deleteState() {
    deleteSnapshot();
    setReqStatusInit({});
  }

  return (
    <>
      <main>
        <section className="hero">
          <h1>
            Ethereum consensus <br></br> Lodestar light-client demo
          </h1>

          <p>
            Showcase of a REST-based Ethereum consensus light-client. Initialize from a trusted checkpoint or node, sync
            to lastest finalized state and request proofs
          </p>
        </section>

        <section>
          <div className="field">
            <div className="control">
              <p>Network</p>
              <select onChange={(e) => setNetwork(e.target.value)}>
                <option value="mainnet">mainnet</option>
                <option value="prater">prater</option>
              </select>
            </div>
          </div>

          <div className="field">
            <div className="control">
              <p>Beacon node API URL</p>
              <input value={beaconApiUrl} onChange={(e) => setBeaconApiUrl(e.target.value)} />
            </div>
          </div>

          <br></br>

          {!reqStatusInit.result ? (
            <>
              <div>
                <div className="field trusted-checkpoint">
                  <div className="control">
                    <p>
                      Trusted checkpoint{" "}
                      <span className="fill-latest-finalized" onClick={fillCheckpointFromNode}>
                        (Fill with latest finalized)
                      </span>
                    </p>
                    <input
                      value={checkpointRootStr}
                      onChange={(e) => setCheckpointRootStr(e.target.value)}
                      placeholder="0xaabb..."
                    />
                  </div>
                </div>

                <div className="field">
                  <div className="control">
                    <button className="strong-gradient" onClick={() => initializeFromCheckpointStr(checkpointRootStr)}>
                      Initialize from trusted checkpoint root
                    </button>
                  </div>
                </div>

                {localAvailable && (
                  <div className="field">
                    <div className="control">
                      <button className="strong-gradient" onClick={initializeFromLocalSnapshot}>
                        Initialize from local snapshot
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="field">
              <div className="control">
                <button className="strong-gradient" onClick={deleteState}>
                  Delete state
                </button>
              </div>
            </div>
          )}
        </section>

        {reqStatusInit.result ? (
          <>
            <TimeMonitor client={reqStatusInit.result} />

            <SyncStatus client={reqStatusInit.result} head={head} latestSyncedPeriod={latestSyncedPeriod} />

            {head !== undefined && <ProofReqResp client={reqStatusInit.result} head={head} />}
          </>
        ) : reqStatusInit.error ? (
          <ErrorView error={reqStatusInit.error} />
        ) : reqStatusInit.loading ? (
          <>
            <Loader></Loader>
            <p>Initializing light-client - {reqStatusInit.loading}</p>
          </>
        ) : null}
      </main>

      <Footer />
    </>
  );
}
