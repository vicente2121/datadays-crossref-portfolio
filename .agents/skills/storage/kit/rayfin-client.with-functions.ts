//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { RayfinClient, resolveRayfinConfig } from '@microsoft/rayfin-client';
import { browserSession } from '@microsoft/rayfin-auth';
import { dataService } from '@microsoft/rayfin-data';
import { functionsService } from '@microsoft/rayfin-functions';
import { storageService } from '@microsoft/rayfin-storage';
import type { AppFunctionsSchema } from '@rayfin-app/functions/types';
import type { UniversalAppSchema } from '@rayfin-app/shared';
import type { AppStorageSchema } from './storage-schema';

export type AppClient = ReturnType<typeof createClient>;

let _client: Promise<AppClient> | undefined;

export class MissingRayfinConfigError extends Error {
  constructor(readonly missing: readonly string[]) {
    super(`Missing required Rayfin configuration: ${missing.join(', ')}`);
    this.name = 'MissingRayfinConfigError';
  }
}

/**
 * Resolves and shares the app's configured Rayfin client.
 *
 * Typed by `UniversalAppSchema`, `AppFunctionsSchema`, and `AppStorageSchema`,
 * so `client.data`, `client.functions`, and `client.storage` are all checked
 * against what the app declares.
 *
 * Async because deployment-specific values are resolved at runtime rather than
 * compiled in: a Deployment Pipeline promotes one built artifact from Dev to
 * Prod, so a bundle carrying build-time `VITE_*` values would point the
 * promoted app at the previous stage's backend. The `VITE_*` values are still
 * passed as defaults, which is what local dev runs on.
 */
export async function getRayfinClient(): Promise<AppClient> {
  if (!_client) {
    _client = resolveClient().catch((error) => {
      _client = undefined;
      throw error;
    });
  }

  return _client;
}

async function resolveClient() {
  const resolved = await resolveRayfinConfig({
    apiUrl: import.meta.env.VITE_RAYFIN_API_URL,
    publishableKey: import.meta.env.VITE_RAYFIN_PUBLISHABLE_KEY,
    workspaceId: import.meta.env.VITE_FABRIC_WORKSPACE_ID,
    itemId: import.meta.env.VITE_FABRIC_ITEM_ID,
    portalUrl: import.meta.env.VITE_FABRIC_PORTAL_URL,
  });

  if (!resolved.baseUrl || !resolved.publishableKey) {
    throw new MissingRayfinConfigError([
      ...(!resolved.baseUrl ? ['apiUrl'] : []),
      ...(!resolved.publishableKey ? ['publishableKey'] : []),
    ]);
  }

  return createClient({
    baseUrl: resolved.baseUrl,
    publishableKey: resolved.publishableKey,
    runtimeConfig: resolved.runtimeConfig,
  });
}

function createClient(config: {
  baseUrl: string;
  publishableKey: string;
  runtimeConfig: Awaited<
    ReturnType<typeof resolveRayfinConfig>
  >['runtimeConfig'];
}) {
  return RayfinClient.create({
    ...config,
    auth: browserSession({ storage: true }),
    services: {
      data: dataService<UniversalAppSchema>(),
      functions: functionsService<AppFunctionsSchema>(),
      storage: storageService<AppStorageSchema>(),
    },
  });
}
