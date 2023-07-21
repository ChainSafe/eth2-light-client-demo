import {Api, getClient} from "@lodestar/api";
import {ChainForkConfig} from "@lodestar/config";
import {config as configDefault} from "@lodestar/config/default";

export function getApiClient(url: string, config?: ChainForkConfig): Api {
  return getClient({baseUrl: url}, {config: config ?? configDefault});
}
