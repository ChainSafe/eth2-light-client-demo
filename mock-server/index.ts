import crypto from "crypto";
import {routes, Api} from "@chainsafe/lodestar-api";
import {createIBeaconConfig} from "@chainsafe/lodestar-config";
import {chainConfig as chainConfigDef} from "@chainsafe/lodestar-config/default";
import {toHexString} from "@chainsafe/ssz";
import {computeSyncPeriodAtSlot} from "@chainsafe/lodestar-light-client/utils";
import {allForks, phase0, ssz} from "@chainsafe/lodestar-types";
import {EventsServerApi, LightclientServerApi, ServerOpts, startServer} from "./server";
import {
  computeLightClientSnapshot,
  computeLightclientUpdate,
  getInteropSyncCommittee,
  SLOTS_PER_PERIOD,
  SOME_HASH,
} from "./utils";
import {ACTIVE_PRESET} from "@chainsafe/lodestar-params";

async function run(): Promise<void> {
  const ALTAIR_FORK_EPOCH = 0;
  const SECONDS_PER_SLOT = 2;

  const initialPeriod = 0;
  const targetPeriod = 5;
  const slotsIntoPeriod = 8;
  const firstHeadSlot = targetPeriod * SLOTS_PER_PERIOD;
  const clockSlotStart = firstHeadSlot + slotsIntoPeriod;

  // Genesis data such that targetSlot is at the current clock slot
  const chainConfig: typeof chainConfigDef = {...chainConfigDef, ALTAIR_FORK_EPOCH, SECONDS_PER_SLOT};
  // const genesisTime = Math.floor(Date.now() / 1000) - chainConfig.SECONDS_PER_SLOT * clockSlotStart;
  const genesisTime = 1638397478;
  const genesisValidatorsRoot = Buffer.alloc(32, 0xaa);
  const config = createIBeaconConfig({...chainConfig, ALTAIR_FORK_EPOCH}, genesisValidatorsRoot);

  // Create server impl mock backed
  const lightclientServerApi = new LightclientServerApi();
  const eventsServerApi = new EventsServerApi();

  // Start server
  const opts: ServerOpts = {host: "127.0.0.1", port: 15000};
  await startServer(opts, config, {
    lightclient: lightclientServerApi,
    events: eventsServerApi,
  } as Partial<Api> as Api);
  console.log(`Started server: http://${opts.host}:${opts.port}`);

  // Populate initial snapshot
  const {snapshot, checkpointRoot} = computeLightClientSnapshot(initialPeriod);
  lightclientServerApi.snapshots.set(toHexString(checkpointRoot), snapshot);

  // Log data for the UI to join
  console.log({
    preset: ACTIVE_PRESET,
    ALTAIR_FORK_EPOCH,
    SECONDS_PER_SLOT,
    genesisTime,
    genesisValidatorsRoot: toHexString(genesisValidatorsRoot),
    checkpointRoot: toHexString(checkpointRoot),
  });

  const state = ssz.altair.BeaconState.defaultView();

  for (let slot = 0; true; slot++) {
    const period = computeSyncPeriodAtSlot(slot);

    // Simulate crafting a new update once per period at the start
    if (slot % SLOTS_PER_PERIOD === 0) {
      lightclientServerApi.updates.set(period, computeLightclientUpdate(config, period));
      console.log(`Set SyncCommittee update period: ${period}`);
    }

    // If above clockSlotStart, simulate chain progressing
    if (slot < clockSlotStart) {
      continue;
    }

    const bodyRoot = crypto.randomBytes(32);
    state.slot = slot;
    state.latestBlockHeader.bodyRoot = bodyRoot;

    const stateRoot = state.hashTreeRoot();
    lightclientServerApi.states.set(toHexString(stateRoot), state as TreeBacked<allForks.BeaconState>);

    // Emit a new head update with the custom state root
    const header: phase0.BeaconBlockHeader = {
      slot,
      proposerIndex: 0,
      parentRoot: SOME_HASH,
      stateRoot: stateRoot,
      bodyRoot: SOME_HASH,
    };

    eventsServerApi.emit({
      type: routes.events.EventType.lightclientHeaderUpdate,
      message: {header, syncAggregate: getInteropSyncCommittee(period).signHeader(config, header)},
    });
    console.log(`Emitted header update, slot: ${slot} bodyRoot: ${toHexString(bodyRoot)}`);

    const nextSlotTimeMs = (genesisTime + (slot + 1) * chainConfig.SECONDS_PER_SLOT) * 1000;
    const msToNextSlot = nextSlotTimeMs - Date.now();
    await new Promise((r) => setTimeout(r, msToNextSlot));
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
