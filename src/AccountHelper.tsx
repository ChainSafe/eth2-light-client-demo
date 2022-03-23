import React, {useEffect, useMemo, useState} from "react";
import {ErrorView} from "./components/ErrorView";
import {ERC20Contract, NetworkName, defaultNetworkTokens} from "./Networks";

enum FormAction {
  Form = "form",
  Action = "action",
}

export type NewContractForm = {
  state: FormAction;
  data: {name: string} & ERC20Contract;
  error?: Error;
};

export type ParsedAccount = {
  type: string;
  balance: string;
  nonce: string;
  verified: boolean;
  tokens: {name: string; balance: string; contractAddress: string}[];
};

function defaultNewContract(): NewContractForm {
  return {
    state: FormAction.Action,
    data: {name: "", contractAddress: "", balanceMappingIndex: 0},
  };
}

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
      <DisplayBalance name={"Ether"} contractAddress={""} balance={account.balance} />
      {account.tokens.map((token) => (
        <DisplayBalance
          {...token}
          removeToken={(tokenName) => {
            delete erc20Contracts[tokenName];
            setErc20Contracts({...erc20Contracts});
          }}
        />
      ))}
      <NewContract erc20Contracts={erc20Contracts} setErc20Contracts={setErc20Contracts} network={network} />
    </>
  );
}

export function DisplayBalance({
  name,
  balance,
  contractAddress,
  removeToken,
}: {
  name: string;
  balance: string;
  contractAddress?: string;
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
        <div className="balance">
          <input value={balance} disabled={true} />
        </div>
        <div className="name">
          <div>{name}</div>
        </div>
      </div>
      <div className="displaycontract">{contractAddress && ` (${contractAddress})`}</div>
    </>
  );
}

function NewContract({
  erc20Contracts,
  setErc20Contracts,
  network,
}: {
  erc20Contracts: Record<string, ERC20Contract>;
  setErc20Contracts: (_records: Record<string, ERC20Contract>) => void;
  network: NetworkName;
}): JSX.Element {
  const [newContract, setNewContract] = useState<NewContractForm>(defaultNewContract());
  const [selectedToken, setSelectedToken] = useState<string>("custom");

  return (
    <>
      {newContract.state === FormAction.Action ? (
        <span
          className="addcontractaction"
          onClick={() => {
            setNewContract({...newContract, state: FormAction.Form});
          }}
        >
          {"➕"}
        </span>
      ) : (
        <div>
          <select
            onChange={(e) => {
              if (e.target.value !== "custom") {
                setNewContract({
                  state: FormAction.Form,
                  data: {...defaultNetworkTokens[network].partial[e.target.value], name: e.target.value},
                });
              } else {
                setNewContract({...defaultNewContract(), state: FormAction.Form});
              }
              setSelectedToken(e.target.value);
            }}
            value={selectedToken}
          >
            {Object.keys(defaultNetworkTokens[network].partial)
              .filter((defaultToken) => !erc20Contracts[defaultToken])
              .map((defaultToken) => (
                <option key={defaultToken} value={defaultToken}>
                  {defaultToken}
                </option>
              ))}
            <option key="custom" value="custom">
              custom
            </option>
          </select>
          <p>Token Name</p>
          <input
            value={newContract.data.name}
            onChange={(e) => {
              newContract.data.name = e.target.value;
              setNewContract({...newContract});
            }}
          />
          <p>Contract Address</p>
          <input
            value={newContract.data.contractAddress}
            onChange={(e) => {
              newContract.data.contractAddress = e.target.value;
              setNewContract({...newContract});
            }}
          />
          <p>Balance Mapping Index</p>
          <input
            value={newContract.data.balanceMappingIndex}
            onChange={(e) => {
              newContract.data.balanceMappingIndex = parseInt(`0${e.target.value}`);
              setNewContract({...newContract});
            }}
          />
          <div>
            <span
              className="addcontractaction"
              onClick={() => {
                if (newContract.data.name === "") {
                  setNewContract({
                    ...newContract,
                    error: Error("Invalid name, please provide a valid token name"),
                  });
                  return;
                }
                const hexPattern = new RegExp(/^(0x|0X)?(?<tokenHex>[a-fA-F0-9]{40})$/, "g");
                if (!hexPattern.exec(newContract.data.contractAddress)?.groups?.tokenHex) {
                  setNewContract({...newContract, error: Error("Invalid contract address")});
                  return;
                }

                if (newContract.data.name != "" && newContract.data.contractAddress != "") {
                  setErc20Contracts({...erc20Contracts, [newContract.data.name]: newContract.data as ERC20Contract});
                }
                setNewContract(defaultNewContract());
              }}
            >
              {"✔️"}
            </span>
            <span
              className="addcontractaction"
              onClick={() => {
                setNewContract(defaultNewContract());
              }}
            >
              {"✖️"}
            </span>
            {newContract.error && <ErrorView error={newContract.error} />}
          </div>
        </div>
      )}
    </>
  );
}
