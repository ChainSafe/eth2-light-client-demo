import {createContext} from "react";
import Web3 from "web3";

export const Web3Context = createContext<{
  web3?: Web3;
}>({});
