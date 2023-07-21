import {createVerifiedExecutionProvider} from "@lodestar/prover";

export interface ReqStatus<T = true, P = boolean> {
  loading?: P;
  error?: Error;
  result?: T;
}

export type ReqHandler<T> = (res: ReqStatus<T>) => void;

export type ProofProvider = ReturnType<typeof createVerifiedExecutionProvider>["proofProvider"];
