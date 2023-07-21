import React, {useEffect, useState} from "react";
import {computeSyncPeriodAtSlot} from "@lodestar/light-client/utils";
import {SyncPeriod, allForks} from "@lodestar/types";
import {toHexString} from "@chainsafe/ssz";
import {ProofProvider} from "../types";

export function SyncStatus({
  proofProvider,
  latestSyncedPeriod,
  head,
}: {
  proofProvider: ProofProvider;
  latestSyncedPeriod: SyncPeriod | undefined;
  head: allForks.LightClientHeader | undefined;
}): JSX.Element {
  const [stateRoot, setStateRoot] = useState<string>("");

  useEffect(() => {
    proofProvider
      .waitToBeReady()
      .then(() => proofProvider.getExecutionPayload(head?.beacon.slot ?? "latest"))
      .then((header) => {
        setStateRoot(toHexString(header.stateRoot));
      });
  });

  return (
    <section>
      <h2>Sync Status</h2>
      <div className="grid-2col-render">
        <div>Latest sync period: {latestSyncedPeriod ?? "-"}</div>
        <div>Clock sync period: {computeSyncPeriodAtSlot(proofProvider.getStatus().latest)}</div>
      </div>

      <h3>Latest Synced Snapshot Header</h3>
      <div className="grid-2col-render">
        {head ? (
          <>
            <span>slot</span>
            <span>{head.beacon.slot}</span>
            <span>stateRoot</span>
            <span>{stateRoot}</span>
          </>
        ) : (
          <span>no header</span>
        )}
      </div>
    </section>
  );
}
