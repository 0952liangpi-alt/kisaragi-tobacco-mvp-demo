import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sensitiveDatabaseFiles = [
  'data/commerce.sqlite',
  'data/commerce.sqlite3',
  'data/commerce.sqlite-wal',
  'data/commerce.sqlite-shm',
  'data/commerce.sqlite3-wal',
  'data/commerce.sqlite3-shm',
  'data/commerce.db',
  'data/commerce.db-wal',
  'data/commerce.db-shm',
];

for (const path of sensitiveDatabaseFiles) {
  const ignored = execFileSync('git', ['check-ignore', '--no-index', '--quiet', path], {
    cwd: root,
    stdio: 'ignore',
  });
  assert.equal(ignored, null, `${path} must stay ignored`);
}

const tracked = execFileSync('git', ['ls-files'], {cwd: root, encoding: 'utf8'})
  .split('\n')
  .filter(Boolean);
assert.equal(
  tracked.some((path) => /\.(?:sqlite3?|db)(?:-(?:wal|shm))?$/.test(path)),
  false,
  'No SQLite database or companion file may be tracked',
);

console.log('Sensitive file ignore: PASS (SQLite databases and WAL/SHM companions remain untracked)');
