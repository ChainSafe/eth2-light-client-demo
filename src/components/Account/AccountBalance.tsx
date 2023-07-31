import {truncateAmountWithCommas} from "../../utils/ui";
import "./AccountBalance.scss";

export function AccountBalance({
  name,
  balance,
  contractAddress,
  verified,
  removeToken,
}: {
  name: string;
  balance: string;
  contractAddress?: string;
  verified: boolean;
  removeToken?: (_name: string) => void;
}): JSX.Element {
  return (
    <>
      <div className="displaybalance">
        <div
          className="remove"
          onClick={() => {
            if (removeToken) removeToken(name);
          }}
        >
          {removeToken && "✖️"}
        </div>

        <span className="verified" style={{fontSize: "1em"}}>
          {verified ? "✅" : "❌"}
        </span>

        <div className="balance">
          <input value={truncateAmountWithCommas(balance)} disabled={true} />
        </div>
        <div className="name">
          <div>{name}</div>
        </div>
      </div>
      <div className="displaycontract">{contractAddress && ` (${contractAddress})`}</div>
    </>
  );
}
