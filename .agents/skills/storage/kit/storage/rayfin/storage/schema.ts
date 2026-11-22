//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { Attachment } from './Attachment.js';

/**
 * The app's Rayfin storage folders.
 *
 * Register every folder here so deployment configures it, and add the same key
 * to `packages/frontend/src/lib/storage-schema.ts` so the browser client is
 * typed. A folder registered here but missing there is deployed yet invisible
 * to the compiler.
 */
export const schema = [Attachment];
