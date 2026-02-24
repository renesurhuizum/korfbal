/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as debug from "../debug.js";
import type * as importData from "../importData.js";
import type * as importMatchesDirect from "../importMatchesDirect.js";
import type * as matches from "../matches.js";
import type * as stats from "../stats.js";
import type * as teams from "../teams.js";
import type * as testInsert from "../testInsert.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  debug: typeof debug;
  importData: typeof importData;
  importMatchesDirect: typeof importMatchesDirect;
  matches: typeof matches;
  stats: typeof stats;
  teams: typeof teams;
  testInsert: typeof testInsert;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
