import React, {useState, useEffect} from "react";
import {EPOCHS_PER_SYNC_COMMITTEE_PERIOD, SLOTS_PER_EPOCH} from "@lodestar/params";
import {Lightclient} from "@lodestar/light-client";

export function TimeMonitor({client}: {client: Lightclient}): JSX.Element {
  const [, setCounter] = useState<number>();
  useEffect(() => {
    const interval = setInterval(() => {
      setCounter((x) => (x ?? 0) + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [setCounter]);

  const {SECONDS_PER_SLOT} = client.config;
  const secondsPerEpoch = SECONDS_PER_SLOT * SLOTS_PER_EPOCH;
  const secondsPerPeriod = secondsPerEpoch * EPOCHS_PER_SYNC_COMMITTEE_PERIOD;

  const diffInSeconds = Date.now() / 1000 - client.genesisTime;
  const slot = Math.floor(diffInSeconds / SECONDS_PER_SLOT);
  const slotInEpoch = slot % SLOTS_PER_EPOCH;
  const slotRatio = (diffInSeconds % secondsPerEpoch) / secondsPerEpoch;
  const epoch = Math.floor(slot / SLOTS_PER_EPOCH);
  const epochInPeriod = epoch % EPOCHS_PER_SYNC_COMMITTEE_PERIOD;
  const epochRatio = (diffInSeconds % secondsPerPeriod) / secondsPerPeriod;
  const period = Math.floor((epoch - client.config.ALTAIR_FORK_EPOCH) / EPOCHS_PER_SYNC_COMMITTEE_PERIOD);

  return (
    <section>
      <p>
        Slot: {slot}, Epoch: {epoch}, Period: {period}
      </p>

      <p>
        Slot {slotInEpoch} / {SLOTS_PER_EPOCH} in epoch
      </p>
      <div className="progressbar">
        <div style={{width: 100 * slotRatio + "%"}}></div>
      </div>

      <p>
        Epoch {epochInPeriod} / {EPOCHS_PER_SYNC_COMMITTEE_PERIOD} in period
      </p>
      <div className="progressbar">
        <div style={{width: 100 * epochRatio + "%"}}></div>
      </div>
    </section>
  );
}
