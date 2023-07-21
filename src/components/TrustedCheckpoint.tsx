import React, {FunctionComponent, useState} from "react";
import {toHexString} from "@lodestar/utils";
import {Api, ApiError} from "@lodestar/api";
import {ReqHandler} from "../types";

export const TrustedCheckpoint: FunctionComponent<{api: Api; reqHandler: ReqHandler<string>}> = ({api, reqHandler}) => {
  const [checkpointRootStr, setCheckpointRootStr] = useState("");

  async function fillCheckpointFromNode() {
    try {
      reqHandler({loading: true, result: "Fetching checkpoint from trusted node"});
      const res = await api.beacon.getStateFinalityCheckpoints("head");
      ApiError.assert(res);

      const finalizedCheckpoint = toHexString(res.response.data.finalized.root);
      setCheckpointRootStr(finalizedCheckpoint);
      reqHandler({result: finalizedCheckpoint});
    } catch (e) {
      (e as Error).message = `Error initializing from trusted node: ${(e as Error).message}`;
      reqHandler({error: e as Error});
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }

  function onChangeCheckpointRoot(val: string) {
    setCheckpointRootStr(val);
    reqHandler({result: val});
  }

  return (
    <div className="field trusted-checkpoint">
      <div className="control">
        <p>
          Trusted checkpoint{" "}
          <span className="fill-latest-finalized" onClick={fillCheckpointFromNode}>
            (Fill with latest finalized)
          </span>
        </p>
        <input
          value={checkpointRootStr}
          onChange={(e) => onChangeCheckpointRoot(e.target.value)}
          placeholder="0xaabb..."
        />
      </div>
    </div>
  );
};
