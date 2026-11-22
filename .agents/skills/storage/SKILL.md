---
name: storage
description: >
  Use when the app needs to keep files rather than rows, including uploads,
  attachments, images, documents, recordings, or other blobs. This skill owns
  the Universal App storage pack, its starter folder, and how storage reaches
  the app client. It does not cover app-owned records (use `data-modeling`).
---

# Storage — keeping files, not rows

Use this capability when the app holds files such as uploads, attachments, profile pictures, documents, exports, video, or audio.
Use `data-modeling` instead when the app owns records, and apply both packs when a record has an attached file.

> Storage is still rolling out and is not enabled in every Fabric environment yet.
> If deployment reports that the storage endpoint was not found, tell the user that storage is unavailable in their environment and stop.
> Do not replace it with another upload mechanism.

## Turn it on first

```sh
npm run pack:add -- storage
```

For an app already following the capability-pack workflow, keep using this command.
Alternatively, run the standard Storage initialization command:

```sh
npx rayfin storage init
```

In this template, `storage init` reuses the storage pack and then validates the declarations.
Either command bootstraps Storage; there is no need to run both.
Outside this template's capability-pack workflow, use `npx rayfin storage init` rather than assuming a `pack:add` script exists.

The pack:

- enables storage and the data service it depends on in `rayfin/rayfin.yml`;
- adds `@microsoft/rayfin-storage` to the frontend workspace at the version the app's other Rayfin packages use;
- adds a `packages/storage` workspace with an owner-scoped `Attachment` folder in `packages/storage/rayfin/storage/Attachment.ts`, registered in `packages/storage/rayfin/storage/schema.ts`, and points `services.storage.path` at it;
- adds the storage workspace to the root `build` and `typecheck` scripts, so folder declaration errors show up before deploying;
- plants the browser-side folder map in `packages/frontend/src/lib/storage-schema.ts`;
- composes typed storage onto the app client in `packages/frontend/src/lib/rayfin-client.ts`.

Storage, connectors, data modeling, and functions compose in any order.
Reapplying the pack preserves authored files.
If the pack reports that it kept a customized `rayfin-client.ts`, storage was not composed onto the client; report it and stop.

Storage requires the Data service to be enabled.
The pack defaults a missing Data dialect to MSSQL and preserves an existing dialect, including PostgreSQL.
Leave dialect selection and validation to the Data workflow and its version-matched docs; do not reject a dialect solely because Storage is enabled.

## Read the version-matched docs

Read the installed package docs before writing storage code.
Open `node_modules/@microsoft/rayfin-storage/package.json`, follow its `rayfinDocs.dir`, and read `index.md` for operations, folder options, results, and error codes.
Read `node_modules/@microsoft/rayfin-core/assets/docs/permissions.md` before changing a folder's access rules.
The CLI-installed `rayfin-storage` skill carries the platform guardrails.
Do not copy operation signatures or options from this skill.
When upgrading an existing app, follow the installed Core docs' Storage import migration guidance: the legacy experimental Storage exports have been removed.
Move Storage imports to `@microsoft/rayfin-core`, leaving experimental auth claim imports unchanged.

## Use the starter folder

Reach storage through the app's existing client; do not create a second client.
The client registers `storage: storageService<AppStorageSchema>()` from `@microsoft/rayfin-storage` in `RayfinClient.create({ services: { ... } })`.
Keep the existing `browserSession` adapter and other service registrations; do not subclass the client or access its transport.

```ts
import { getRayfinClient } from '@/lib/rayfin-client';

const client = await getRayfinClient();
const objectName = `${crypto.randomUUID()}-${file.name}`;
await client.storage.Attachment.upload(objectName, file);
```

Give every upload a unique object name, as above.
The starter folder rejects a repeated name, and its owner policy prevents one user from replacing another user's object with the same name.
Keep objects at the folder root unless the user asks for directories.
The owner policy, not the object path, decides what each user can read, so do not add user-ID path segments.
When a record owns a file, store the object name on the record so the UI can download or delete it later.

## Change folders

Add or rename a folder by editing the decorated classes under `packages/storage/rayfin/storage/`, registering each class in `packages/storage/rayfin/storage/schema.ts`, and mirroring each folder key in `packages/frontend/src/lib/storage-schema.ts`.
Every folder needs explicit access control; the server refuses requests to a folder without a rule.
Renaming or removing a folder permanently deletes its stored files once applied, so confirm with the user and read the `rayfin-storage` skill before doing either.

## Validate deployment

A deploy can report success while storage configuration failed.
After deploying, run `npx rayfin up storage apply` and require success.
Run it a second time and require
`No changes detected; configuration is already up to date.`
before describing storage as ready.

## Next

- `data-modeling` for records associated with files
- `crud-ui` for upload and listing screens
- `app-design` for placement and interaction design
