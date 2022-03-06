// import {altair, Root, ssz} from "@chainsafe/lodestar-types";
// import {fromHexString, toHexString} from "@chainsafe/ssz";

// /* eslint-disable no-console */

// const snapshotKey = "snapshot-json";
// const genesisTimeKey = "genesis-time";
// const genesisValidatorsRootKey = "genesis-validators-root";

// export function hasSnapshot(): boolean {
//   return snapshotKey in localStorage;
// }

// export function deleteSnapshot(): void {
//   localStorage.removeItem(snapshotKey);
//   localStorage.removeItem(genesisTimeKey);
//   localStorage.removeItem(genesisValidatorsRootKey);
// }

// export function readSnapshot(): altair.LightClientSnapshot | null {
//   try {
//     const str = localStorage.getItem(snapshotKey);
//     if (!str) return null;
//     const json = JSON.parse(str);
//     return ssz.altair.LightClientSnapshot.fromJson(json);
//   } catch (e) {
//     console.error("Error deserializing snapshot", e);
//     return null;
//   }
// }

// export function writeSnapshot(snapshot: altair.LightClientSnapshot): void {
//   const json = ssz.altair.LightClientSnapshot.toJson(snapshot);
//   localStorage.setItem(snapshotKey, JSON.stringify(json, null, 2));
// }

// export function readGenesisTime(): number | null {
//   const str = localStorage.getItem(genesisTimeKey);
//   if (!str) return null;
//   return parseInt(str, 10);
// }

// export function writeGenesisTime(genesisTime: number): void {
//   localStorage.setItem(genesisTimeKey, String(genesisTime));
// }

// export function readGenesisValidatorsRoot(): Root | null {
//   const str = localStorage.getItem(genesisValidatorsRootKey);
//   if (!str) return null;
//   return fromHexString(str);
// }

// export function writeGenesisValidatorsRoot(root: Root): void {
//   localStorage.setItem(genesisValidatorsRootKey, toHexString(root));
// }

export {};
