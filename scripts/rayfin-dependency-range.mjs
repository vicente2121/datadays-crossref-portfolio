import assert from 'node:assert/strict';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';

export function assertRayfinDependencyRange(
  packageName,
  range,
  manifestDirectory,
  approvedLocalPackages = JSON.parse(
    process.env.RAYFIN_TEST_LOCAL_SDK_PACKAGES ?? '{}'
  )
) {
  if (range === '^2.0.0') return;
  const approved = approvedLocalPackages[packageName];
  assert.ok(
    typeof approved === 'string' &&
      approved.startsWith('file:') &&
      typeof range === 'string' &&
      range.startsWith('file:'),
    `${packageName} must use ^2.0.0 unless the harness approves its exact local SDK target`
  );
  assert.equal(
    realpathSync(resolve(manifestDirectory, range.slice('file:'.length))),
    realpathSync(approved.slice('file:'.length)),
    `${packageName} must use its approved local SDK target`
  );
}
