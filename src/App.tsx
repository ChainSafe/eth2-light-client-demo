import React, {useEffect, useState} from "react";
import {getClient} from "@chainsafe/lodestar-api";
import {Lightclient, LightclientEvent} from "@chainsafe/lodestar-light-client";
import {init} from "@chainsafe/bls";
import {fromHexString, toHexString} from "@chainsafe/ssz";
import {createIChainForkConfig} from "@chainsafe/lodestar-config";
import {config as configDefault} from "@chainsafe/lodestar-config/default";
import Footer from "./components/Footer";
import {ErrorView} from "./components/ErrorView";
import {Loader} from "./components/Loader";
import {SyncStatus} from "./SyncStatus";
import {TimeMonitor} from "./TimeMonitor";
import {ProofReqResp} from "./ProofReqResp";
import {ReqStatus} from "./types";
import {phase0, SyncPeriod, ssz, bellatrix} from "@chainsafe/lodestar-types";
import {networkGenesis} from "@chainsafe/lodestar-light-client/lib/networks";
import {networksChainConfig} from "@chainsafe/lodestar-config/networks";
import {computeSyncPeriodAtSlot} from "@chainsafe/lodestar-light-client/lib/utils/clock";
import {getLcLoggerConsole} from "@chainsafe/lodestar-light-client/lib/utils/logger";
import Web3 from "web3";
import {SecureTrie} from "merkle-patricia-tree";
import {Account, toBuffer, keccak256} from "ethereumjs-util";
import {DefaultStateManager} from "@ethereumjs/vm/dist/state";
import {numberToHex} from "web3-utils";

const networkDefault = "custom";
const stateManager = new DefaultStateManager();
type ParsedAccount = {balance: string; nonce: string; verified: boolean};

async function getNetworkData(network: string, beaconApiUrl?: string) {
  if (network === "mainnet") {
    return {
      genesisData: networkGenesis.mainnet,
      chainConfig: networksChainConfig.mainnet,
    };
  } else if (network === "prater") {
    return {
      genesisData: networkGenesis.prater,
      chainConfig: networksChainConfig.prater,
    };
  } else {
    if (!beaconApiUrl) {
      throw Error(`Unknown network: ${network}, requires beaconApiUrl to load config`);
    }
    const api = getClient(configDefault, {baseUrl: beaconApiUrl});
    const {data: genesisData} = await api.beacon.getGenesis();
    const {data: chainConfig} = await api.config.getSpec();
    const networkData = {
      genesisData: {
        genesisTime: Number(genesisData.genesisTime),
        genesisValidatorsRoot: toHexString(genesisData.genesisValidatorsRoot),
      },
      chainConfig,
    };
    return networkData;
  }
}

function getNetworkUrl(network: string) {
  if (network === "mainnet") {
    return {beaconApiUrl: "https://mainnet.lodestar.casa", elRpcUrl: "https://mainnet.lodestar.casa"};
  } else if (network === "prater") {
    return {beaconApiUrl: "https://prater.lodestar.casa", elRpcUrl: "https://praterrpc.lodestar.casa"};
  } else {
    return {beaconApiUrl: "http://kilnv1.lodestar.casa:32184", elRpcUrl: "http://kilnv1.lodestar.casa:31791"};
  }
}

export default function App(): JSX.Element {
  const [network, setNetwork] = useState(networkDefault);
  const [beaconApiUrl, setBeaconApiUrl] = useState(getNetworkUrl(networkDefault).beaconApiUrl);
  const [elRpcUrl, setElRpcUrl] = useState(getNetworkUrl(networkDefault).elRpcUrl);
  const [checkpointRootStr, setCheckpointRootStr] = useState("");
  const [reqStatusInit, setReqStatusInit] = useState<ReqStatus<Lightclient, string>>({});
  const [localAvailable] = useState(false);
  const [head, setHead] = useState<phase0.BeaconBlockHeader>();
  const [latestSyncedPeriod, setLatestSyncedPeriod] = useState<number>();
  const [executionPayload, setExecutionPayload] = useState<bellatrix.ExecutionPayload>();
  const [address, setAddress] = useState<string>("0xa94f5374fce5edbc8e2a8697c15331677e6ebf0b");
  const [account, setAccount] = useState<ParsedAccount>();
  const [web3, setWeb3] = useState<Web3>();

  useEffect(() => {
    init("herumi").catch((e) => {
      setReqStatusInit({error: e});
    });
  }, []);

  useEffect(() => {
    setBeaconApiUrl(getNetworkUrl(network).beaconApiUrl);
    setElRpcUrl(getNetworkUrl(network).elRpcUrl);
  }, [network]);

  useEffect(() => {
    if (executionPayload && address && web3) {
      fetchAndVerifyAddress({web3, executionPayload, address}).then((verifiedAccount) => {
        setAccount(verifiedAccount);
      });
    }
  }, [executionPayload, address, web3]);

  // Check if local snapshot is available
  // useEffect(() => {
  //   setLocalAvailable(hasSnapshot());
  // }, [reqStatusInit.result]);

  useEffect(() => {
    const client = reqStatusInit.result;
    if (!client) return;

    client.start();
    const head = client.getHead();
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

  async function initializeFromLocalSnapshot() {}

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

      const head = client.getHead();
      const blockHash = toHexString(ssz.phase0.BeaconBlockHeader.hashTreeRoot(head));
      const {data: block} = (await client.api.beacon.getBlockV2(blockHash)) as unknown as {
        data: bellatrix.SignedBeaconBlock;
      };
      const executionPayload = block.message.body.executionPayload;
      setExecutionPayload(executionPayload);
      setWeb3(new Web3(elRpcUrl));

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

      const client = getClient(configDefault, {baseUrl: beaconApiUrl});
      const res = await client.beacon.getStateFinalityCheckpoints("head");
      const finalizedCheckpoint = res.data.finalized;
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
              <select onChange={(e) => setNetwork(e.target.value)} value={network}>
                <option value="mainnet">mainnet</option>
                <option value="prater">prater</option>
                <option value="custom">custom</option>
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
              <input value={elRpcUrl} onChange={(e) => setElRpcUrl(e.target.value)} />
            </div>
          </div>

          <div className="field">
            <div className="control">
              <p>any ethereum address</p>
              <input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
          </div>
          {account && (
            <>
              <div className="account">
                <div className="balance">
                  <span>balance</span>
                  <input value={account.balance} disabled={true} />
                </div>
                <div className="nonce">
                  <span>nonce</span>
                  <input value={account.nonce} disabled={true} />
                </div>
                <div className="status">
                  <span>status</span>
                  <input value={account.verified ? "valid" : "invalid"} disabled={true} />
                </div>
                <div className="icon">
                  <div>
                    <p style={{fontSize: "3em"}}>{account.verified ? "✅" : "❌"}</p>
                  </div>
                </div>
              </div>
            </>
          )}

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

                {localAvailable && (
                  <div className="field">
                    <div className="control">
                      <button className="strong-gradient" onClick={initializeFromLocalSnapshot}>
                        Initialize from local snapshot
                      </button>
                    </div>
                  </div>
                )}
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

async function fetchAndVerifyAddress({
  web3,
  executionPayload,
  address,
}: {
  web3: Web3;
  executionPayload: bellatrix.ExecutionPayload;
  address: string;
}): Promise<ParsedAccount> {
  const params: [string, string[], number] = [address, [], executionPayload.blockNumber];
  const stateRoot = toHexString(executionPayload.stateRoot);
  const proof = await web3.eth.getProof(...params);
  const {balance, nonce} = proof;

  // Verify the proof, web3 converts nonce and balance into number strings, however
  // ethereumjs verify proof requires them in the original hex format
  proof.nonce = numberToHex(proof.nonce);
  proof.balance = numberToHex(proof.balance);

  const proofStateRoot = toHexString(keccak256(toBuffer(proof.accountProof[0])));
  const verified =
    stateRoot === proofStateRoot &&
    proof.storageHash === externalAddressStorageHash &&
    proof.codeHash === externalAddressCodeHash &&
    (await stateManager.verifyProof(proof));

  return {balance: web3.utils.fromWei(balance, "ether"), nonce, verified};

  // console.log("fetched proof",{verified})
  // const accountProof =proof.accountProof.map((rlpString) =>toBuffer(rlpString))
  // console.log("accountProof",{accountProof})
  // const value = await SecureTrie.verifyProof(toBuffer(toHexString(executionPayload.stateRoot)), toBuffer(address), accountProof)
  // if(value!=null){
  //   console.log("value ", {value})
  // const account = Account.fromRlpSerializedAccount(value)
  // console.log("account ",{account})
  // return account;
  // }
  // return null;
}
