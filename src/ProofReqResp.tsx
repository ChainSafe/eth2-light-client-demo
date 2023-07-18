import React, {useEffect, useMemo, useState} from "react";
import throttle from "lodash/throttle";
import {Lightclient} from "@lodestar/light-client";
import {TreeOffsetProof, computeDescriptor} from "@chainsafe/persistent-merkle-tree";
import {ssz, allForks} from "@lodestar/types";
import {CompositeType, toHexString, CompositeView, JsonPath} from "@chainsafe/ssz";
import {ReqStatus} from "./types";
import {ErrorView} from "./components/ErrorView";
import {ApiError, Api} from "@lodestar/api";

const SLOT_DIFF_TO_FETCH = 96;

const initialPathStr = `[
  ["slot"],
  ["latestBlockHeader", "bodyRoot"]
]`;

type Path = (string | number)[];
type StateRender = {key: string; value: string}[];

async function getHeadStateProof(
  lightclient: Lightclient,
  api: Api,
  paths: JsonPath[]
): Promise<{proof: TreeOffsetProof; header: allForks.LightClientHeader}> {
  const header = lightclient.getHead();
  const stateId = toHexString(header.beacon.stateRoot);
  const gindices = paths.map((path) => ssz.bellatrix.BeaconState.getPathInfo(path).gindex);
  const descriptor = computeDescriptor(gindices);
  const res = await api.proof.getStateProof(stateId, descriptor);
  ApiError.assert(res);
  return {
    proof: res.response.data as TreeOffsetProof,
    header,
  };
}

export function ProofReqResp({client, head}: {client: Lightclient; head: allForks.LightClientHeader}): JSX.Element {
  const [showProof, setShowProof] = useState(false);
  const [reqStatusProof, setReqStatusProof] = useState<ReqStatus<{proof: TreeOffsetProof; stateStr: StateRender}>>({});
  const [pathsStr, setPaths] = useState(initialPathStr);

  const fetchProofThrottled = useMemo(
    () =>
      throttle(async function fetchProof(stateRoot: Uint8Array, pathsStr: string): Promise<void> {
        try {
          setReqStatusProof({loading: true});
          const pathsQueried = JSON.parse(pathsStr);
          const {proof, header} = await getHeadStateProof(client, client["transport"]["api"], pathsQueried);
          if (proof.leaves.length <= 0) {
            throw Error("Empty proof");
          }
          const state: TreeBackedState = client.config
            .getForkTypes(header.beacon.slot)
            .BeaconState.createFromProof(proof) as unknown as TreeBackedState;
          const stateStr = state ? renderState(pathsQueried, state) : [];
          setReqStatusProof({result: {proof, stateStr}});
        } catch (e) {
          setReqStatusProof({error: e as Error});
        }
      }, 1000),
    [client, setReqStatusProof]
  );

  useEffect(() => {
    if (client.currentSlot - head.beacon.slot < SLOT_DIFF_TO_FETCH) {
      fetchProofThrottled(head.beacon.stateRoot as Uint8Array, pathsStr);
    }
  }, [fetchProofThrottled, pathsStr, client, head.beacon.stateRoot, head.beacon.slot]);

  return (
    <section>
      <h2>Proof Req/Resp</h2>
      <div className="proof-container">
        <div className="paths">
          <h3>Paths</h3>
          <div className="field">
            <div className="control">
              <textarea className="textarea" rows={5} value={pathsStr} onChange={(evt) => setPaths(evt.target.value)} />
            </div>
          </div>
        </div>

        <div className="data">
          <h3>State</h3>

          {reqStatusProof.result ? (
            <div className="grid-2col-render">
              {reqStatusProof.result.stateStr.map((item, i) => (
                <React.Fragment key={i}>
                  <span>{item.key}</span>
                  <span>{item.value}</span>
                </React.Fragment>
              ))}
            </div>
          ) : (
            <p>no state</p>
          )}
        </div>

        <div className="show-proof-toggle" onClick={() => setShowProof((x) => !x)}>
          {showProof ? <span>Hide proof</span> : <span>Show proof</span>}
        </div>

        {showProof && (
          <div className="proof-witness" style={{whiteSpace: "pre"}}>
            <h3>Proof</h3>
            {reqStatusProof.result ? (
              <div className="proof-render">{renderProof(reqStatusProof.result.proof)}</div>
            ) : (
              <p>no proof</p>
            )}
            <br />
          </div>
        )}

        {reqStatusProof.result ? null : reqStatusProof.error ? (
          <ErrorView error={reqStatusProof.error} />
        ) : reqStatusProof.loading ? (
          <p>Fetching proof...</p>
        ) : null}

        {client.currentSlot - head.beacon.slot >= SLOT_DIFF_TO_FETCH && (
          <div className="alert-warning">
            Head is {client.currentSlot - head.beacon.slot} slots behind the clock. Head state may not be available
          </div>
        )}
      </div>
    </section>
  );
}

type TreeBackedState =
  | CompositeView<typeof ssz.phase0.BeaconState>
  | CompositeView<typeof ssz.altair.BeaconState>
  | CompositeView<typeof ssz.bellatrix.BeaconState>
  | CompositeView<typeof ssz.capella.BeaconState>;

function renderState(paths: Path[], state: TreeBackedState): StateRender {
  if (!state) return [];
  return paths.map((path) => ({
    key: path.join("."),
    value: getStateData(state, path),
  }));
}

function getStateData(state: TreeBackedState, path: Path): string {
  let value = state as Record<string, any>;
  let type = state.type as CompositeType<object, unknown, unknown>;
  for (const indexer of path) {
    type = type.getPropertyType(indexer) as CompositeType<object, unknown, unknown>;
    if (value["get"] !== undefined) {
      value = value.get(String(indexer)) as object;
    } else {
      value = value[String(indexer)] as object;
    }
  }
  try {
    return JSON.stringify(type.toJson(value.valueOf()), null, 2);
  } catch (e) {
    return "-";
  }
}

function renderProof(proof: TreeOffsetProof): string {
  const hexJson = {
    type: proof.type,
    leaves: proof.leaves.map(toHexString),
    offsets: proof.offsets,
  };
  return JSON.stringify(hexJson, null, 2);
}
