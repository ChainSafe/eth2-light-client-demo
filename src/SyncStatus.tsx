import React, {useEffect, useState, useCallback} from "react";
import {debounce} from "debounce";
import {Lightclient, LightclientEvent} from "@chainsafe/lodestar-light-client/lib/client";
import {computeSyncPeriodAtSlot} from "@chainsafe/lodestar-light-client/lib/utils/syncPeriod";
import {altair} from "@chainsafe/lodestar-types";
import {toHexString} from "@chainsafe/ssz";
import {ErrorView} from "./components/ErrorView";
import {ReqStatus} from "./types";
import {writeGenesisTime, writeSnapshot} from "./storage";

const NOT_SUFFICIENT_PARTICIPANTS = "Sync committee has not sufficient participants";
export function SyncStatus({client}: {client: Lightclient}): JSX.Element {
  const [header, setHeader] = useState<altair.BeaconBlockHeader>();
  const [reqStatusSync, setReqStatusSync] = useState<ReqStatus>({});

  const sync = useCallback(async () => {
    try {
      setReqStatusSync({loading: true});

      // Will only do sync of period updates if the clock shows that the period has advanced
      await client.sync();

      await client.syncToLatest();
      setReqStatusSync({result: true});
      // Persist after sync
      writeSnapshot(client.getSnapshot());
      writeGenesisTime(client.clock.genesisTime);
    } catch (e) {
      setReqStatusSync({error: e});
      console.error(e);
    }
  }, [client, setReqStatusSync]);

  // Sync once at start
  useEffect(() => {
    sync();
  }, [sync]);

  // Sync every slot
  useEffect(() => {
    const interval = setInterval(sync, client.config.SECONDS_PER_SLOT * 1000);
    return () => clearInterval(interval);
  });

  // Subscribe to update head events
  useEffect(() => {
    const onNewHeader = (newHeader: altair.BeaconBlockHeader): void => setHeader(newHeader);
    client.emitter.on(LightclientEvent.newHeader, onNewHeader);
    return () => client.emitter.off(LightclientEvent.newHeader, onNewHeader);
  }, [client, setHeader]);

  // Subscribe to update sync committee events
  useEffect(() => {
    // debounce storing the snapshot since it does some expensive serialization
    const onAdvancedCommittee = debounce((): void => writeSnapshot(client.getSnapshot()), 250);
    client.emitter.on(LightclientEvent.advancedCommittee, onAdvancedCommittee);
    return () => client.emitter.off(LightclientEvent.advancedCommittee, onAdvancedCommittee);
  }, [client]);

  return (
    <section>
      <h2>Sync Status</h2>
      <div className="grid-2col-render">
        <span>syncPeriod</span>
        <span>{header ? computeSyncPeriodAtSlot(header.slot) : "no header"}</span>
      </div>

      {reqStatusSync.result ? (
        <p>Successfully synced!</p>
      ) : reqStatusSync.error ? (
        reqStatusSync.error.message === NOT_SUFFICIENT_PARTICIPANTS ? (
          // If a single slot syncAggregate has not participants it will show as an error
          // This is not technically a big problem, just that the lightclient will lag one slot behind.
          // Show a non-red message, indicating that the severity is not as high as an actual error.
          <p className="yellow">Skipped empty sync aggregate</p>
        ) : (
          <ErrorView error={reqStatusSync.error} />
        )
      ) : reqStatusSync.loading ? (
        <p>Syncing Lightclient...</p>
      ) : null}

      <h3>Latest Synced Snapshot Header</h3>
      <div className="grid-2col-render">
        {header ? (
          <>
            <span>slot</span>
            <span>{header.slot}</span>
            <span>stateRoot</span>
            <span>{toHexString(header.stateRoot)}</span>
          </>
        ) : (
          <span>no header</span>
        )}
      </div>
    </section>
  );
}
