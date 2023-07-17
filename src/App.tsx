import React, {useEffect, useState, useRef} from "react";
import {fromHexString, toHexString} from "@chainsafe/ssz";
import {getClient} from "@lodestar/api";
import {Lightclient, LightclientEvent} from "@lodestar/light-client";
import {createIChainForkConfig} from "@lodestar/config";
import {config as configDefault} from "@lodestar/config/default";

import {phase0, SyncPeriod, ssz, bellatrix} from "@lodestar/types";
import {computeSyncPeriodAtSlot} from "@lodestar/light-client/utils";

import Web3 from "web3";

import Footer from "./components/Footer";
import {ErrorView} from "./components/ErrorView";
import {Loader} from "./components/Loader";
import {SyncStatus} from "./SyncStatus";
import {TimeMonitor} from "./TimeMonitor";
import {ProofProvider, ReqStatus} from "./types";
import {NetworkName, networkDefault, defaultNetworkUrls, defaultNetworkTokens, ERC20Contract} from "./Networks";
import {ParsedAccount, DisplayAccount} from "./AccountHelper";
import {ProofReqResp} from "./ProofReqResp";

export default function App(): JSX.Element {
  const [network, setNetwork] = useState<NetworkName>(networkDefault);
  const [beaconApiUrl, setBeaconApiUrl] = useState(defaultNetworkUrls[networkDefault].beaconApiUrl);
  const [elRpcUrl, setElRpcUrl] = useState(defaultNetworkUrls[networkDefault].elRpcUrl);
  const [checkpointRootStr, setCheckpointRootStr] = useState("");
  const [reqStatusInit, setReqStatusInit] = useState<ReqStatus<Lightclient, string>>({});
  const [head, setHead] = useState<phase0.BeaconBlockHeader>();
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

      const blockHash = toHexString(ssz.phase0.BeaconBlockHeader.hashTreeRoot(head));
      const data = await client.api.beacon.getBlockV2(blockHash);

      const {data: block} = data as unknown as {data: bellatrix.SignedBeaconBlock};
      const executionPayload = block.message.body.executionPayload;

      // If the merge not complete, executionPayload would not exists
      if (!executionPayload) {
        setAccountReqStatus({result: accountReqStatus.result, loading: `Waiting for an execution payload`});
        return;
      }

      setAccountReqStatus({result: accountReqStatus.result, loading: `Fetching status from ${elRpcUrl}`});
      const verifiedAccount = await fetchAndVerifyAddressBalances({
        web3: web3.current,
        address,
        erc20Contracts,
      });
      setAccountReqStatus({result: verifiedAccount});
    }

    fetchAndVerifyAccount().catch((e) => {
      setAccountReqStatus({error: e, loading: undefined});
    });
  }, [head, address, elRpcUrl, erc20Contracts]);

  useEffect(() => {
    const proofProvider = reqStatusInit.result;
    if (!proofProvider) return;

    const head = proofProvider.getStatus().latest;
    setHead(head);
    setLatestSyncedPeriod(computeSyncPeriodAtSlot(head.slot));

    function onNewHead(newHeader: phase0.BeaconBlockHeader) {
      setHead(newHeader);
    }

    function onNewCommittee(period: SyncPeriod) {
      setLatestSyncedPeriod(period);
    }

    client.emitter.on(LightclientEvent.head, onNewHead);
    client.emitter.on(LightclientEvent.committee, onNewCommittee);

    return function () {
      client.emitter.off(LightclientEvent.head, onNewHead);
      client.emitter.off(LightclientEvent.committee, onNewCommittee);
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
      const config = createIChainForkConfig(chainConfig);

      const client = await Lightclient.initializeFromCheckpointRoot({
        config,
        logger: getLcLoggerConsole({logDebug: true}),
        beaconApiUrl,
        genesisData,
        checkpointRoot,
      });

      web3.current = new Web3(provider);

      setReqStatusInit({result: proofProvider});
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
                        <span>{accountReqStatus.error || !accountReqStatus.result ? "invalid" : "valid"}</span>
                        <p style={{fontSize: "2em"}}>
                          {accountReqStatus.error || !accountReqStatus.result ? "❌" : "✅"}
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
            <TimeMonitor proofProvider={reqStatusInit.result} />
            <SyncStatus proofProvider={reqStatusInit.result} head={head} latestSyncedPeriod={latestSyncedPeriod} />
            {head !== undefined && <ProofReqResp proofProvider={reqStatusInit.result} head={head} />}
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
      const contractBalance = await web3.eth.getBalance(contractAddress);
      tokens.push({
        name: contractName,
        balance: contractBalance,
        contractAddress,
      });
    } catch (err) {
      console.error(`Error fetching contract balance`, err);
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
