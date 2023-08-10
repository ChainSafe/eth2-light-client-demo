import React, {useEffect, useState, useRef} from "react";
import {fromHexString, toHexString} from "@chainsafe/ssz";
import {Api, ApiError, getClient} from "@lodestar/api";
import {Lightclient, LightclientEvent} from "@lodestar/light-client";
import {LightClientRestTransport} from "@lodestar/light-client/transport";
import {createChainForkConfig} from "@lodestar/config";
import {config as configDefault} from "@lodestar/config/default";

import {SyncPeriod, bellatrix, allForks} from "@lodestar/types";
import {computeSyncPeriodAtSlot} from "@lodestar/light-client/utils";
import {getLcLoggerConsole} from "@lodestar/light-client/utils";

import Web3 from "web3";
import {toBuffer, keccak256} from "ethereumjs-util";
import {DefaultStateManager} from "@ethereumjs/statemanager";
import {numberToHex} from "web3-utils";
import {defaultAbiCoder} from "@ethersproject/abi";

import Footer from "./components/Footer";
import {ErrorView} from "./components/ErrorView";
import {Loader} from "./components/Loader";
import {SyncStatus} from "./SyncStatus";
import {TimeMonitor} from "./TimeMonitor";
import {ProofReqResp} from "./ProofReqResp";
import {ReqStatus} from "./types";
import {
  NetworkName,
  networkDefault,
  getNetworkData,
  defaultNetworkUrls,
  defaultNetworkTokens,
  ERC20Contract,
} from "./Networks";
import {ParsedAccount, DisplayAccount} from "./AccountHelper";

const stateManager = new DefaultStateManager();

export default function App(): JSX.Element {
  const [network, setNetwork] = useState<NetworkName>(networkDefault);
  const [beaconApiUrl, setBeaconApiUrl] = useState(defaultNetworkUrls[networkDefault].beaconApiUrl);
  const [elRpcUrl, setElRpcUrl] = useState(defaultNetworkUrls[networkDefault].elRpcUrl);
  const [checkpointRootStr, setCheckpointRootStr] = useState("");
  const [reqStatusInit, setReqStatusInit] = useState<ReqStatus<Lightclient, string>>({});
  const [head, setHead] = useState<allForks.LightClientHeader>();
  const [latestSyncedPeriod, setLatestSyncedPeriod] = useState<number>();
  // Setting Avalanche Bridge as the default token address to showcase changing balances
  const [address, setAddress] = useState<string>("0x8EB8a3b98659Cce290402893d0123abb75E3ab28");
  const [accountReqStatus, setAccountReqStatus] = useState<ReqStatus<ParsedAccount, string>>({});
  const [erc20Contracts, setErc20Contracts] = useState<Record<string, ERC20Contract>>(
    defaultNetworkTokens[networkDefault].full
  );
  const web3 = useRef<Web3>();

  useEffect(() => {
    setBeaconApiUrl(defaultNetworkUrls[network].beaconApiUrl);
    setElRpcUrl(defaultNetworkUrls[network].elRpcUrl);
    setErc20Contracts(defaultNetworkTokens[network].full);
  }, [network]);

  useEffect(() => {
    async function fetchAndVerifyAccount() {
      const client = reqStatusInit.result;
      if (!client || !head || !address || !elRpcUrl) {
        return;
      }

      try {
        if (!web3.current) web3.current = new Web3(elRpcUrl);
      } catch (e) {
        setAccountReqStatus({result: accountReqStatus.result, error: e as Error});
        return;
      }

      const blockRes = await (client["transport"]["api"] as Api).beacon.getBlockV2(head.beacon.slot);
      ApiError.assert(blockRes);

      const block = blockRes.response.data as bellatrix.SignedBeaconBlock;
      const executionPayload = block.message.body.executionPayload;

      // If the merge not complete, executionPayload would not exists
      if (!executionPayload) {
        setAccountReqStatus({result: accountReqStatus.result, loading: `Waiting for an execution payload`});
        return;
      }

      setAccountReqStatus({result: accountReqStatus.result, loading: `Fetching status from ${elRpcUrl}`});
      const verifiedAccount = await fetchAndVerifyAddressBalances({
        web3: web3.current,
        executionPayload,
        address,
        erc20Contracts,
      });
      setAccountReqStatus({result: verifiedAccount});
    }

    fetchAndVerifyAccount().catch((e) => {
      setAccountReqStatus({result: accountReqStatus.result, error: e});
    });
  }, [head, address, elRpcUrl, erc20Contracts]);

  useEffect(() => {
    const client = reqStatusInit.result;
    if (!client) return;

    client.start();
    const head = client.getHead();
    setHead(head);
    setLatestSyncedPeriod(computeSyncPeriodAtSlot(head.beacon.slot));

    function onNewHead(newHeader: allForks.LightClientHeader) {
      setHead(newHeader);
    }

    function onNewCommittee(period: SyncPeriod) {
      setLatestSyncedPeriod(period);
    }

    client.emitter.on(LightclientEvent.lightClientFinalityHeader, onNewHead);
    // client.emitter.on(LightclientEvent.committee, onNewCommittee);

    return function () {
      client.emitter.off(LightclientEvent.lightClientFinalityHeader, onNewHead);
      // client.emitter.off(LightclientEvent.committee, onNewCommittee);
    };
  }, [reqStatusInit.result]);

  async function initializeFromCheckpointStr(checkpointRootHex: string) {
    try {
      // Validate root
      if (!checkpointRootHex.startsWith("0x")) {
        throw Error("Root must start with 0x");
      }
      const checkpointRoot = fromHexString(checkpointRootHex);
      if (checkpointRoot.length !== 32) {
        throw Error(`Root must be 32 bytes long: ${checkpointRoot.length}`);
      }

      setReqStatusInit({loading: `Syncing from trusted checkpoint: ${checkpointRootHex}`});

      const {genesisData, chainConfig} = await getNetworkData(network, beaconApiUrl);
      const config = createChainForkConfig(chainConfig);

      const client = await Lightclient.initializeFromCheckpointRoot({
        config,
        logger: getLcLoggerConsole({logDebug: true}),
        transport: new LightClientRestTransport(getClient({urls: [beaconApiUrl]}, {config})),
        genesisData,
        checkpointRoot,
      });

      setReqStatusInit({result: client});
    } catch (e) {
      (e as Error).message = `Error initializing from trusted checkpoint ${checkpointRootHex}: ${(e as Error).message}`;
      setReqStatusInit({error: e as Error});
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }

  async function fillCheckpointFromNode() {
    try {
      setReqStatusInit({loading: "Fetching checkpoint from trusted node"});

      const client = getClient({baseUrl: beaconApiUrl}, {config: configDefault});
      const res = await client.beacon.getStateFinalityCheckpoints("head");
      ApiError.assert(res);
      const finalizedCheckpoint = res.response.data.finalized;
      setCheckpointRootStr(toHexString(finalizedCheckpoint.root));

      // Hasn't load clint, just disable loader
      setReqStatusInit({});
    } catch (e) {
      (e as Error).message = `Error initializing from trusted node: ${(e as Error).message}`;
      setReqStatusInit({error: e as Error});
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }

  function deleteState() {
    // deleteSnapshot();
    setReqStatusInit({});
  }

  return (
    <>
      <main>
        <section className="hero">
          <h1>
            Ethereum consensus <br></br> Lodestar light-client demo
          </h1>

          <p>
            Showcase of a REST-based Ethereum consensus light-client. Initialize from a trusted checkpoint, sync to the
            head and request proofs
          </p>
        </section>

        <section>
          <div className="field">
            <div className="control">
              <p>Network</p>
              <select onChange={(e) => setNetwork(e.target.value as NetworkName)} value={network}>
                {Object.entries(NetworkName).map(([_networkKey, networkValue]) => (
                  <option key={networkValue} value={networkValue}>
                    {networkValue}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <div className="control">
              <p>Beacon node API URL</p>
              <input value={beaconApiUrl} onChange={(e) => setBeaconApiUrl(e.target.value)} />
            </div>
          </div>

          <div className="field">
            <div className="control">
              <p>Execution Rpc URL</p>
              <input
                value={elRpcUrl}
                onChange={(e) => {
                  web3.current = undefined;
                  setElRpcUrl(e.target.value);
                }}
              />
            </div>
          </div>

          <div>
            <div className="account">
              <div className="address field">
                <span>any ethereum address</span>
                <div className="control">
                  <input value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
              </div>
              {(accountReqStatus.result || accountReqStatus.error) && (
                <div className="result">
                  <div className="nonce">
                    <span>type</span>
                    <input value={accountReqStatus?.result?.type ?? ""} disabled={true} />
                  </div>

                  <div className="result icon">
                    {accountReqStatus.loading ? (
                      <Loader />
                    ) : (
                      <div>
                        <span>
                          {accountReqStatus.error || !accountReqStatus.result
                            ? "error"
                            : accountReqStatus.result.verified
                            ? "valid"
                            : "invalid"}
                        </span>
                        <p style={{fontSize: "2em"}}>
                          {accountReqStatus.error || !accountReqStatus.result
                            ? "🛑"
                            : accountReqStatus.result.verified
                            ? "✅"
                            : "❌"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          {accountReqStatus.result ? (
            <DisplayAccount
              account={accountReqStatus.result}
              erc20Contracts={erc20Contracts}
              setErc20Contracts={setErc20Contracts}
              network={network}
            />
          ) : accountReqStatus.loading ? (
            <>
              <Loader></Loader>
              <p>{accountReqStatus.loading}</p>
            </>
          ) : (
            <></>
          )}
          {accountReqStatus.error && <ErrorView error={accountReqStatus.error} />}
          <br></br>
          {!reqStatusInit.result ? (
            <>
              <div>
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
                      onChange={(e) => setCheckpointRootStr(e.target.value)}
                      placeholder="0xaabb..."
                    />
                  </div>
                </div>

                <div className="field">
                  <div className="control">
                    <button className="strong-gradient" onClick={() => initializeFromCheckpointStr(checkpointRootStr)}>
                      Initialize from trusted checkpoint root
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="field">
              <div className="control">
                <button className="strong-gradient" onClick={deleteState}>
                  Delete state
                </button>
              </div>
            </div>
          )}
        </section>
        {reqStatusInit.result ? (
          <>
            <TimeMonitor client={reqStatusInit.result} />
            <SyncStatus client={reqStatusInit.result} head={head} latestSyncedPeriod={latestSyncedPeriod} />
            {head !== undefined && <ProofReqResp client={reqStatusInit.result} head={head} />}
          </>
        ) : reqStatusInit.error ? (
          <ErrorView error={reqStatusInit.error} />
        ) : reqStatusInit.loading ? (
          <>
            <Loader></Loader>
            <p>Initializing light-client - {reqStatusInit.loading}</p>
          </>
        ) : null}
      </main>

      <Footer />
    </>
  );
}

const externalAddressStorageHash = "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421";
const externalAddressCodeHash = "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470";

async function fetchAndVerifyAddressBalances({
  web3,
  executionPayload,
  address,
  erc20Contracts,
}: {
  web3: Web3 | undefined;
  executionPayload: bellatrix.ExecutionPayload;
  address: string;
  erc20Contracts: Record<string, ERC20Contract>;
}): Promise<ParsedAccount> {
  if (!web3) throw Error(`No valid connection to EL`);
  const params: [string, string[], number] = [address, [], executionPayload.blockNumber];
  const stateRoot = toHexString(executionPayload.stateRoot);
  const proof = await web3.eth.getProof(...params);

  const {balance, nonce} = proof;

  // Verify the proof, web3 converts nonce and balance into number strings, however
  // ethereumjs verify proof requires them in the original hex format
  proof.nonce = numberToHex(proof.nonce);
  proof.balance = numberToHex(proof.balance);

  const proofStateRoot = toHexString(keccak256(toBuffer(proof.accountProof[0])));
  let verified =
    stateRoot === proofStateRoot &&
    (proof.codeHash !== externalAddressCodeHash || proof.storageHash === externalAddressStorageHash) &&
    (await stateManager.verifyProof(proof));
  let tokens = [];

  for (const contractName of Object.keys(erc20Contracts)) {
    const {contractAddress, balanceMappingIndex} = erc20Contracts[contractName];
    const balanceSlot = web3.utils.keccak256(
      defaultAbiCoder.encode(["address", "uint"], [address, balanceMappingIndex])
    );
    const contractProof = await web3.eth.getProof(contractAddress, [balanceSlot], executionPayload.blockNumber);
    if (contractProof.codeHash === externalAddressCodeHash) {
      throw Error(`No contract deployed at ${contractAddress} for ${contractName}`);
    }
    const contractProofStateRoot = toHexString(keccak256(toBuffer(contractProof.accountProof[0])));
    // Verify the proof, web3 converts nonce and balance into number strings, however
    // ethereumjs verify proof requires them in the original hex format
    contractProof.nonce = numberToHex(contractProof.nonce);
    contractProof.balance = numberToHex(contractProof.balance);

    verified =
      verified &&
      stateRoot === contractProofStateRoot &&
      BigInt(contractProof.storageProof[0]?.key) === BigInt(balanceSlot) &&
      (await stateManager.verifyProof(contractProof));
    tokens.push({
      name: contractName,
      contractAddress,
      balance: web3.utils.fromWei(web3.utils.hexToNumberString(contractProof.storageProof[0]?.value ?? "0x0")),
    });
  }

  return {
    balance: web3.utils.fromWei(balance, "ether"),
    nonce,
    verified,
    tokens,
    type: proof.codeHash === externalAddressCodeHash ? "external" : "contract",
  };
}
