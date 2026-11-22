//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

/**
 * Storage folders the app reaches as `client.storage.<Folder>`.
 *
 * Keep one key per folder registered in
 * `packages/storage/rayfin/storage/schema.ts`, spelled
 * exactly as that folder is configured: the class name, or the
 * `@blob({ name })` value when one is set. The decorated classes stay out of
 * browser code, so this mirrors them rather than importing them.
 *
 * Each value lists the folder's custom metadata fields. The client adds the
 * stored-object envelope (`path`, `size`, `contentType`, and so on) itself, so
 * a folder without custom fields stays `object`.
 */
export type AppStorageSchema = {
  Attachment: object;
};
