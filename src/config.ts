import {createIChainForkConfig} from "@chainsafe/lodestar-config";
import {leveParams} from "@chainsafe/lodestar-light-client/lib/leve";
import {fromHexString} from "@chainsafe/ssz";

export const configLeve = createIChainForkConfig(leveParams);

export const genesisValidatorsRoot = fromHexString(
  "0xe0316c386ad87391354adbc2bcfa5d4f219d05fed4dddc7171579032055991d7"
);

// Temp PROD: http://161.97.179.211:31000
