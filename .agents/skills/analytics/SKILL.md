---
name: analytics
description: >
  Read Power BI semantic-model data through Rayfin connectors. Use the
  semantic-model query hook with normalized errors, validated DAX and exact
  output columns, then shape results for charts and grids.
---

# Analytics — reading a semantic model

## Connector and discovery

Connect only to a published Power BI semantic model; local `.pbix` files are
not supported. Never guess ids or add a source without the user's consent.
Use ids from a Fabric URL or search results. Registration requires sign-in:

```sh
npx rayfin connector search "<name>" --type fabric-semanticmodel --all-workspaces --json
npx rayfin connector add --type fabric-semanticmodel --name <alias> --workspace-id <workspaceId> --item-id <itemId>
```

For My workspace use `me`. A `401 GroupNotAccessible` after successful search
means missing query access, not necessarily an expired session: check
`npx rayfin login status` before signing in again.

The CLI owns connector registration and generated runtime maps. Do not hand-wire
them or replace the template's auth/client bootstrap. The browser sends the
query and connector name, never workspace/item ids.

The first [schema-discovery](../schema-discovery/SKILL.md) catalog query is the
connectivity preflight; do not run a separate connector probe. Discovery is
always available through `fabric-app-semantic-model-tools query-schema`.
Use [dax-authoring](../dax-authoring/SKILL.md) and
[query-design](../query-design/SKILL.md) together for query work.
Follow the [DAX validation gate](../dax-authoring/SKILL.md#must--prefer--avoid)
before implementing UI that depends on a query's results. Execute final queries through
`fabric-app-semantic-model-tools run-dax-query`.
Follow the consuming app's instructions for discovery/source-reading order,
UI sequencing, runtime client setup and cache policy.

## Runtime contract

Use the shipped `useSemanticModelQuery` hook. Call hooks unconditionally before
loading/error returns. Check `error`, then require `data.status === "success"`
before accessing tables. Query and transport failures are normalized into
`data.status === "error"` and mirrored onto `error`; unexpected internal
failures may set only `error`.

For coordinated semantic-model visuals, use `useQueryFactoryTarget` instead;
see [Managed semantic-model interactions](#managed-semantic-model-interactions).

```tsx
const { data, isLoading, error, refetch } = useSemanticModelQuery({
    connection: "sales",
    query,
});
if (error) return <p role="alert">{error.message}</p>;
if (isLoading && !data) return <p>Loading…</p>;
if (data?.status !== "success") return null;
const table = toDataTable(data.table, columnMetadata);
```

| Category | Meaning | Response |
|---|---|---|
| `query` | Power BI rejected DAX | Fix the query |
| `overflow` | Numeric value cannot fit a JS number | Inspect precision, not row count |
| `network` | No response (offline, DNS, CORS) | Retry |
| `api` | Service answered with failure | Check auth/access |
| `unknown` | Other failures | Read the diagnostics |

Preserve `category`, `code`, Fabric `workload`, and original `cause`.
No error result contains a partial table.
`refetch()` runs the query again. Empty connection/query inputs leave the hook
idle. `getRayfinClient()` may be synchronous or asynchronous depending on the
template: await it before using `.connectors` outside the hook.

## Managed semantic-model interactions

Follow the shared [visual-interactivity](../visual-interactivity/SKILL.md) skill
for default semantic-model coordination, manager configuration, source binding,
query-factory targets, cross-highlighting and retained-data error handling.
That skill owns interaction policy; the consuming template owns runtime caching.

## Rows and field names

Use one `EVALUATE` per query and aggregate or `TOPN` to bound result size.
`resultSetRowCountLimit` silently truncates without a completeness flag; a result
exactly at the cap is possibly incomplete. The hook does not forward that option.
Too many rows is not numeric `overflow`.

Overflow means an Int64 beyond ±9,007,199,254,740,991 or a fixed-decimal value
whose unscaled digits exceed that limit (roughly ±900 billion at four decimals).
Only for genuine numeric overflow, use text, scale the value, or convert to
DOUBLE if the precision change is acceptable. Never reshape a stored measure
to work around a decoder bug; a conversion can drop mixed text/numeric branches.

Use exact raw returned column names as `columnMetadata` keys (`Calendar[Year]`,
`[Sales]`). Supply bracket-free `name` aliases, display names and model formats.
Do not branch on wire `dataType`, which may be `"unknown"`, to choose display
formatting. Missing first-row fields can yield missing inferred columns.
Never mutate a result; copy before sorting.

Keep query factories and `.dax`/`.json` files together under frontend-relative
`src/queries/<page>/`, with kebab-case names and group/root barrel exports.
Import DAX using `?raw`; do not inline it in components.
Read [visuals](../visuals/SKILL.md) for rendering and
[app-design](../app-design/SKILL.md) for template-owned presentation policies.

## Universal App installation and sequencing

Run these before writing code that imports the hook:

```sh
npm run pack:add -- connectors
npm run pack:add -- analytics
```

Add `visuals` separately to chart results. Analytics does not install chart
rendering components or live visual validation. It installs visuals-core
and Interaction Manager for managed query factories; add the visuals pack
for chart, grid and slicer components. The analytics pack installs the schema
tools. There is no discovery feature flag. Use the client installed by the connectors
pack (`RayfinClient.create` with `connectorsService` registered under
`services.connectors`), its functions and storage variants, and the CLI-managed
registration maps. Preserve its async runtime-config resolution
(`rayfin.config.json` first), authentication gate and deployment posture.
Install exact connector package versions printed by the CLI in the frontend
workspace, not at the root, and do not create a nested lockfile:

```sh
npm install -w @rayfin-app/frontend <printed-packages-and-versions>
```

Frontend-relative paths in the shared guidance are under `packages/frontend/`.
Follow the shared [DAX validation gate](../dax-authoring/SKILL.md#must--prefer--avoid):
execute and validate each final DAX query before implementing UI that depends on its results.
Follow the app's `AGENTS.md` for app shells, loading regions and other UI that does
not depend on DAX results. Package installation and connector setup can precede this gate.
Never show invented business values as if the source returned them.
Keep this template's data-source policies and use its existing records and
other capabilities as appropriate; analytics is only for semantic-model reads.
`App.tsx` ships with the starter/welcome view behind the
`packages/frontend/src/EmptyStatePreview.tsx` module. Replace what the app renders
for the real dashboard, but preserve that module and its
existing named `EmptyStatePreview` export so the starter view can evolve independently.

This hook is uncached. Do not import data-app session-cache policies. Do not add
a cache without principal isolation and an explicit lifetime policy.
The installed `querySemanticModel` and `executeQueryFactory` are also uncached;
the managed target hook shares the same typed loader/selection contract as the
data-app without copying its synchronous client or cache bootstrap.
Run `npm run typecheck` separately from the build (`--noCheck`), and follow
[app-validation](../app-validation/SKILL.md), including browser checks.

## Catalog migration

Schema discovery uses `npx fabric-app-semantic-model-tools query-schema` and DAX
uses `npx fabric-app-semantic-model-tools run-dax-query`. Do not run legacy
catalog helper scripts alongside these. The `schema:sql`/`schema:refresh`
aliases installed by this pack invoke the tools package, not the legacy kit.
For an existing app, remove only pristine old helper scripts and replace old
aliases after reviewing app customizations; remove `.schema/` to rebuild the
different catalog format. Never overwrite customized scripts.
The new cache and interrupted-query payloads remain ignored and are customer
data, not public metadata. Do not commit or expose them.
