import React, {FunctionComponent, useEffect, useState} from "react";
import {TimeMonitor} from "./TimeMonitor";
import {SyncStatus} from "./SyncStatus";
import {ProofProvider, ReqStatus} from "../types";
import {ErrorView} from "./ErrorView";
import {Loader} from "./Loader";
import {allForks} from "@lodestar/types";
import {LightclientEvent} from "@lodestar/light-client";
import {computeSyncPeriodAtSlot} from "@lodestar/light-client/utils";

export const ProofProviderView: FunctionComponent<{proofProviderReq: ReqStatus<ProofProvider, string>}> = ({
  proofProviderReq,
}) => {
  const [head, setHead] = useState<allForks.LightClientHeader>();
  const [latestSyncedPeriod, setLatestSyncedPeriod] = useState<number>();

  useEffect(() => {
    function onNewHead(newHeader: allForks.LightClientHeader) {
      setHead(newHeader);
    }

    async function process() {
      if (!proofProviderReq.result) return;
      if (!proofProviderReq.result.lightClient) return;

      await proofProviderReq.result.waitToBeReady();

      const head = proofProviderReq.result.lightClient.getHead();
      setHead(head);
      setLatestSyncedPeriod(computeSyncPeriodAtSlot(head?.beacon.slot));
      proofProviderReq.result.lightClient.emitter.on(LightclientEvent.lightClientFinalityHeader, onNewHead);
    }

    process().catch(console.error);

    return function () {
      proofProviderReq.result?.lightClient?.emitter.off(LightclientEvent.lightClientFinalityHeader, onNewHead);
    };
  }, [proofProviderReq.result]);

  return (
    <>
      {proofProviderReq.result ? (
        <>
          <TimeMonitor proofProvider={proofProviderReq.result} />
          <SyncStatus proofProvider={proofProviderReq.result} head={head} latestSyncedPeriod={latestSyncedPeriod} />
        </>
      ) : proofProviderReq.error ? (
        <ErrorView error={proofProviderReq.error} />
      ) : proofProviderReq.loading ? (
        <>
          <Loader></Loader>
          <p>Initializing proof provider - {proofProviderReq.loading}</p>
        </>
      ) : null}
    </>
  );
};
