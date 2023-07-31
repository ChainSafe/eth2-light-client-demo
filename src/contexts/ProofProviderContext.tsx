import {createContext} from "react";
import {ProofProvider} from "../types";

export const ProofProviderContext = createContext<{
  proofProvider?: ProofProvider;
  isProofProviderReady: boolean;
  initFromTrustedCheckpoint: (trustedCheckpoint?: string) => Promise<void>;
}>({
  isProofProviderReady: false,
  initFromTrustedCheckpoint: async () => {},
});
