import React from "react";
import {Lightclient} from "@lodestar/light-client";
import {computeSyncPeriodAtSlot} from "@lodestar/light-client/utils";
import {phase0, SyncPeriod} from "@lodestar/types";
import {toHexString} from "@chainsafe/ssz";

export function SyncStatus({
  client,
  latestSyncedPeriod,
  head,
}: {
  client: Lightclient;
  latestSyncedPeriod: SyncPeriod | undefined;
  head: phase0.BeaconBlockHeader | undefined;
}): JSX.Element {
  return (
    <section>
      <h2>Sync Status</h2>
      <div className="grid-2col-render">
        <div>Latest sync period: {latestSyncedPeriod ?? "-"}</div>
        <div>Clock sync period: {computeSyncPeriodAtSlot(client.currentSlot)}</div>
      </div>

      <h3>Latest Synced Snapshot Header</h3>
      <div className="grid-2col-render">
        {head ? (
          <>
            <span>slot</span>
            <span>{head.slot}</span>
            <span>stateRoot</span>
            <span>{toHexString(head.stateRoot)}</span>
          </>
        ) : (
          <span>no header</span>
        )}
      </div>
    </section>
  );
}
