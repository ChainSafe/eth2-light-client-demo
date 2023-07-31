import {ERC20Contract, NetworkName, ParsedAccount} from "../../types";
import {AccountBalance} from "./AccountBalance";
import {NewContract} from "../Contract/NewContract";

export function DisplayAccount({
  account,
  erc20Contracts,
  setErc20Contracts,
  network,
}: {
  account: ParsedAccount;
  erc20Contracts: Record<string, ERC20Contract>;
  setErc20Contracts: (_records: Record<string, ERC20Contract>) => void;
  network: NetworkName;
}): JSX.Element {
  return (
    <>
      <AccountBalance name={"Ether"} contractAddress={""} balance={account.balance} verified={account.verified} />
      {account.tokens.map((token) => (
        <div>
          <AccountBalance
            key={token.name}
            {...token}
            removeToken={(tokenName) => {
              delete erc20Contracts[tokenName];
              setErc20Contracts({...erc20Contracts});
            }}
          />
        </div>
      ))}
      <NewContract erc20Contracts={erc20Contracts} setErc20Contracts={setErc20Contracts} network={network} />
    </>
  );
}
