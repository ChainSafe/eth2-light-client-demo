import {createContext} from "react";
import {Api} from "@lodestar/api";

export const ApiContext = createContext<{
  api?: Api;
}>({});
