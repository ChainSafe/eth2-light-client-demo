import {createVerifiedExecutionProvider} from "@lodestar/prover/browser";

export enum NetworkName {
  mainnet = "mainnet",
  goerli = "goerli",
  sepolia = "sepolia",
  custom = "custom",
}

export type ERC20Contract = {
  contractAddress: string;
  balanceMappingIndex: number;
};

export interface ReqStatus<T = true, P = boolean> {
  loading?: P;
  error?: Error;
  result?: T;
}

export type ReqHandler<T> = (res: ReqStatus<T>) => void;

export type ProofProvider = ReturnType<typeof createVerifiedExecutionProvider>["proofProvider"];

export enum FormAction {
  Form = "form",
  Action = "action",
}

export type NewContractForm = {
  state: FormAction;
  data: {name: string} & ERC20Contract;
  error?: Error;
};

export type ParsedAccount = {
  balance: string;
  verified: boolean;
  tokens: {name: string; balance: string; contractAddress: string; verified: boolean}[];
};
