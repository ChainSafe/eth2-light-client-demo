import {LightclientEvent} from "@lodestar/light-client";
import {computeSyncPeriodAtSlot} from "@lodestar/light-client/utils";
import {allForks} from "@lodestar/types";
import {FunctionComponent, useContext, useEffect, useState} from "react";
import {ProofProviderContext} from "../contexts/ProofProviderContext";
import {SyncStatus} from "./SyncStatus";
import {TimeMonitor} from "./TimeMonitor";

export const ProofProviderView: FunctionComponent = () => {
  const {isProofProviderReady, proofProvider} = useContext(ProofProviderContext);
  const [head, setHead] = useState<allForks.LightClientHeader>();
  const [latestSyncedPeriod, setLatestSyncedPeriod] = useState<number>();

  useEffect(() => {
    function onNewHead(newHeader: allForks.LightClientHeader) {
      setHead(newHeader);
    }

    async function process() {
      if (!isProofProviderReady || !proofProvider || !proofProvider.lightClient) return;

      const head = proofProvider.lightClient.getHead();
      setHead(head);
      setLatestSyncedPeriod(computeSyncPeriodAtSlot(head?.beacon.slot));
      proofProvider.lightClient.emitter.on(LightclientEvent.lightClientFinalityHeader, onNewHead);
    }

    // eslint-disable-next-line no-console
    process().catch(console.error);

    return function () {
      proofProvider?.lightClient?.emitter.off(LightclientEvent.lightClientFinalityHeader, onNewHead);
    };
  }, [isProofProviderReady]);

  if (!proofProvider || !isProofProviderReady) return <></>;

  return (
    <>
      <TimeMonitor />
      <SyncStatus head={head} latestSyncedPeriod={latestSyncedPeriod} />
    </>
  );
};
