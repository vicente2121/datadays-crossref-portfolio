---
name: observability
description: >
  Use when adding Observability, application telemetry, Application Insights,
  frontend OpenTelemetry instrumentation, custom events or spans, or querying
  the app's telemetry. Routes to version-matched Rayfin documentation and the
  Microsoft browser SDK reference; does not configure an arbitrary KQL data source.
---

# Observability

Use the installed documentation before configuring telemetry or writing SDK calls.
This skill owns the Universal App workflow, not version-sensitive CLI or SDK contracts.

## Read the versioned guidance

1. Read the installed `@microsoft/rayfin-telemetry/package.json`.
   Follow its `rayfinDocs.dir` to `index.md`, then read the setup, connection-string, frontend, and troubleshooting pages needed for the request.
   For telemetry queries or app diagnosis, follow the installed `querying-and-debugging.md` runbook and report collection gaps alongside observed evidence.
2. If it is missing, determine the installed Rayfin CLI version and request installation of the matching telemetry package in the frontend workspace.
   Use the project's existing Rayfin package feed.
   If that release has no published documentation package, report the gap rather than silently installing a different release.
3. Prefer the installed pages or exact IDs through `rayfin docs get`.
   Use docs search only when their index does not identify the page.
4. Read the [Microsoft browser distribution documentation](https://github.com/microsoft/opentelemetry-distro-browser) for the exact SDK version selected by the integration guide.
   Do not assume another prerelease has the same API or exporter.

## Apply to this workspace

- There is no Observability capability pack to apply.
  Do not invent a pack, CLI command, environment mapping, or initializer API beyond the installed package's documented browser entry point.
- Follow the versioned setup guide for prerequisites and the preview gates.
  A local CLI feature flag does not establish that the target Fabric environment supports provisioning.
- Install browser SDK dependencies in `@rayfin-app/frontend` from the npm workspace root.
  Do not create a nested lockfile.
- Use the existing composable client in `packages/frontend/src/lib/rayfin-client.ts` to read resolved runtime configuration.
  Preserve dynamic authentication and the app's auth gate.
  Do not bake one workspace's telemetry destination into a bundle promoted between stages.
- Initialize browser instrumentation once in the client startup path, after any required consent.
  Make absent configuration and initialization errors visible to the developer without logging credentials.
  Follow the versioned collection defaults; do not add Fetch/XHR instrumentation or manual dependency spans to the example without an explicit volume-budget decision.
- Follow [`app-deployment`](../app-deployment/SKILL.md) before any remote write.
  Require explicit approval before disabling and redeploying telemetry because the versioned guide describes resource deletion and loss of access to historical data.
- When asked for application telemetry queries, target the app's allocated Application Insights resource, not its backing Log Analytics workspace.
  Use Application Insights table names such as `traces`, `customEvents`, and `pageViews`, and columns such as `timestamp`, `message`, and `customDimensions`.
  Follow the installed query examples; do not generate queries using the backing workspace schema.
- Validate a deliberate test signal in the correct app-associated resource.
  Report emission, ingestion, and permissions failures separately; a build or successful deployment alone is not ingestion proof.

Application telemetry queries are not a general Kusto connector.
For requests to connect an application to a KQL data source, follow [`connectors`](../connectors/SKILL.md) instead.
