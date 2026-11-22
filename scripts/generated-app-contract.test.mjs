import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { seedDigest } from './scaffold.mjs';
import { assertRayfinDependencyRange } from './rayfin-dependency-range.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

function resolveToolDependency(specifier) {
  try {
    return require.resolve(specifier);
  } catch {
    const cliPackageJson =
      require.resolve('@microsoft/rayfin-cli/package.json');
    return createRequire(cliPackageJson).resolve(specifier);
  }
}

test('the browser document title is Fabric App', () => {
  const html = readFileSync(
    resolve(root, 'packages', 'frontend', 'index.html'),
    'utf8'
  );
  assert.equal(html.match(/<title>([^<]*)<\/title>/u)?.[1], 'Fabric App');
});

test('client packs recognize every current pristine client variant', () => {
  const clients = [
    'packages/frontend/src/lib/rayfin-client.ts',
    '.agents/skills/connectors/kit/rayfin-client.ts',
    '.agents/skills/connectors/kit/rayfin-client.with-functions.ts',
    '.agents/skills/connectors/kit/rayfin-client.with-storage.ts',
    '.agents/skills/connectors/kit/rayfin-client.with-functions-and-storage.ts',
    '.agents/skills/functions-capability/kit/rayfin-client.ts',
    '.agents/skills/storage/kit/rayfin-client.ts',
    '.agents/skills/storage/kit/rayfin-client.with-functions.ts',
  ];
  for (const pack of ['connectors', 'functions-capability', 'storage']) {
    const manifest = JSON.parse(
      readFileSync(
        resolve(root, '.agents', 'skills', pack, 'pack.json'),
        'utf8'
      )
    );
    const entry = manifest.copy.find(
      ({ to }) => to === 'packages/frontend/src/lib/rayfin-client.ts'
    );
    for (const client of clients) {
      assert.ok(
        entry.seedReplaceIfPristine.includes(
          seedDigest(readFileSync(resolve(root, client), 'utf8'))
        ),
        `${pack} must recognize the current ${client} before replacing it`
      );
    }
  }
});

test('React receives the resolved dynamic authentication service', () => {
  const main = readFileSync(
    resolve(root, 'packages', 'frontend', 'src', 'main.tsx'),
    'utf8'
  );
  const bootstrap = main.indexOf('await bootstrapAuth()');
  assert.ok(bootstrap >= 0 && bootstrap < main.indexOf('createRoot(document'));
  assert.match(main, /<Root rayfinAuthService=\{rayfinAuthService\} \/>/u);
  assert.doesNotMatch(main, /function Root\(/u);
});

test('the separate root protects the entire app with the dynamic auth provider and gate', () => {
  const rootSource = readFileSync(
    resolve(root, 'packages', 'frontend', 'src', 'Root.tsx'),
    'utf8'
  );
  let previous = -1;
  for (const fragment of [
    '<ThemeContext.Provider',
    '<ErrorBoundary',
    '<AuthProvider',
    '<AuthGate>',
    '<App />',
  ]) {
    const current = rootSource.indexOf(fragment);
    assert.ok(
      current > previous,
      `${fragment} must keep its provider position`
    );
    previous = current;
  }
});

test('hosted assets are protected while standalone authentication remains supported', () => {
  const config = readFileSync(resolve(root, 'rayfin', 'rayfin.yml'), 'utf8');
  assert.match(config, /assetAccess: protected/u);
  assert.match(config, /embedded:\s+only: false/u);
  assert.match(config, /auth:\s+enabled: true\s+fabric:\s+enabled: true/u);
  assert.match(config, /password:\s+enabled: false/u);
  assert.match(config, /externalEntraExchange: true/u);
});

test('frontend typechecks CLI-generated connector schemas', () => {
  const tsconfig = JSON.parse(
    readFileSync(resolve(root, 'packages', 'frontend', 'tsconfig.json'), 'utf8')
  );

  assert.equal(tsconfig.compilerOptions.rootDir, '../..');
  assert.ok(tsconfig.include.includes('../../rayfin/connectors/**/*.ts'));
});

test('every TypeScript workspace types dynamic auth claims', () => {
  // The CLI writes claims.generated.d.ts to packages/auth, next to
  // packages/functions. Without it, `claims.<custom>` in a data policy and
  // custom claims from getClaims() do not typecheck.
  for (const tsconfigPath of [
    ['packages', 'data', 'tsconfig.json'],
    ['packages', 'frontend', 'tsconfig.json'],
    [
      '.agents',
      'skills',
      'functions-capability',
      'kit',
      'functions',
      'tsconfig.json',
    ],
  ]) {
    const tsconfig = JSON.parse(
      readFileSync(resolve(root, ...tsconfigPath), 'utf8')
    );
    assert.ok(
      tsconfig.include.includes('../auth/*.d.ts'),
      `${tsconfigPath.join('/')} must include ../auth/*.d.ts`
    );
  }
});

test('published Rayfin ranges reject legacy versions and unapproved local targets', () => {
  const name = '@microsoft/rayfin-data';
  const approved = { [name]: `file:${root}` };
  assert.doesNotThrow(() =>
    assertRayfinDependencyRange(name, '^2.0.0', root, {})
  );
  assert.doesNotThrow(() =>
    assertRayfinDependencyRange(name, approved[name], root, approved)
  );
  assert.doesNotThrow(() =>
    assertRayfinDependencyRange(
      name,
      'file:..',
      resolve(root, 'scripts'),
      approved
    )
  );
  for (const range of [
    '^1.36.0-alpha',
    '^3.0.0',
    'file:/unapproved/data',
    `file:${resolve(root, 'scripts')}`,
  ]) {
    assert.throws(() =>
      assertRayfinDependencyRange(name, range, root, approved)
    );
  }
  assert.throws(() =>
    assertRayfinDependencyRange(name, approved[name], root, {})
  );
});

test('workspace and capability manifests require Rayfin 2.0 or exact harness-approved SDK targets', () => {
  for (const project of [
    '.',
    'packages/shared',
    'packages/data',
    'packages/frontend',
    '.agents/skills/functions-capability/kit/functions',
    '.agents/skills/storage/kit/storage',
  ]) {
    const manifest = JSON.parse(
      readFileSync(resolve(root, project, 'package.json'), 'utf8')
    );
    for (const field of [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ]) {
      for (const [name, range] of Object.entries(manifest[field] ?? {})) {
        if (name.startsWith('@microsoft/rayfin-')) {
          assertRayfinDependencyRange(name, range, resolve(root, project));
        }
      }
    }
  }
});

test('workspace and capability kits pin the TypeScript 6 compiler', () => {
  for (const project of [
    '.',
    'packages/shared',
    'packages/data',
    'packages/frontend',
    '.agents/skills/functions-capability/kit/functions',
    '.agents/skills/storage/kit/storage',
  ]) {
    const manifest = JSON.parse(
      readFileSync(resolve(root, project, 'package.json'), 'utf8')
    );
    assert.equal(manifest.devDependencies.typescript, '~6.0.2', project);
  }
});

test('rayfin compiler emits capability sources from one canonical config', () => {
  const tsconfig = JSON.parse(
    readFileSync(resolve(root, 'rayfin', 'tsconfig.json'), 'utf8')
  );

  assert.equal(tsconfig.extends, '../tsconfig.base.json');
  for (const [option, value] of Object.entries({
    outDir: '.temp/compiled',
    rootDir: '.',
    declaration: true,
    composite: true,
    noEmit: false,
    allowImportingTsExtensions: false,
    module: 'ESNext',
    moduleResolution: 'Bundler',
    tsBuildInfoFile: '.temp/rayfin.tsbuildinfo',
  })) {
    assert.equal(tsconfig.compilerOptions[option], value);
  }
  assert.deepEqual(tsconfig.include, ['**/*']);
  assert.deepEqual(tsconfig.exclude, ['.temp/**/*', 'functions/**/*']);
  assert.deepEqual(tsconfig.compilerOptions.types, ['node']);
});

test('rayfin compiler emits loadable Category A connector JavaScript', async () => {
  const fixtureRoot = mkdtempSync(resolve(root, '.rayfin-compiler-'));
  const connectorDir = resolve(
    fixtureRoot,
    'rayfin',
    'connectors',
    'compilerProbe'
  );
  const coreStubDir = resolve(
    fixtureRoot,
    'node_modules',
    '@microsoft',
    'rayfin-core'
  );

  try {
    mkdirSync(connectorDir, { recursive: true });
    mkdirSync(coreStubDir, { recursive: true });
    const nodeTypesManifest = resolveToolDependency('@types/node/package.json');
    cpSync(
      dirname(nodeTypesManifest),
      resolve(fixtureRoot, 'node_modules', '@types', 'node'),
      { recursive: true }
    );
    const nodeTypesRequire = createRequire(nodeTypesManifest);
    const nodeTypes = JSON.parse(readFileSync(nodeTypesManifest, 'utf8'));
    for (const dependency of Object.keys(nodeTypes.dependencies ?? {})) {
      cpSync(
        dirname(nodeTypesRequire.resolve(`${dependency}/package.json`)),
        resolve(fixtureRoot, 'node_modules', dependency),
        { recursive: true }
      );
    }
    writeFileSync(
      resolve(fixtureRoot, 'package.json'),
      readFileSync(resolve(root, 'package.json'))
    );
    writeFileSync(
      resolve(fixtureRoot, 'tsconfig.base.json'),
      readFileSync(resolve(root, 'tsconfig.base.json'))
    );
    writeFileSync(
      resolve(fixtureRoot, 'rayfin', 'tsconfig.json'),
      readFileSync(resolve(root, 'rayfin', 'tsconfig.json'))
    );
    writeFileSync(
      resolve(coreStubDir, 'package.json'),
      JSON.stringify({
        name: '@microsoft/rayfin-core',
        version: '0.0.0',
        type: 'module',
        exports: {
          '.': {
            types: './index.d.ts',
            default: './index.js',
          },
        },
      })
    );
    writeFileSync(
      resolve(coreStubDir, 'index.d.ts'),
      [
        'export declare const entity: (...args: any[]) => any;',
        'export declare const text: (...args: any[]) => any;',
        'export declare const uuid: (...args: any[]) => any;',
        '',
      ].join('\n')
    );
    writeFileSync(
      resolve(coreStubDir, 'index.js'),
      [
        'export const entity = () => () => undefined;',
        'export const text = () => () => undefined;',
        'export const uuid = () => () => undefined;',
        '',
      ].join('\n')
    );
    writeFileSync(
      resolve(connectorDir, 'CompilerProbe.ts'),
      [
        "import { entity, text, uuid } from '@microsoft/rayfin-core';",
        '',
        'export const nodeProbe: Buffer = Buffer.from(process.version);',
        '',
        '@entity()',
        'export class CompilerProbe {',
        '  @uuid() id!: string;',
        '  @text() name!: string;',
        '}',
        '',
      ].join('\n')
    );

    const result = spawnSync(
      process.execPath,
      [
        resolveToolDependency('typescript/lib/tsc.js'),
        '--build',
        'rayfin/tsconfig.json',
        '--force',
      ],
      {
        cwd: fixtureRoot,
        encoding: 'utf8',
      }
    );

    const compiledPath = resolve(
      fixtureRoot,
      'rayfin',
      '.temp',
      'compiled',
      'connectors',
      'compilerProbe',
      'CompilerProbe.js'
    );
    assert.equal(
      result.status,
      0,
      `Rayfin compiler failed:\n${result.stdout}${result.stderr}`
    );
    assert.ok(existsSync(compiledPath));

    const compiledModule = await import(pathToFileURL(compiledPath).href);
    assert.equal(typeof compiledModule.CompilerProbe, 'function');
    assert.ok(Buffer.isBuffer(compiledModule.nodeProbe));
    assert.equal(compiledModule.nodeProbe.toString(), process.version);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
