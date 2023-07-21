import {createVerifiedExecutionProvider} from "@lodestar/prover";
import Web3 from "web3";
import {Api} from "@lodestar/api";

export interface ReqStatus<T = true, P = boolean> {
  loading?: P;
  error?: Error;
  result?: T;
}

export type ReqHandler<T> = (res: ReqStatus<T>) => void;

export type ProofProvider = ReturnType<typeof createVerifiedExecutionProvider>["proofProvider"];
