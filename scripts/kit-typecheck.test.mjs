//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

/**
 * Typechecks the TypeScript a pack copies into an app.
 *
 * Kit files live under `.agents/`, which `tsconfig.json` does not include, so
 * nothing compiles them until they are copied into the frontend workspace. That gap
 * shipped a kit file that could not compile: a fixture annotated with a type it
 * only satisfies through a variable, which excess-property checking rejects on
 * a fresh object literal. Every test passed, because none of them ran `tsc`.
 *
 * The external packages are stubbed rather than installed. The bug class this
 * catches is inside our own files, and stubbing keeps the test offline and
 * quick; a real install is what `rayfin_validate_app` does on a generated app.
 */

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { runInNewContext } from 'node:vm';

const run = promisify(execFile);
const TEMPLATE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const workspaces = [];

after(async () => {
  for (const dir of workspaces) {
    await rm(dir, { recursive: true, force: true });
  }
});

/** Where a TypeScript we can run lives, or undefined. */
const TYPESCRIPT = (() => {
  const require = createRequire(import.meta.url);
  for (const candidate of ['typescript-compiler', 'typescript']) {
    try {
      return path.dirname(require.resolve(`${candidate}/package.json`));
    } catch {
      // Try the next one.
    }
  }
  return undefined;
})();

/**
 * `typescript` is a declared devDependency. If it is declared and still
 * unresolvable the install is broken, and skipping would report a green run that
 * checked nothing. Only a checkout that does not declare it may skip.
 */
const TYPESCRIPT_IS_DECLARED = (() => {
  const require = createRequire(import.meta.url);
  try {
    const pkg = require('../package.json');
    return Boolean(
      pkg.devDependencies?.typescript ??
      pkg.dependencies?.typescript ??
      pkg.devDependencies?.['typescript-compiler']
    );
  } catch {
    return false;
  }
})();

const needsTypeScript = {
  skip:
    TYPESCRIPT === undefined && !TYPESCRIPT_IS_DECLARED
      ? 'TypeScript is not installed here'
      : false,
};

/** Minimal declarations for what the kit imports but does not own. */
const STUBS = {
  // Service factories receive the shared transport; callers never access it.
  'types/rayfin-lib.d.ts': `declare module '@microsoft/rayfin-lib' {
  export class ApiClient {
    private readonly __brand: 'ApiClient';
  }
  export interface WorkloadFailure {
    readonly errorCode?: string | undefined;
    readonly subErrorCode?: string | undefined;
  }
  export class SdkError extends Error {
    code?: string;
    constructor(message: string, code?: string);
  }
  export class NetworkError extends SdkError {
    status?: number | undefined;
    workload?: WorkloadFailure | undefined;
    constructor(message: string, status?: number, code?: string);
  }
}
`,
  'types/rayfin-client.d.ts': `declare module '@microsoft/rayfin-client' {
  import type { ApiClient } from '@microsoft/rayfin-lib';
  export interface RayfinClientConfig {
    baseUrl: string;
    publishableKey: string;
    runtimeConfig?: unknown;
    functionsBaseUrl?: string;
  }
  export class RayfinClient {
    private constructor();
    static create<A extends object, S extends Record<string, (http: ApiClient) => object>>(
      config: RayfinClientConfig & { auth: (http: ApiClient) => A; services: S }
    ): { readonly auth: A } & { readonly [K in keyof S]: ReturnType<S[K]> } & { dispose(): void };
  }
  export function resolveRayfinConfig(config: {
    apiUrl?: string;
    publishableKey?: string;
    workspaceId?: string;
    itemId?: string;
    portalUrl?: string;
  }): Promise<{ baseUrl?: string; publishableKey?: string; runtimeConfig?: unknown }>;
}
`,
  'types/rayfin-auth.d.ts': `declare module '@microsoft/rayfin-auth' {
  import type { ApiClient } from '@microsoft/rayfin-lib';
  export function browserSession(options: { storage: boolean }): (http: ApiClient) => object;
}
`,
  'types/rayfin-data.d.ts': `declare module '@microsoft/rayfin-data' {
  import type { ApiClient } from '@microsoft/rayfin-lib';
  export function dataService<TSchema>(): (http: ApiClient) => { readonly __schema?: TSchema };
}
`,
  'types/rayfin-functions.d.ts': `declare module '@microsoft/rayfin-functions' {
  import type { ApiClient } from '@microsoft/rayfin-lib';
  export function functionsService<TSchema>(): (http: ApiClient) => {
    readonly [K in keyof TSchema]: TSchema[K] extends { input: infer I; output: infer O }
      ? { invoke(input: I): Promise<O> }
      : never;
  };
}
`,
  'types/rayfin-storage.d.ts': `declare module '@microsoft/rayfin-storage' {
  import type { ApiClient } from '@microsoft/rayfin-lib';
  export type StorageSchema = Record<string, object>;
  export interface StorageFolderClient<TObject> {
    upload(path: string, data: Blob): Promise<{ object: TObject }>;
  }
  export type StorageClient<TSchema extends StorageSchema> = {
    [K in keyof TSchema]: StorageFolderClient<{ path: string } & Partial<TSchema[K]>>;
  };
  export function storageService<TSchema extends StorageSchema = StorageSchema>():
    (apiClient: ApiClient) => StorageClient<TSchema>;
}
`,
  'types/rayfin-app.d.ts': `declare module '@rayfin-app/shared' {
  export type UniversalAppSchema = Record<string, never>;
}
declare module '@rayfin-app/functions/types' {
  export type AppFunctionsSchema = {
    helloWorld: { input: { firstName: string; lastName: string }; output: string };
  };
}
`,
  'types/vite-env.d.ts': `interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly VITE_RAYFIN_API_URL?: string;
  readonly VITE_RAYFIN_PUBLISHABLE_KEY?: string;
  readonly VITE_FABRIC_WORKSPACE_ID?: string;
  readonly VITE_FABRIC_ITEM_ID?: string;
  readonly VITE_FABRIC_PORTAL_URL?: string;
  readonly VITE_RAYFIN_FUNCTIONS_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
`,
  'rayfin/data/schema.ts': `export type UniversalAppSchema = Record<string, never>;
`,
  'rayfin/functions/src/types.ts': `export type AppFunctionsSchema = Record<string, never>;
`,
  'types/fabric-visuals-core.d.ts': `declare module '@microsoft/fabric-visuals-core' {
  export interface ColumnDef {
    name: string;
    displayName?: string;
    format?: string;
    semanticType?: string;
  }
  export interface DataTable {
    columns: ColumnDef[];
    rows: unknown[][];
  }
}
`,
  // The connectors client and the semantic model connector, mirrored from the
  // installed 2.0 packages.
  //
  // A hand-written mirror can drift from a future release. The authoritative
  // check is the generated app's own `npm run typecheck`; this catches our
  // errors before the kit is copied.
  'types/rayfin-connectors.d.ts': `declare module '@microsoft/rayfin-connectors' {
  import type { SdkError } from '@microsoft/rayfin-lib';
  export class ConnectorsError extends SdkError {
    consentUrl?: string;
    constructor(message: string, code?: string, consentUrl?: string);
  }
  export interface OperationDef<TInput = unknown, TOutput = unknown> {
    readonly __input?: TInput;
    readonly __output?: TOutput;
  }
  export type OperationCatalog = Record<string, OperationDef<any, any>>;
  export interface ConnectorMarker<TCatalog extends OperationCatalog> {
    readonly __operations?: TCatalog;
  }
  export type ConnectorsSchema = Record<string, ConnectorMarker<any>>;
  export type ConnectorConfig = Record<string, unknown>;
  export type ConnectorConfigs<TSchema> = Record<keyof TSchema & string, ConnectorConfig>;
  export type ConnectorsRuntime = Record<string, unknown>;
  export type TypedConnectorsApi<TSchema> = { [K in keyof TSchema]: unknown };
  export function createConnectorsApi<TSchema>(
    client: unknown,
    configs: Record<keyof TSchema & string, ConnectorConfig>,
    runtime?: ConnectorsRuntime
  ): TypedConnectorsApi<TSchema>;
  export function connectorsService<TSchema>(options: {
    configs: ConnectorConfigs<TSchema>;
    runtime?: ConnectorsRuntime;
  }): (client: import('@microsoft/rayfin-lib').ApiClient) => TypedConnectorsApi<TSchema>;
}
declare module '@microsoft/rayfin-connector-fabric-semanticmodel' {
  import type { ConnectorMarker, OperationDef } from '@microsoft/rayfin-connectors';
  export interface ExecuteQueryInput {
    query: string;
  }
  export interface FabricSemanticModelError {
    code?: string;
    message: string;
  }
  export interface FabricSemanticModelTable {
    rows: Array<Record<string, unknown>>;
    error?: FabricSemanticModelError;
    columns?: Array<{ name: string; dataType?: string }>;
  }
  export interface FabricSemanticModelOutput {
    tables: FabricSemanticModelTable[];
    requestId?: string;
    queryError?: FabricSemanticModelError | null;
    responseError?: FabricSemanticModelError | null;
  }
  export interface FabricSemanticModelTabularResponse {
    status: string;
    output: FabricSemanticModelOutput;
    errors: unknown[];
  }
  export type FabricSemanticModelOperation = 'executeQuery';
  export interface FabricSemanticModelOperationCatalog {
    executeQuery: OperationDef<ExecuteQueryInput, FabricSemanticModelTabularResponse>;
  }
  export type FabricSemanticModel<
    TOps extends FabricSemanticModelOperation = FabricSemanticModelOperation
  > = ConnectorMarker<Pick<FabricSemanticModelOperationCatalog, TOps>>;
  export interface QueryColumn {
    name: string;
    dataType: string;
  }
  export interface QueryTable {
    columns: QueryColumn[];
    rows: unknown[][];
  }
  export type QueryErrorCategory =
    | 'api'
    | 'query'
    | 'network'
    | 'overflow'
    | 'unknown';
  export interface QueryError {
    category: QueryErrorCategory;
    message: string;
    code?: string;
    details?: string;
    recoveryHint?: string;
  }
  export type SemanticModelQueryResult =
    | { status: 'success'; table: QueryTable; requestId: string }
    | { status: 'error'; error: QueryError; requestId: string };
  export function toQueryResult(
    response: FabricSemanticModelTabularResponse | SemanticModelQueryResult
  ): SemanticModelQueryResult;
}
// The connectors pack installs the composable client that the analytics hook
// requires; the base template client has no "connectors" member.
//
// This checks the kit, not pack application or generated connector wiring.
declare module '@/lib/rayfin-client' {
  export function getRayfinClient(): Promise<{ connectors: unknown }>;
}
`,
  // The managed-interaction surface the analytics kit's query-factory target
  // hook uses, mirrored from @microsoft/fabric-interaction-manager 1.2.0.
  'types/fabric-interaction-manager.d.ts': `declare module '@microsoft/fabric-interaction-manager' {
  import type { DataTable } from '@microsoft/fabric-visuals-core';
  export interface ManagedQueryFactoryParams {
    readonly interactionFilters?: readonly string[];
  }
  export type InteractionTargetData =
    | DataTable
    | { readonly all: DataTable; readonly highlighted: DataTable };
  export interface CompiledDaxFilters {
    getFilters(mode: 'baseline' | 'highlight'): readonly string[];
  }
  export interface InteractionTargetLoadContext {
    readonly isCrossHighlightActive: boolean;
    readonly compiledFilters: CompiledDaxFilters;
  }
  export type InteractionTargetLoader = (
    context: InteractionTargetLoadContext
  ) => Promise<InteractionTargetData>;
  export type ManagedTargetLoadState =
    | { readonly status: 'loading' }
    | { readonly status: 'refreshing'; readonly data: InteractionTargetData; readonly isCrossHighlightActive: boolean }
    | { readonly status: 'refresh-error'; readonly data: InteractionTargetData; readonly isCrossHighlightActive: boolean; readonly error: Error }
    | { readonly status: 'error'; readonly error: Error }
    | { readonly status: 'ready'; readonly data: InteractionTargetData; readonly isCrossHighlightActive: boolean };
  export function createHighlightData(
    all: DataTable,
    highlightedSubset: DataTable,
    groupingFields: readonly string[],
    missingMeasureReplacementValues: Readonly<Record<string, number | null>>,
    plottedMeasureFields: readonly string[]
  ): { readonly all: DataTable; readonly highlighted: DataTable };
}
declare module '@microsoft/fabric-interaction-manager/react' {
  import type { InteractionTargetLoader, ManagedTargetLoadState } from '@microsoft/fabric-interaction-manager';
  export function useManagedInteractionTarget(
    targetId: string,
    loader: InteractionTargetLoader
  ): ManagedTargetLoadState;
}
`,
  // Only what the kit's hooks call. React itself is not what this test is about.
  'types/react.d.ts': `declare module 'react' {
  export function useState<T = undefined>(): [
    T | undefined,
    (next: T | undefined | ((previous: T | undefined) => T | undefined)) => void
  ];
  export function useState<T>(initial: T | (() => T)): [T, (next: T | ((previous: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useCallback<T>(callback: T, deps: readonly unknown[]): T;
  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  export function useRef<T>(initial: T): { current: T };
}
`,
  // `import.meta.env`, which a kit file may read for a build-time flag. A
  // generated app gets this from `vite/client`; this harness compiles offline,
  // so it states the same shape directly.
  //
  // The index signature is the load-bearing part - `vite/client` declares one,
  // which is why an app can read any `VITE_*` name.
  'types/import-meta-env.d.ts': `interface ImportMetaEnv {
  readonly [key: string]: string | boolean | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
`,
};

const TSCONFIG = {
  compilerOptions: {
    target: 'ES2022',
    lib: ['ES2022', 'DOM'],
    module: 'ESNext',
    moduleResolution: 'bundler',
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    isolatedModules: true,
    moduleDetection: 'force',
    paths: { '@/*': ['./packages/frontend/src/*'] },
  },
  include: ['packages/frontend/src', 'types'],
};

/**
 * Copies one pack's TypeScript kit into a throwaway app and compiles it.
 *
 * `alongside` names packs already applied to the app: their frontend files are
 * copied first, so a composed seed can import what those packs plant. `probe`
 * is application code compiled against the result, which asserts the composed
 * surface is typed rather than merely present. `entries` supplies sources for
 * template-local kits that do not have a pack manifest.
 */
async function typecheckKit(
  pack,
  { sourceOverrides = {}, alongside = [], probe, entries } = {}
) {
  const root = await mkdtemp(path.join(os.tmpdir(), `kit-typecheck-${pack}-`));
  workspaces.push(root);
  await mkdir(path.join(root, 'packages', 'frontend', 'src'), {
    recursive: true,
  });

  // Driven by the pack's own `copy` entries rather than a fixed `kit/lib`, so a
  // pack that starts copying another directory is compiled without this test
  // being updated to match. Frontend source only: a script or a connector file is
  // not TypeScript the app builds.
  const frontendSources = async (name) => {
    const manifest = JSON.parse(
      await readFile(
        path.join(TEMPLATE, '.agents', 'skills', name, 'pack.json'),
        'utf8'
      )
    );
    return (manifest.copy ?? []).filter(
      (entry) =>
        typeof entry.to === 'string' &&
        entry.to.startsWith('packages/frontend/src/')
    );
  };
  const copyEntry = (name, entry, source = entry.from) =>
    cp(
      path.join(TEMPLATE, '.agents', 'skills', name, source),
      path.join(root, ...entry.to.split('/')),
      {
        recursive: true,
        // `.spec` files are excluded rather than stubbed. They import a test
        // runner and a DOM testing library, and hand-writing a matcher surface
        // would assert an API this test does not verify - a generated app
        // installs both for real and compiles them on `npm run typecheck`.
        filter: (source) => !/\.(?:spec|test)\.[jt]sx?$/u.test(source),
      }
    );

  for (const other of alongside) {
    for (const entry of await frontendSources(other)) {
      await copyEntry(other, entry);
    }
  }

  const sources = entries ?? (await frontendSources(pack));
  assert.ok(
    sources.length > 0,
    `${pack}/pack.json copies nothing into packages/frontend/src/, so this test would compile nothing`
  );
  for (const entry of sources) {
    await copyEntry(pack, entry, sourceOverrides[entry.to] ?? entry.from);
  }

  if (probe !== undefined) {
    await writeFile(
      path.join(root, 'packages', 'frontend', 'src', 'probe.ts'),
      probe,
      'utf8'
    );
  }

  for (const [relative, contents] of Object.entries(STUBS)) {
    const target = path.join(root, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents, 'utf8');
  }
  await writeFile(
    path.join(root, 'tsconfig.json'),
    JSON.stringify(TSCONFIG, null, 2),
    'utf8'
  );

  if (TYPESCRIPT === undefined) {
    throw new Error(
      'typescript is a declared dependency of this app but could not be ' +
        'resolved, so the kit was never compiled. Run `npm install` in ' +
        'samples/universal-app. This is a broken install, not a type error.'
    );
  }

  try {
    await run(
      process.execPath,
      [path.join(TYPESCRIPT, 'bin', 'tsc'), '--project', root],
      { encoding: 'utf8' }
    );
    return '';
  } catch (error) {
    return `${error.stdout ?? ''}${error.stderr ?? ''}`;
  }
}

test(
  'the CRUD guidance handles wire booleans and partial updates',
  needsTypeScript,
  async () => {
    const skill = await readFile(
      path.join(TEMPLATE, '.agents', 'skills', 'crud-ui', 'SKILL.md'),
      'utf8'
    );
    const example = skill.match(/```tsx\r?\n([\s\S]*?)\r?\n```/u)?.[1];
    assert.ok(example, 'CRUD guidance must contain a TSX example');
    const task = example.match(/^interface Task .+$/mu)?.[0];
    const helper = example.match(/^function readDone\([\s\S]*?^\}/mu)?.[0];
    const callbacks = example.match(
      /^\s*const crud = useCrud<Task>\(\{[\s\S]*?^ {2}\}\);/mu
    )?.[0];
    assert.ok(task && helper && callbacks, 'CRUD example is incomplete');

    const probe = `
import { useCrud } from './components/useCrud';
${task}
type WireTask = Omit<Task, 'done'> & { done: boolean | 'true' | 'false' };
declare function getRayfinClient(): Promise<{ data: { Task: {
  select(fields: (keyof Task)[]): { execute(): Promise<WireTask[]> };
  create(input: Omit<Task, 'id'>): Promise<WireTask>;
  update(key: { id: string }, patch: Partial<Omit<Task, 'id'>>): Promise<Partial<WireTask>>;
  delete(key: { id: string }): Promise<void>;
} } }>;
${helper}
${callbacks}
`;
    const output = await typecheckKit('crud-ui', {
      entries: [
        {
          from: 'kit/components/useCrud.ts',
          to: 'packages/frontend/src/components/useCrud.ts',
        },
      ],
      probe,
    });
    assert.equal(output, '', `CRUD guidance does not typecheck:\n${output}`);

    const responses = {
      list: [{ id: '1', title: 'task', done: 'false' }],
      create: { id: '1', title: 'task', done: 'true' },
      update: { id: '1' },
    };
    const client = {
      select: () => ({ execute: async () => responses.list }),
      create: async () => responses.create,
      update: async () => responses.update,
      delete: async () => {},
    };
    const require = createRequire(import.meta.url);
    const ts = require(path.join(TYPESCRIPT, 'lib', 'typescript.js'));
    const javascript = ts.transpileModule(`${helper}\n${callbacks}\ncrud`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const api = runInNewContext(javascript, {
      useCrud: (value) => value,
      getRayfinClient: async () => ({ data: { Task: client } }),
    });
    assert.equal((await api.list())[0].done, false);
    assert.equal((await api.create({ title: 'task', done: true })).done, true);
    assert.equal('done' in (await api.update('1', { title: 'task' })), false);
    responses.update = { id: '1', done: 'false' };
    assert.equal((await api.update('1', { done: false })).done, false);
    responses.update = { id: '1', done: 'invalid' };
    await assert.rejects(api.update('1', { done: false }), /Invalid boolean/u);
  }
);

test(
  'the visuals kit compiles once copied into an app',
  needsTypeScript,
  async () => {
    const output = await typecheckKit('visuals');
    assert.equal(output, '', `visuals kit does not typecheck:\n${output}`);
  }
);

test(
  'the analytics kit compiles once copied into an app',
  needsTypeScript,
  async () => {
    // Analytics ships the semantic-model hook and the connector registration.
    // The connector packages are stubbed, so what is actually asserted is that
    // our own files hold together against them.
    const output = await typecheckKit('analytics');
    assert.equal(output, '', `analytics kit does not typecheck:\n${output}`);
  }
);

const PACKS_WITH_APP_SOURCES = await (async () => {
  const skills = path.join(TEMPLATE, '.agents', 'skills');
  const directories = await readdir(skills);
  const packs = [];
  for (const directory of directories) {
    try {
      const manifest = JSON.parse(
        await readFile(path.join(skills, directory, 'pack.json'), 'utf8')
      );
      if (
        (manifest.copy ?? []).some(
          (entry) =>
            typeof entry.to === 'string' &&
            entry.to.startsWith('packages/frontend/src/')
        )
      ) {
        packs.push(directory);
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  return packs.sort();
})();

for (const pack of PACKS_WITH_APP_SOURCES) {
  test(`${pack} app-source kit compiles`, needsTypeScript, async () => {
    const output = await typecheckKit(pack);
    assert.equal(output, '', `${pack} kit does not typecheck:\n${output}`);
  });
}

/** Skill folder for each pack name a `whenPacks` list may use. */
const SKILL_FOR_PACK = await (async () => {
  const skills = path.join(TEMPLATE, '.agents', 'skills');
  const folders = new Map();
  for (const directory of await readdir(skills)) {
    try {
      const manifest = JSON.parse(
        await readFile(path.join(skills, directory, 'pack.json'), 'utf8')
      );
      folders.set(manifest.name ?? directory, directory);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  return folders;
})();

/**
 * Application code that must compile against a composed client. Each check
 * fails if the seed stops exposing a capability or drops its schema generic:
 * an untyped storage client would accept any folder name, which leaves the
 * `@ts-expect-error` unused.
 */
function probeFor(packs) {
  const checks = [];
  if (packs.includes('storage')) {
    checks.push(
      "  const { object } = await client.storage.Attachment.upload('a.txt', file);",
      '  // @ts-expect-error folders outside AppStorageSchema are not reachable',
      '  void client.storage.NotAFolder;',
      '  void object.path;'
    );
  }
  if (packs.includes('connectors')) checks.push('  void client.connectors;');
  if (packs.includes('functions')) {
    checks.push(
      "  const greeting: string = await client.functions.helloWorld.invoke({ firstName: 'Ada', lastName: 'Lovelace' });",
      '  void greeting;',
      '  // @ts-expect-error unknown functions remain unavailable',
      '  void client.functions.NotAFunction;',
      '  // @ts-expect-error function input remains schema-checked',
      "  void client.functions.helloWorld.invoke({ firstName: 42, lastName: 'Lovelace' });"
    );
  }
  if (checks.length === 0) return undefined;
  return [
    "import { getRayfinClient } from './lib/rayfin-client';",
    '',
    'export async function probe(file: Blob): Promise<void> {',
    '  const client = await getRayfinClient();',
    ...checks,
    '}',
    '',
  ].join('\n');
}

// Every composed seed a pack can select, compiled beside the files the packs it
// composes with have already planted. Driven by `fromVariants`, so a new
// combination is compiled without this test being updated to match.
const COMPOSED_SEEDS = await (async () => {
  const seeds = [];
  for (const pack of PACKS_WITH_APP_SOURCES) {
    const manifest = JSON.parse(
      await readFile(
        path.join(TEMPLATE, '.agents', 'skills', pack, 'pack.json'),
        'utf8'
      )
    );
    for (const entry of manifest.copy ?? []) {
      if (!entry.to?.startsWith('packages/frontend/src/')) continue;
      seeds.push({ pack, name: manifest.name, alongside: [], entry });
      for (const variant of entry.fromVariants ?? []) {
        seeds.push({
          pack,
          name: manifest.name,
          alongside: variant.whenPacks,
          entry,
          from: variant.from,
        });
      }
    }
  }
  return seeds.filter(
    ({ alongside, entry }) =>
      alongside.length > 0 || entry.to.endsWith('/rayfin-client.ts')
  );
})();

for (const { pack, name, alongside, entry, from } of COMPOSED_SEEDS) {
  const label = [name, ...alongside].join(' + ');
  test(
    `the ${label} client seed compiles and stays typed`,
    needsTypeScript,
    async () => {
      const output = await typecheckKit(pack, {
        sourceOverrides: from ? { [entry.to]: from } : {},
        alongside: alongside.map((other) => {
          const folder = SKILL_FOR_PACK.get(other);
          assert.ok(
            folder,
            `${pack}/pack.json composes with unknown pack "${other}"`
          );
          return folder;
        }),
        probe: probeFor([name, ...alongside]),
      });
      assert.equal(
        output,
        '',
        `${label} client seed does not typecheck:\n${output}`
      );
    }
  );
}
