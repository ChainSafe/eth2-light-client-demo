import React, {FunctionComponent, useEffect, useState} from "react";
import {ProofProvider, ReqStatus} from "../types";
import {DisplayAccount, ParsedAccount} from "./AccountHelper";
import {ERC20Contract, NetworkName} from "../utils/networks";
import {Loader} from "./Loader";
import {ErrorView} from "./ErrorView";
import Web3 from "web3";
import {erc20Abi} from "../utils/abi";

export const AccountVerification: FunctionComponent<{
  network: NetworkName;
  proofProvider: ProofProvider;
  web3: Web3;
  setErc20Contracts: (erc20Contracts: Record<string, ERC20Contract>) => void;
  erc20Contracts: Record<string, ERC20Contract>;
}> = ({network, web3, erc20Contracts, setErc20Contracts}) => {
  // Setting Avalanche Bridge as the default token address to showcase changing balances
  const [address, setAddress] = useState<string>("0x8EB8a3b98659Cce290402893d0123abb75E3ab28");
  const [accountStatus, setAccountStatus] = useState<ReqStatus<ParsedAccount, string>>({});

  useEffect(() => {
    fetchAndVerifyAddressBalances({web3, address, erc20Contracts})
      .then((verifiedAccount) => {
        setAccountStatus({result: verifiedAccount});
      })
      .catch((e) => {
        setAccountStatus({error: e, loading: undefined});
      });
  }, []);

  return (
    <div>
      <div className="account">
        <div className="address field">
          <span>any ethereum address</span>
          <div className="control">
            <input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </div>
        {(accountStatus.result || accountStatus.error) && (
          <div className="result">
            <div className="nonce">
              <span>type</span>
              <input value={accountStatus?.result?.type ?? ""} disabled={true} />
            </div>

            <div className="result icon">
              {accountStatus.loading ? (
                <Loader />
              ) : (
                <div>
                  <span>{accountStatus.error || !accountStatus.result ? "invalid" : "valid"}</span>
                  <p style={{fontSize: "2em"}}>{accountStatus.error || !accountStatus.result ? "❌" : "✅"}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {accountStatus.result ? (
        <DisplayAccount
          account={accountStatus.result}
          erc20Contracts={erc20Contracts}
          setErc20Contracts={setErc20Contracts}
          network={network}
        />
      ) : accountStatus.loading ? (
        <>
          <Loader></Loader>
          <p>{accountStatus.loading}</p>
        </>
      ) : (
        <></>
      )}
      {accountStatus.error && <ErrorView error={accountStatus.error} />}
    </div>
  );
};

const externalAddressStorageHash = "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421";
const externalAddressCodeHash = "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470";

async function fetchAndVerifyAddressBalances({
  web3,
  address,
  erc20Contracts,
}: {
  web3: Web3 | undefined;
  address: string;
  erc20Contracts: Record<string, ERC20Contract>;
}): Promise<ParsedAccount> {
  if (!web3) throw Error(`No valid connection to EL`);
  let balance: string = "";
  let verified: boolean;

  try {
    balance = await web3.eth.getBalance(address);
    verified = true;
  } catch (err) {
    verified = false;
  }

  let tokens = [];

  for (const contractName of Object.keys(erc20Contracts)) {
    const {contractAddress, balanceMappingIndex} = erc20Contracts[contractName];
    try {
      const contract = new web3.eth.Contract(erc20Abi as any, contractAddress);
      const contractBalance = await contract.methods.balanceOf(address).call();
      tokens.push({
        name: contractName,
        balance: contractBalance,
        contractAddress,
        verified: true,
      });
    } catch (err) {
      tokens.push({
        name: contractName,
        balance: "0",
        contractAddress,
        verified: false,
      });
    }
  }

  return {
    balance: web3.utils.fromWei(balance, "ether"),
    verified,
    tokens,
    // TODO: Find a way to fix this
    // type: proof.codeHash === externalAddressCodeHash ? "external" : "contract",
    type: "external",
  };
}
