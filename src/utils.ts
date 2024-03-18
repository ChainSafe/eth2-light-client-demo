import {DefaultStateManager, Proof} from "@ethereumjs/statemanager";

import {KECCAK256_NULL_S, KECCAK256_RLP_S} from "ethereumjs-util";
import Web3 from "web3";

const stateManager = new DefaultStateManager();
const NULL_HASH = `0x${KECCAK256_NULL_S}`;
const NULL_RLP_HASH = `0x${KECCAK256_RLP_S}`;

/**
 * If `codeHash` is `null`, then the address is an external address.
 */
export function isExternalAddress(proof: Proof): boolean {
  return isNullCodeHash(proof);
}

export function isNullCodeHash({codeHash}: Proof): boolean {
  return codeHash === NULL_HASH;
}

export function isNullStorage({storageHash}: Proof): boolean {
  return storageHash === NULL_RLP_HASH;
}

/**
 * @param hash a 32bits hash
 * @returns true is provided `hash` is the default hash
 */
function isDefaultHash(hash: string): boolean {
  return hash === "0x0000000000000000000000000000000000000000000000000000000000000000";
}

/**
 * Verify a `Proof` using a `DefaultStateManager`
 */
export async function verifyProof(web3: Web3, proof: Proof): Promise<boolean> {
  // Verify the proof, web3 converts nonce and balance into number strings, however
  // ethereumjs verify proof requires them in the original hex format
  proof.nonce = Web3.utils.numberToHex(proof.nonce);
  proof.balance = web3.utils.numberToHex(proof.balance);
  // Handle null hashes, as returned by Web3.
  // ethereumjs/statemanager expects hashes of proper  default value
  if (isDefaultHash(proof.storageHash)) {
    proof.storageHash = NULL_RLP_HASH;
  }
  if (isDefaultHash(proof.codeHash)) {
    proof.codeHash = NULL_HASH;
  }
  try {
    return await stateManager.verifyProof(proof);
  } catch (e) {
    return false;
  }
}
