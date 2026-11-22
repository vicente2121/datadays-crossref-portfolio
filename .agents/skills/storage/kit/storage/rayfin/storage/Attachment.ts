//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { blob, mb, role, StorageObject } from '@microsoft/rayfin-core';

/**
 * A starter storage folder — rename it, change the limits, keep the shape.
 *
 * The policy gives each signed-in user access to their own files only, enforced
 * by the server rather than a filter in the UI. Every folder needs explicit
 * access control: with no rule the server refuses every request, so removing
 * this policy makes the folder unusable rather than public. Widen the policy
 * here when files should be shared.
 *
 * Uploads keep the default `onConflict: 'error'`, so a repeated object name is
 * reported instead of replacing an earlier file.
 */
@blob({ maxSize: mb(10) })
@role('authenticated', '*', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
export class Attachment extends StorageObject {}
