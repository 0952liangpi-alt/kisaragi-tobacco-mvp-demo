import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname, join, relative} from 'node:path';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const testsDirectory = join(repositoryRoot, 'tests');
const tests = readdirSync(testsDirectory)
  .filter((name) => name.endsWith('.mjs'))
  .sort();

let failures = 0;
for (const name of tests) {
  const testPath = join(testsDirectory, name);
  const label = relative(repositoryRoot, testPath);
  process.stdout.write(`\n=== ${label} ===\n`);
  const result = spawnSync(process.execPath, [testPath], {
    cwd: repositoryRoot,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.status !== 0) failures += 1;
}

process.stdout.write(`\nAcceptance: ${tests.length - failures}/${tests.length} passed\n`);
process.exitCode = failures === 0 ? 0 : 1;
