import React, {useEffect, useState} from "react";
import {getClient} from "@chainsafe/lodestar-api";
import {Lightclient} from "@chainsafe/lodestar-light-client/lib/client";
import {Clock} from "@chainsafe/lodestar-light-client/lib/utils/clock";
import {init} from "@chainsafe/bls";
import {fromHexString, toHexString} from "@chainsafe/ssz";
import {Checkpoint} from "@chainsafe/lodestar-types/phase0";
import {createIChainForkConfig, IChainForkConfig} from "@chainsafe/lodestar-config";
import Footer from "./components/Footer";
import {ErrorView} from "./components/ErrorView";
import {Loader} from "./components/Loader";
import {SyncStatus} from "./SyncStatus";
import {TimeMonitor} from "./TimeMonitor";
import {ProofReqResp} from "./ProofReqResp";
import {ReqStatus} from "./types";
import {readGenesisTime, readSnapshot, hasSnapshot, deleteSnapshot} from "./storage";
import {configLeve, genesisValidatorsRoot} from "./config";

export default function App(): JSX.Element {
  const [beaconApiUrl, setBeaconApiUrl] = useState("https://altair-devnet-3.lodestar.casa");
  const [checkpointStr, setCheckpointStr] = useState("<root>:<epoch>");
  const [reqStatusInit, setReqStatusInit] = useState<ReqStatus<Lightclient, string>>({});
  const [localAvailable, setLocalAvailable] = useState(false);

  useEffect(() => {
    init("herumi").catch((e) => {
      setReqStatusInit({error: e});
    });
  }, []);

  // Check if local snapshot is available
  useEffect(() => {
    setLocalAvailable(hasSnapshot());
  }, [reqStatusInit.result]);

  async function fetchConfig(): Promise<IChainForkConfig> {
    const client = getClient(configLeve, {baseUrl: beaconApiUrl});
    const {data} = await client.config.getSpec();
    return createIChainForkConfig(data);
  }

  async function fetchGenesisTime(): Promise<number> {
    const client = getClient(configLeve, {baseUrl: beaconApiUrl});
    const {data: genesis} = await client.beacon.getGenesis();
    return Number(genesis.genesisTime);
  }

  async function initializeFromLocalSnapshot() {
    try {
      // Check if there is state persisted
      const prevSnapshot = readSnapshot();
      if (!prevSnapshot) {
        throw Error("No snapshot stored locally");
      }

      const genesisTime = readGenesisTime() ?? (await fetchGenesisTime());

      const config = await fetchConfig();
      const clock = new Clock(config, genesisTime);

      setReqStatusInit({
        loading: `Restoring prevSnapshot at slot ${prevSnapshot.header.slot}`,
      });

      const client = Lightclient.initializeFromTrustedSnapshot(
        {config, clock, genesisValidatorsRoot, beaconApiUrl},
        prevSnapshot
      );
      setReqStatusInit({result: client});
    } catch (e) {
      setReqStatusInit({error: e});
      console.error(e);
    }
  }

  async function initializeFromCheckpointStr(checkpointStr: string) {
    try {
      const [rootStr, epochStr] = checkpointStr.split(":");

      // Validate root
      if (!rootStr.startsWith("0x")) throw Error(`Root must start with 0x`);
      const root = fromHexString(rootStr);
      if (root.length !== 32) throw Error(`Root must be 32 bytes long: ${root.length}`);

      // Validate epoch
      const epoch = parseInt(epochStr, 10);
      if (isNaN(epoch)) throw Error(`Epoch is not a number: ${epoch}`);

      await initializeFromCheckpoint({root, epoch});
    } catch (e) {
      e.message = `Error initializing from trusted checkpoint ${checkpointStr}: ${e.message}`;
      setReqStatusInit({error: e});
      console.error(e);
    }
  }

  async function initializeFromCheckpoint(checkpoint: Checkpoint) {
    const checkpointId = `${toHexString(checkpoint.root)}:${checkpoint.epoch}`;
    try {
      setReqStatusInit({loading: `Syncing from trusted checkpoint: ${checkpointId}`});

      const config = await fetchConfig();
      const client = await Lightclient.initializeFromCheckpoint(config, beaconApiUrl, checkpoint);
      setReqStatusInit({result: client});
    } catch (e) {
      e.message = `Error initializing from trusted checkpoint ${checkpointId}: ${e.message}`;
      setReqStatusInit({error: e});
      console.error(e);
    }
  }

  async function fillCheckpointFromNode() {
    try {
      setReqStatusInit({loading: "Fetching checkpoint from trusted node"});

      const client = getClient(configLeve, {baseUrl: beaconApiUrl});
      const res = await client.beacon.getStateFinalityCheckpoints("head");
      const finalizedCheckpoint = res.data.finalized;
      setCheckpointStr(toCheckpointStr(finalizedCheckpoint));

      // Hasn't load clint, just disable loader
      setReqStatusInit({});
    } catch (e) {
      e.message = `Error initializing from trusted node: ${e.message}`;
      setReqStatusInit({error: e});
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
                    <p>Trusted checkpoint</p>
                    <input value={checkpointStr} onChange={(e) => setCheckpointStr(e.target.value)} />
                    <button className="strong-gradient" onClick={fillCheckpointFromNode}>
                      Trust node
                    </button>
                  </div>
                </div>

                <div className="field">
                  <div className="control">
                    <button className="strong-gradient" onClick={() => initializeFromCheckpointStr(checkpointStr)}>
                      Initialize from trusted checkpoint
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
            <SyncStatus client={reqStatusInit.result} />
            <ProofReqResp client={reqStatusInit.result} />
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

function toCheckpointStr(checkpoint: Checkpoint): string {
  return `${toHexString(checkpoint.root)}:${checkpoint.epoch}`;
}
