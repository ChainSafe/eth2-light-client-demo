import {ApiError} from "@lodestar/api";
import {FunctionComponent, useContext, useState} from "react";
import {ApiContext} from "../contexts/ApiContext";
import {ConfigurationContext} from "../contexts/ConfigurationContext";
import {UiContext} from "../contexts/UiContext";
import {toHexString} from "@lodestar/utils";

export const TrustedCheckpoint: FunctionComponent = () => {
  const {setProgress, unsetProgress, setError} = useContext(UiContext);
  const {setTrustedCheckpoint, trustedCheckpoint} = useContext(ConfigurationContext);
  const {api} = useContext(ApiContext);

  const [checkpointRootStr, setCheckpointRootStr] = useState("");

  async function fillCheckpointFromNode() {
    try {
      if (!api) return;

      setProgress("Fetching checkpoint from trusted node");
      const res = await api.beacon.getStateFinalityCheckpoints("head");
      ApiError.assert(res);

      const finalizedCheckpoint = toHexString(res.response.data.finalized.root);
      setTrustedCheckpoint(finalizedCheckpoint);
      unsetProgress();
    } catch (e) {
      (e as Error).message = `Error initializing from trusted node: ${(e as Error).message}`;
      setError(e as Error);
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }

  function onChangeCheckpointRoot(val: string) {
    setCheckpointRootStr(val);
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
          value={trustedCheckpoint}
          onChange={(e) => onChangeCheckpointRoot(e.target.value)}
          placeholder="0xaabb..."
        />
      </div>
    </div>
  );
};
