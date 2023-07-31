import {useState} from "react";
import {ERC20Contract, FormAction, NetworkName, NewContractForm} from "../../types";
import {defaultNetworkTokens} from "../../utils/networks";
import {ErrorView} from "../ErrorView/index";

function defaultNewContract(): NewContractForm {
  return {
    state: FormAction.Action,
    data: {name: "", contractAddress: "", balanceMappingIndex: 0},
  };
}

export function NewContract({
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
                const hexPattern = new RegExp(/^(0x|0X)?(?<tokenHex>[a-fA-F0-9]{40})$/);
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
