import {FunctionComponent, useContext, useEffect, useState} from "react";
import Web3 from "web3";
import {ConfigurationContext} from "../contexts/ConfigurationContext";
import {ProofProviderContext} from "../contexts/ProofProviderContext";
import {ERC20Contract, ParsedAccount, ReqStatus} from "../types";
import {erc20Abi} from "../utils/abi";
import {ErrorView} from "./ErrorView/index";
import {Loader} from "./Loader";
import {Web3Context} from "../contexts/Web3Context";
import {DisplayAccount} from "./Account";

export const AccountVerification: FunctionComponent<{
  setErc20Contracts: (erc20Contracts: Record<string, ERC20Contract>) => void;
  erc20Contracts: Record<string, ERC20Contract>;
}> = ({erc20Contracts, setErc20Contracts}) => {
  const {network} = useContext(ConfigurationContext);
  const {web3} = useContext(Web3Context);
  const {isProofProviderReady} = useContext(ProofProviderContext);
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
  }, [isProofProviderReady]);

  if (!isProofProviderReady) return <></>;

  return (
    <div>
      <div className="address field">
        <span>any ethereum address</span>
        <div className="control">
          <input value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
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
  };
}
