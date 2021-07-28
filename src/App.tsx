import React, {useEffect, useState} from "react";
import {getClient} from "@chainsafe/lodestar-api";
import {Lightclient} from "@chainsafe/lodestar-light-client/lib/client";
import {Clock} from "@chainsafe/lodestar-light-client/lib/utils/clock";
import {init} from "@chainsafe/bls";
import {fromHexString} from "@chainsafe/ssz";
import {createIChainForkConfig, IChainForkConfig} from "@chainsafe/lodestar-config";
import Header from "./components/Header";
import Footer from "./components/Footer";
import {ErrorView} from "./components/ErrorView";
import {SyncStatus} from "./SyncStatus";
import {TimeMonitor} from "./TimeMonitor";
import {ProofReqResp} from "./ProofReqResp";
import {ReqStatus} from "./types";
import {readSnapshot} from "./storage";
import {configLeve, genesisValidatorsRoot} from "./config";
import {Checkpoint} from "@chainsafe/lodestar-types/phase0";
import {toHexString} from "@chainsafe/ssz";

export default function App(): JSX.Element {
  const [beaconApiUrl, setBeaconApiUrl] = useState("http://161.97.179.211:9596");
  const [checkpointStr, setCheckpointStr] = useState("<root>:<epoch>");
  const [reqStatusInit, setReqStatusInit] = useState<ReqStatus<Lightclient, string>>({});

  useEffect(() => {
    init("herumi").catch((e) => {
      setReqStatusInit({error: e});
    });
  }, []);

  async function fetchConfig(): Promise<IChainForkConfig> {
    const client = getClient(configLeve, {baseUrl: beaconApiUrl});
    const {data} = await client.config.getSpec();
    return createIChainForkConfig(data);
  }

  async function initializeFromLocalSnapshot() {
    try {
      // TODO: Fetch from snapshot
      const genesisTime = 1620648600;

      const config = await fetchConfig();
      const clock = new Clock(config, genesisTime);
      // Check if there is state persisted
      const prevSnapshot = readSnapshot();
      if (!prevSnapshot) {
        throw Error("No snapshot stored locally");
      }

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

  async function initializeFromTrustedNode() {
    try {
      setReqStatusInit({loading: "Initializing from trusted node"});

      const client = getClient(configLeve, {baseUrl: beaconApiUrl});
      const res = await client.beacon.getStateFinalityCheckpoints("head");
      const finalizedCheckpoint = res.data.finalized;
      await initializeFromCheckpoint(finalizedCheckpoint);
    } catch (e) {
      e.message = `Error initializing from trusted node: ${e.message}`;
      setReqStatusInit({error: e});
      console.error(e);
    }
  }

  return (
    <>
      <Header />

      <main>
        <section>
          <div className="field">
            <div className="control">
              <p>Beacon node API URL</p>
              <input value={beaconApiUrl} onChange={(e) => setBeaconApiUrl(e.target.value)} />
            </div>
          </div>

          <div className="field">
            <div className="control">
              <p>Trusted checkpoint</p>
              <input value={checkpointStr} onChange={(e) => setCheckpointStr(e.target.value)} />
            </div>
          </div>

          <div className="field">
            <div className="control">
              <button className="strong-gradient" onClick={() => initializeFromCheckpointStr(checkpointStr)}>
                Initialize from trusted checkpoint
              </button>
            </div>
          </div>

          <div className="field">
            <div className="control">
              <button className="strong-gradient" onClick={initializeFromTrustedNode}>
                Initialize from trusted node
              </button>
            </div>
          </div>

          <div className="field">
            <div className="control">
              <button className="strong-gradient" onClick={initializeFromLocalSnapshot}>
                Initialize from local snaphost
              </button>
            </div>
          </div>
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
          <p>Initializing Lightclient - {reqStatusInit.loading}</p>
        ) : null}
      </main>

      <Footer />
    </>
  );
}
