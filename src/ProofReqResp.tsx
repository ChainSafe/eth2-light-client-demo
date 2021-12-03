import React, {useEffect, useMemo, useState} from "react";
import throttle from "lodash/throttle";
import {Lightclient} from "@chainsafe/lodestar-light-client";
import {TreeOffsetProof} from "@chainsafe/persistent-merkle-tree";
import {allForks, phase0} from "@chainsafe/lodestar-types";
import {CompositeType, toHexString, TreeBacked} from "@chainsafe/ssz";
import {ReqStatus} from "./types";
import {ErrorView} from "./components/ErrorView";

const SLOT_DIFF_TO_FETCH = 96;

const initialPathStr = `[
  ["slot"],
  ["latestBlockHeader", "bodyRoot"]
]`;

type Path = (string | number)[];
type StateRender = {key: string; value: string}[];

export function ProofReqResp({client, head}: {client: Lightclient; head: phase0.BeaconBlockHeader}): JSX.Element {
  const [showProof, setShowProof] = useState(false);
  const [reqStatusProof, setReqStatusProof] = useState<ReqStatus<{proof: TreeOffsetProof; stateStr: StateRender}>>({});
  const [pathsStr, setPaths] = useState(initialPathStr);

  const fetchProofThrottled = useMemo(
    () =>
      throttle(async function fetchProof(stateRoot: Uint8Array, pathsStr: string): Promise<void> {
        try {
          setReqStatusProof({loading: true});
          const pathsQueried = JSON.parse(pathsStr);
          const {proof, header} = await client.getHeadStateProof(pathsQueried);
          if (proof.leaves.length <= 0) {
            throw Error("Empty proof");
          }
          const state = client.config.getForkTypes(header.slot).BeaconState.createTreeBackedFromProofUnsafe(proof);
          const stateStr = renderState(pathsQueried, state ?? null);
          setReqStatusProof({result: {proof, stateStr}});
        } catch (e) {
          setReqStatusProof({error: e as Error});
        }
      }, 1000),
    [client, setReqStatusProof]
  );

  useEffect(() => {
    if (client.currentSlot - head.slot < SLOT_DIFF_TO_FETCH) {
      fetchProofThrottled(head.stateRoot as Uint8Array, pathsStr);
    }
  }, [fetchProofThrottled, pathsStr, client, head.stateRoot, head.slot]);

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

        {client.currentSlot - head.slot >= SLOT_DIFF_TO_FETCH && (
          <div className="alert-warning">
            Head is {client.currentSlot - head.slot} slots behind the clock. Head state may not be available
          </div>
        )}
      </div>
    </section>
  );
}

function renderState(paths: Path[], state: TreeBacked<allForks.BeaconState> | null): StateRender {
  if (!state) return [];
  return paths.map((path) => ({
    key: path.join("."),
    value: getStateData(state, path),
  }));
}

function getStateData(state: TreeBacked<allForks.BeaconState>, path: Path): string {
  let value = state as object;
  let type = state.type as CompositeType<object>;
  for (const indexer of path) {
    type = type.getPropertyType(indexer) as CompositeType<object>;
    value = (value as Record<string, unknown>)[String(indexer)] as object;
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
