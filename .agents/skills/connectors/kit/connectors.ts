//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type {
  ConnectorConfigs,
  ConnectorsRuntime,
} from '@microsoft/rayfin-connectors';

/** Replaced with named connector types by `rayfin connector add`. */
export type AppConnectorsSchema = Record<string, never>;

export const connectorConfigs =
  {} satisfies ConnectorConfigs<AppConnectorsSchema>;

export const connectorRuntimes: ConnectorsRuntime = {};
