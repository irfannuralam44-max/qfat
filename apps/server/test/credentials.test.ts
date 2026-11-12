import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  lstatSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import { openDatabase, closeDatabase } from '../src/db/connection.js';
import { runMigrations } from '../src/db/migrate.js';
import { getCredentialKeyPath, getKeyDir } from '../src/config.js';
import {
  CREDENTIAL_ENVELOPE_VERSION,
  CredentialStorageError,
  KeyFileCredentialProvider,
  credentialAad,
  decryptCredential,
  encryptCredential,
  loadOrCreateCredentialKey,
  type CredentialContext,
} from '../src/credentials/index.js';

const DUMMY_TOKEN = 'dummy-refresh-token-qfat-013-not-a-real-credential';
const CONTEXT: CredentialContext = {
  id: 'credential-record-1',
  purpose: 'oauth-refresh-token',
  provider: 'youtube',
};

interface Fixture {
  dir: string;
  dbPath: string;
  keyDir: string;
  keyPath: string;
  db: Database;
  close: () => void;
}

async function openFixture(prefix = 'qfat-cred'): Promise<Fixture> {
  const dir = mkdtempSync(join(tmpdir(), `${prefix}-`));
  const dbPath = join(dir, 'qfat.db');
  const keyDir = join(dir, 'keys');
  const keyPath = join(keyDir, 'credential.key');
  await runMigrations(dbPath);
  const conn = openDatabase(dbPath);

  return {
    dir,
    dbPath,
    keyDir,
    keyPath,
    db: conn.db,
    close: () => {
      try { closeDatabase(conn.db); } catch { /* ignore */ }
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

function newProvider(fixture: Fixture): KeyFileCredentialProvider {
  return new KeyFileCredentialProvider(fixture.db, { keyPath: fixture.keyPath });
}

function rows(fixture: Fixture): Array<Record<string, unknown>> {
  return fixture.db.prepare('SELECT * FROM credential_records').all() as Array<Record<string, unknown>>;
}

async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(promise, (err: unknown) => {
    assert.ok(err instanceof CredentialStorageError, `expected CredentialStorageError, got ${String(err)}`);
    assert.equal(err.code, code);
    return true;
  });
}

function expectSyncCode(fn: () => unknown, code: string): void {
  assert.throws(fn, (err: unknown) => {
    assert.ok(err instanceof CredentialStorageError, `expected CredentialStorageError, got ${String(err)}`);
    assert.equal(err.code, code);
    return true;
  });
}

function writeValidKey(path: string, key = randomBytes(32)): Buffer {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, key, { mode: 0o600 });
  chmodSync(path, 0o600);
  return key;
}

function assertNoTokenBytes(haystack: Buffer, token: string): void {
  assert.equal(haystack.includes(Buffer.from(token, 'utf8')), false, 'raw token must not appear in persisted bytes');
}

describe('Credential provider round trip', () => {
  test('default key path follows the QFAT data-directory convention', () => {
    assert.equal(getCredentialKeyPath(), resolve(getKeyDir(), 'credential.key'));
    assert.equal(getCredentialKeyPath().endsWith(join('keys', 'credential.key')), true);
  });

  test('stores, retrieves, and deletes an opaque payload', async () => {
    const f = await openFixture();
    try {
      const provider = newProvider(f);
      const payload = Buffer.from(DUMMY_TOKEN);

      await provider.store(CONTEXT, payload);
      const retrieved = await provider.retrieve(CONTEXT);
      assert.ok(retrieved);
      assert.deepEqual(retrieved, payload);

      assert.equal(await provider.delete(CONTEXT), true);
      assert.equal(await provider.retrieve(CONTEXT), null);
      assert.equal(await provider.delete(CONTEXT), false);
    } finally {
      f.close();
    }
  });

  test('never stores the raw dummy token in SQLite rows or database files', async () => {
    const f = await openFixture();
    try {
      const provider = newProvider(f);
      await provider.store(CONTEXT, Buffer.from(DUMMY_TOKEN));

      for (const row of rows(f)) {
        for (const value of Object.values(row)) {
          if (Buffer.isBuffer(value)) assertNoTokenBytes(value, DUMMY_TOKEN);
          if (typeof value === 'string') {
            assert.equal(value.includes(DUMMY_TOKEN), false);
          }
        }
      }

      assertNoTokenBytes(readFileSync(f.dbPath), DUMMY_TOKEN);
      for (const sidecar of [`${f.dbPath}-wal`, `${f.dbPath}-shm`]) {
        if (existsSync(sidecar)) assertNoTokenBytes(readFileSync(sidecar), DUMMY_TOKEN);
      }
    } finally {
      f.close();
    }
  });

  test('uses a fresh nonce and ciphertext for separate encryptions of the same payload', async () => {
    const f = await openFixture();
    try {
      const provider = newProvider(f);
      const payload = Buffer.from(DUMMY_TOKEN);

      await provider.store(CONTEXT, payload);
      const first = rows(f)[0];
      await provider.store(CONTEXT, payload);
      const second = rows(f)[0];

      assert.notDeepEqual(first.nonce, second.nonce);
      assert.notDeepEqual(first.ciphertext, second.ciphertext);
      assert.deepEqual(await provider.retrieve(CONTEXT), payload);
    } finally {
      f.close();
    }
  });

  test('rejects a record ID reused with a different purpose or provider', async () => {
    const f = await openFixture();
    try {
      const provider = newProvider(f);
      await provider.store(CONTEXT, Buffer.from(DUMMY_TOKEN));

      await expectCode(
        provider.store({ ...CONTEXT, purpose: 'different-purpose' }, Buffer.from('other')),
        'CONTEXT_MISMATCH',
      );
      await expectCode(provider.retrieve({ ...CONTEXT, provider: 'facebook' }), 'CONTEXT_MISMATCH');
      await expectCode(provider.delete({ ...CONTEXT, purpose: 'different-purpose' }), 'CONTEXT_MISMATCH');
      assert.deepEqual(await provider.retrieve(CONTEXT), Buffer.from(DUMMY_TOKEN));
    } finally {
      f.close();
    }
  });

  test('key file and directory are separate from the database and owner-only', async () => {
    const f = await openFixture();
    try {
      const provider = newProvider(f);
      await provider.store(CONTEXT, Buffer.from(DUMMY_TOKEN));

      assert.equal(existsSync(f.keyPath), true);
      assert.equal(resolve(f.keyPath) !== resolve(f.dbPath), true);
      assert.equal(dirname(f.keyPath) !== dirname(f.dbPath), true);
      assert.equal(statSync(f.keyPath).size, 32);
      assert.equal(statSync(f.keyPath).mode & 0o777, 0o600);
      assert.equal(statSync(f.keyDir).mode & 0o777, 0o700);
    } finally {
      f.close();
    }
  });
});

describe('Credential envelope cryptography', () => {
  const key = randomBytes(32);
  const payload = Buffer.from(DUMMY_TOKEN);

  test('AES-256-GCM round trip preserves the exact payload and envelope shape', () => {
    const envelope = encryptCredential(key, CONTEXT, payload);

    assert.equal(envelope.version, CREDENTIAL_ENVELOPE_VERSION);
    assert.equal(envelope.nonce.length, 12);
    assert.equal(envelope.authTag.length, 16);
    assert.equal(envelope.ciphertext.includes(payload), false);
    assert.deepEqual(decryptCredential(key, CONTEXT, envelope), payload);
  });

  test('fresh nonce for separate encryptions of the same payload', () => {
    const first = encryptCredential(key, CONTEXT, payload);
    const second = encryptCredential(key, CONTEXT, payload);
    assert.notDeepEqual(first.nonce, second.nonce);
    assert.notDeepEqual(first.ciphertext, second.ciphertext);
  });

  test('tampered ciphertext fails closed', () => {
    const envelope = encryptCredential(key, CONTEXT, payload);
    const ciphertext = Buffer.from(envelope.ciphertext);
    ciphertext[0] ^= 0xff;
    expectSyncCode(() => decryptCredential(key, CONTEXT, { ...envelope, ciphertext }), 'DECRYPT_FAILED');
  });

  test('tampered nonce fails closed', () => {
    const envelope = encryptCredential(key, CONTEXT, payload);
    const nonce = Buffer.from(envelope.nonce);
    nonce[0] ^= 0xff;
    expectSyncCode(() => decryptCredential(key, CONTEXT, { ...envelope, nonce }), 'DECRYPT_FAILED');
  });

  test('tampered authentication tag fails closed', () => {
    const envelope = encryptCredential(key, CONTEXT, payload);
    const authTag = Buffer.from(envelope.authTag);
    authTag[0] ^= 0xff;
    expectSyncCode(() => decryptCredential(key, CONTEXT, { ...envelope, authTag }), 'DECRYPT_FAILED');
  });

  test('wrong key fails closed', () => {
    const envelope = encryptCredential(key, CONTEXT, payload);
    expectSyncCode(() => decryptCredential(randomBytes(32), CONTEXT, envelope), 'DECRYPT_FAILED');
  });

  test('mismatched AAD fails closed', () => {
    const envelope = encryptCredential(key, CONTEXT, payload);
    expectSyncCode(
      () => decryptCredential(key, { ...CONTEXT, purpose: 'different-purpose' }, envelope),
      'DECRYPT_FAILED',
    );
    assert.notDeepEqual(credentialAad(CONTEXT), credentialAad({ ...CONTEXT, provider: 'facebook' }));
  });

  test('invalid envelope version, nonce, tag, and key lengths fail closed', () => {
    const envelope = encryptCredential(key, CONTEXT, payload);
    expectSyncCode(
      () => decryptCredential(key, CONTEXT, { ...envelope, version: 2 }),
      'ENVELOPE_INVALID',
    );
    expectSyncCode(
      () => decryptCredential(key, CONTEXT, { ...envelope, nonce: Buffer.alloc(11) }),
      'ENVELOPE_INVALID',
    );
    expectSyncCode(
      () => decryptCredential(key, CONTEXT, { ...envelope, authTag: Buffer.alloc(15) }),
      'ENVELOPE_INVALID',
    );
    expectSyncCode(() => decryptCredential(Buffer.alloc(31), CONTEXT, envelope), 'KEY_INVALID');
  });

  test('invalid context and non-Buffer payload fail closed', () => {
    expectSyncCode(() => encryptCredential(key, { ...CONTEXT, id: '' }, payload), 'CONTEXT_INVALID');
    expectSyncCode(() => encryptCredential(key, { ...CONTEXT, id: 'a\0b' }, payload), 'CONTEXT_INVALID');
    expectSyncCode(() => encryptCredential(key, CONTEXT, DUMMY_TOKEN as any), 'PAYLOAD_INVALID');
  });
});

describe('Credential key-file lifecycle', () => {
  test('missing key with no records creates a 32-byte key exactly once', async () => {
    const f = await openFixture();
    try {
      const provider = newProvider(f);
      await provider.store(CONTEXT, Buffer.from(DUMMY_TOKEN));
      const first = readFileSync(f.keyPath);

      const secondProvider = newProvider(f);
      await secondProvider.store({ ...CONTEXT, id: 'credential-record-2' }, Buffer.from('second'));
      const second = readFileSync(f.keyPath);

      assert.equal(first.length, 32);
      assert.deepEqual(second, first);
    } finally {
      f.close();
    }
  });

  test('missing key with existing encrypted records fails closed and is not regenerated', async () => {
    const f = await openFixture();
    try {
      const provider = newProvider(f);
      await provider.store(CONTEXT, Buffer.from(DUMMY_TOKEN));
      rmSync(f.keyPath);

      const restarted = newProvider(f);
      await expectCode(restarted.retrieve(CONTEXT), 'KEY_MISSING_WITH_RECORDS');
      await expectCode(restarted.store(CONTEXT, Buffer.from('replacement')), 'KEY_MISSING_WITH_RECORDS');
      assert.equal(existsSync(f.keyPath), false);
    } finally {
      f.close();
    }
  });

  test('corrupt, truncated, and wrong-length key files fail closed', async () => {
    const f = await openFixture();
    try {
      const provider = newProvider(f);
      await provider.store(CONTEXT, Buffer.from(DUMMY_TOKEN));

      for (const length of [0, 31, 33]) {
        rmSync(f.keyPath, { force: true });
        writeValidKey(f.keyPath, randomBytes(length));
        await expectCode(newProvider(f).retrieve(CONTEXT), 'KEY_INVALID');
        await expectCode(newProvider(f).store(CONTEXT, Buffer.from('replacement')), 'KEY_INVALID');
      }
    } finally {
      f.close();
    }
  });

  test('unreadable/insecure-permission key file fails closed', async (t) => {
    if (process.getuid?.() === 0) {
      t.skip('running as root; chmod 000 cannot make the key unreadable');
      return;
    }

    const f = await openFixture();
    try {
      const provider = newProvider(f);
      await provider.store(CONTEXT, Buffer.from(DUMMY_TOKEN));
      chmodSync(f.keyPath, 0o000);
      try {
        await expectCode(newProvider(f).retrieve(CONTEXT), 'KEY_PERMISSIONS_UNSAFE');
      } finally {
        chmodSync(f.keyPath, 0o600);
      }
    } finally {
      f.close();
    }
  });

  test('non-regular and symlinked key paths are rejected', async () => {
    const f = await openFixture();
    try {
      mkdirSync(f.keyPath, { recursive: true, mode: 0o700 });
      expectSyncCode(
        () => loadOrCreateCredentialKey(f.keyPath, { platform: 'linux', hasEncryptedRecords: false }),
        'KEY_NOT_REGULAR',
      );

      rmSync(f.keyPath, { recursive: true, force: true });
      const outside = join(f.dir, 'outside.key');
      writeValidKey(outside);
      symlinkSync(outside, f.keyPath);
      expectSyncCode(
        () => loadOrCreateCredentialKey(f.keyPath, { platform: 'linux', hasEncryptedRecords: false }),
        'KEY_NOT_REGULAR',
      );
      assert.equal(readFileSync(outside).length, 32);
    } finally {
      f.close();
    }
  });

  test('symlinked key directory is rejected', async () => {
    const f = await openFixture();
    try {
      const outsideDir = join(f.dir, 'outside-keys');
      mkdirSync(outsideDir, { recursive: true, mode: 0o700 });
      symlinkSync(outsideDir, f.keyDir);
      expectSyncCode(
        () => loadOrCreateCredentialKey(f.keyPath, { platform: 'linux', hasEncryptedRecords: false }),
        'KEY_DIRECTORY_UNSAFE',
      );
    } finally {
      f.close();
    }
  });

  test('QFAT data directory owned by another OS user is rejected', async () => {
    const f = await openFixture();
    try {
      writeValidKey(f.keyPath);
      const originalGetuid = process.getuid;
      (process as any).getuid = () => (originalGetuid?.() ?? 0) + 1;
      try {
        expectSyncCode(
          () => loadOrCreateCredentialKey(f.keyPath, { platform: 'linux', hasEncryptedRecords: false }),
          'KEY_DATA_DIRECTORY_UNSAFE',
        );
      } finally {
        (process as any).getuid = originalGetuid;
      }
    } finally {
      f.close();
    }
  });

  test('unsafe directory and file permissions are rejected', async () => {
    const f = await openFixture();
    try {
      mkdirSync(f.keyDir, { recursive: true, mode: 0o755 });
      chmodSync(f.keyDir, 0o755);
      writeValidKey(f.keyPath);
      expectSyncCode(
        () => loadOrCreateCredentialKey(f.keyPath, { platform: 'linux', hasEncryptedRecords: false }),
        'KEY_PERMISSIONS_UNSAFE',
      );

      chmodSync(f.keyDir, 0o700);
      chmodSync(f.keyPath, 0o644);
      expectSyncCode(
        () => loadOrCreateCredentialKey(f.keyPath, { platform: 'linux', hasEncryptedRecords: false }),
        'KEY_PERMISSIONS_UNSAFE',
      );
    } finally {
      f.close();
    }
  });

  test('Windows startup fails closed because ACL verification is unavailable', async () => {
    const f = await openFixture();
    try {
      expectSyncCode(
        () => loadOrCreateCredentialKey(f.keyPath, { platform: 'win32', hasEncryptedRecords: false }),
        'WINDOWS_ACL_UNVERIFIED',
      );
      expectSyncCode(
        () => new KeyFileCredentialProvider(f.db, { keyPath: f.keyPath, platform: 'win32' }),
        'WINDOWS_ACL_UNVERIFIED',
      );
      assert.equal(existsSync(f.keyPath), false);
    } finally {
      f.close();
    }
  });

  test('concurrent first-time initialization converges on one key', async () => {
    const f = await openFixture();
    const children: ReturnType<typeof spawn>[] = [];
    try {
      const sourcePath = resolve(process.cwd(), 'src/credentials/key-file.js');
      const tsxCli = resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs');
      const scriptPath = join(f.dir, 'init-key.ts');
      const barrierPath = join(f.dir, 'start.barrier');
      const ready1 = join(f.dir, 'ready-1');
      const ready2 = join(f.dir, 'ready-2');
      const out1 = join(f.dir, 'key-1.hex');
      const out2 = join(f.dir, 'key-2.hex');

      writeFileSync(scriptPath, `
import { existsSync, writeFileSync } from 'node:fs';
import { loadOrCreateCredentialKey } from ${JSON.stringify(sourcePath)};

async function main() {
  const [keyPath, barrier, ready, out] = process.argv.slice(2);
  writeFileSync(ready, 'ready');
  while (!existsSync(barrier)) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 2));
  }
  const key = loadOrCreateCredentialKey(keyPath, { platform: 'linux', hasEncryptedRecords: false });
  writeFileSync(out, key.toString('hex'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
`);

      const startChild = (ready: string, out: string) => {
        const child = spawn(
          process.execPath,
          [tsxCli, scriptPath, f.keyPath, barrierPath, ready, out],
          { stdio: ['ignore', 'ignore', 'pipe'] },
        );
        children.push(child);
        return child;
      };

      const child1 = startChild(ready1, out1);
      const child2 = startChild(ready2, out2);
      let stderr = '';
      child1.stderr?.on('data', (chunk) => { stderr += String(chunk); });
      child2.stderr?.on('data', (chunk) => { stderr += String(chunk); });

      const waitFor = async (predicate: () => boolean, timeoutMs: number) => {
        const deadline = Date.now() + timeoutMs;
        while (!predicate()) {
          if (Date.now() > deadline) throw new Error('timed out waiting for child process readiness');
          await new Promise((resolveWait) => setTimeout(resolveWait, 5));
        }
      };
      await waitFor(() => existsSync(ready1) && existsSync(ready2), 10_000);
      writeFileSync(barrierPath, 'go');

      const exitCode = (child: ReturnType<typeof spawn>) => new Promise<number>((resolveExit, rejectExit) => {
        child.once('error', rejectExit);
        child.once('exit', (code) => resolveExit(code ?? 1));
      });
      const [code1, code2] = await Promise.all([exitCode(child1), exitCode(child2)]);
      assert.equal(code1, 0, `first child failed: ${stderr}`);
      assert.equal(code2, 0, `second child failed: ${stderr}`);

      assert.equal(readFileSync(out1, 'utf8'), readFileSync(out2, 'utf8'));
      assert.equal(readFileSync(f.keyPath).length, 32);
      assert.equal(statSync(f.keyPath).mode & 0o777, 0o600);
    } finally {
      for (const child of children) {
        if (child.exitCode === null) child.kill('SIGKILL');
      }
      f.close();
    }
  });
});

describe('Credential error hygiene', () => {
  test('authentication errors do not include plaintext, key, or ciphertext bytes', async () => {
    const f = await openFixture();
    try {
      const provider = newProvider(f);
      await provider.store(CONTEXT, Buffer.from(DUMMY_TOKEN));
      const row = rows(f)[0];
      const ciphertextHex = Buffer.from(row.ciphertext as Buffer).toString('hex');

      f.db.prepare('UPDATE credential_records SET ciphertext = ? WHERE id = ?').run(
        Buffer.from([0xff, 0xff, 0xff, 0xff]),
        CONTEXT.id,
      );

      let message = '';
      try {
        await provider.retrieve(CONTEXT);
      } catch (err) {
        message = String(err);
      }

      assert.ok(message.length > 0);
      assert.equal(message.includes(DUMMY_TOKEN), false);
      assert.equal(message.includes(ciphertextHex), false);
      assert.equal(message.includes(readFileSync(f.keyPath).toString('hex')), false);
    } finally {
      f.close();
    }
  });
});

describe('Credential QFAT data-directory validation', () => {
  test('default and configured data directories are created owner-only when missing', async () => {
    const parent = mkdtempSync(join(tmpdir(), 'qfat-data-parent-'));
    const dataDir = join(parent, 'qfat-data');
    const keyPath = join(dataDir, 'keys', 'credential.key');
    try {
      loadOrCreateCredentialKey(keyPath, { platform: 'linux', hasEncryptedRecords: false });
      assert.equal(statSync(dataDir).isDirectory(), true);
      assert.equal(statSync(dataDir).mode & 0o777, 0o700);
      assert.equal(statSync(dirname(keyPath)).mode & 0o777, 0o700);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  test('symlinked QFAT data directory is rejected', async () => {
    const parent = mkdtempSync(join(tmpdir(), 'qfat-data-parent-'));
    const realDir = join(parent, 'real-data');
    const dataDir = join(parent, 'qfat-data');
    const keyPath = join(dataDir, 'keys', 'credential.key');
    mkdirSync(realDir, { recursive: true, mode: 0o700 });
    symlinkSync(realDir, dataDir);
    try {
      expectSyncCode(
        () => loadOrCreateCredentialKey(keyPath, { platform: 'linux', hasEncryptedRecords: false }),
        'KEY_DATA_DIRECTORY_UNSAFE',
      );
      assert.equal(existsSync(keyPath), false);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  test('non-directory QFAT data path is rejected', async () => {
    const parent = mkdtempSync(join(tmpdir(), 'qfat-data-parent-'));
    const dataDir = join(parent, 'qfat-data');
    const keyPath = join(dataDir, 'keys', 'credential.key');
    writeFileSync(dataDir, 'not a directory');
    try {
      expectSyncCode(
        () => loadOrCreateCredentialKey(keyPath, { platform: 'linux', hasEncryptedRecords: false }),
        'KEY_DATA_DIRECTORY_UNSAFE',
      );
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  test('group/world-writable QFAT data directory is rejected', async () => {
    const parent = mkdtempSync(join(tmpdir(), 'qfat-data-parent-'));
    const dataDir = join(parent, 'qfat-data');
    const keyPath = join(dataDir, 'keys', 'credential.key');
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    chmodSync(dataDir, 0o777);
    try {
      expectSyncCode(
        () => loadOrCreateCredentialKey(keyPath, { platform: 'linux', hasEncryptedRecords: false }),
        'KEY_DATA_DIRECTORY_UNSAFE',
      );
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  test('safe group/world-readable but non-writable data directory is accepted', async () => {
    const parent = mkdtempSync(join(tmpdir(), 'qfat-data-parent-'));
    const dataDir = join(parent, 'qfat-data');
    const keyPath = join(dataDir, 'keys', 'credential.key');
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    chmodSync(dataDir, 0o755);
    try {
      const key = loadOrCreateCredentialKey(keyPath, { platform: 'linux', hasEncryptedRecords: false });
      assert.equal(key.length, 32);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  test('QFAT data directory owned by another OS user is rejected', async () => {
    const parent = mkdtempSync(join(tmpdir(), 'qfat-data-parent-'));
    const dataDir = join(parent, 'qfat-data');
    const keyPath = join(dataDir, 'keys', 'credential.key');
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    const originalGetuid = process.getuid;
    (process as any).getuid = () => (originalGetuid?.() ?? 0) + 1;
    try {
      expectSyncCode(
        () => loadOrCreateCredentialKey(keyPath, { platform: 'linux', hasEncryptedRecords: false }),
        'KEY_DATA_DIRECTORY_UNSAFE',
      );
    } finally {
      (process as any).getuid = originalGetuid;
      rmSync(parent, { recursive: true, force: true });
    }
  });
});

describe('Credential key directory durability', () => {
  test('fsyncs the containing directory after publishing a new key', async () => {
    const f = await openFixture();
    try {
      const calls: string[] = [];
      const provider = new KeyFileCredentialProvider(f.db, {
        keyPath: f.keyPath,
        fsyncDirectory: (dir) => { calls.push(dir); },
      });
      await provider.store(CONTEXT, Buffer.from(DUMMY_TOKEN));
      assert.equal(calls.length, 1);
      assert.equal(calls[0], f.keyDir);
    } finally {
      f.close();
    }
  });

  test('directory fsync failure fails closed and leaves the published key without ciphertext', async () => {
    const f = await openFixture();
    try {
      const provider = new KeyFileCredentialProvider(f.db, {
        keyPath: f.keyPath,
        fsyncDirectory: () => { throw new Error('sync failed'); },
      });
      await expectCode(provider.store(CONTEXT, Buffer.from(DUMMY_TOKEN)), 'KEY_DIRECTORY_SYNC_FAILED');
      assert.equal(existsSync(f.keyPath), true);
      assert.equal(rows(f).length, 0);
    } finally {
      f.close();
    }
  });

  test('existing key load synchronizes the directory before returning bytes', async () => {
    const f = await openFixture();
    try {
      const okProvider = new KeyFileCredentialProvider(f.db, { keyPath: f.keyPath });
      await okProvider.store(CONTEXT, Buffer.from(DUMMY_TOKEN));
      const calls: string[] = [];
      const second = new KeyFileCredentialProvider(f.db, {
        keyPath: f.keyPath,
        fsyncDirectory: (dir) => calls.push(dir),
      });
      assert.deepEqual(await second.retrieve(CONTEXT), Buffer.from(DUMMY_TOKEN));
      assert.equal(calls.length, 1);
      assert.equal(calls[0], f.keyDir);
    } finally {
      f.close();
    }
  });

  test('default directory fsync opens and syncs the key directory', async () => {
    const f = await openFixture();
    try {
      const key = loadOrCreateCredentialKey(f.keyPath, {
        platform: 'linux',
        hasEncryptedRecords: false,
        fsyncDirectory: (dir) => {
          assert.equal(dir, f.keyDir);
          const fd = openSync(dir, constants.O_RDONLY | (constants.O_DIRECTORY ?? 0));
          fsyncSync(fd);
          closeSync(fd);
        },
      });
      assert.equal(key.length, 32);
    } finally {
      f.close();
    }
  });
});

describe('Credential key durability invariant (QFAT-013R2)', () => {
  test('existing key read fsyncs the containing directory before returning bytes', async () => {
    const f = await openFixture();
    try {
      const creator = new KeyFileCredentialProvider(f.db, { keyPath: f.keyPath });
      await creator.store(CONTEXT, Buffer.from(DUMMY_TOKEN));

      const calls: string[] = [];
      const key = loadOrCreateCredentialKey(f.keyPath, {
        platform: 'linux',
        hasEncryptedRecords: true,
        fsyncDirectory: (dir) => { calls.push(dir); },
      });
      assert.equal(key.length, 32);
      assert.equal(calls.length, 1);
      assert.equal(calls[0], f.keyDir);
    } finally {
      f.close();
    }
  });

  test('EEXIST loser validates the winner key and fsyncs before returning it', async () => {
    const f = await openFixture();
    try {
      const competingKey = randomBytes(32);
      const fsyncCalls: string[] = [];
      const key = loadOrCreateCredentialKey(f.keyPath, {
        platform: 'linux',
        hasEncryptedRecords: false,
        fsyncDirectory: (dir) => { fsyncCalls.push(dir); },
        linkFile: (temporaryPath, finalPath) => {
          // Simulate another initializer winning the atomic publication just
          // before this initializer's link(). The real linkSync must therefore
          // raise EEXIST and execute the production loser branch.
          writeFileSync(finalPath, competingKey, { mode: 0o600 });
          chmodSync(finalPath, 0o600);
          linkSync(temporaryPath, finalPath);
        },
      });

      assert.deepEqual(key, competingKey, 'loser must return the already-published winner key');
      assert.deepEqual(readFileSync(f.keyPath), competingKey);
      assert.deepEqual(fsyncCalls, [f.keyDir], 'EEXIST loser must synchronize the containing directory');
    } finally {
      f.close();
    }
  });

  test('EEXIST loser fails closed on fsync failure and commits no ciphertext', async () => {
    const f = await openFixture();
    try {
      const competingKey = randomBytes(32);
      const provider = new KeyFileCredentialProvider(f.db, {
        keyPath: f.keyPath,
        fsyncDirectory: () => { throw new Error('EEXIST loser fsync failed'); },
        linkFile: (temporaryPath, finalPath) => {
          // Publish a valid competing key immediately before the real link.
          // The real linkSync must raise EEXIST and enter the loser branch.
          writeFileSync(finalPath, competingKey, { mode: 0o600 });
          chmodSync(finalPath, 0o600);
          linkSync(temporaryPath, finalPath);
        },
      });

      await expectCode(
        provider.store(CONTEXT, Buffer.from(DUMMY_TOKEN)),
        'KEY_DIRECTORY_SYNC_FAILED',
      );
      assert.deepEqual(readFileSync(f.keyPath), competingKey);
      assert.equal(rows(f).length, 0, 'failed EEXIST loser must not persist ciphertext');
    } finally {
      f.close();
    }
  });

  test('creator path fails closed when directory fsync fails and commits no ciphertext', async () => {
    const f = await openFixture();
    try {
      const provider = new KeyFileCredentialProvider(f.db, {
        keyPath: f.keyPath,
        fsyncDirectory: () => { throw new Error('sync failed'); },
      });
      await expectCode(provider.store(CONTEXT, Buffer.from(DUMMY_TOKEN)), 'KEY_DIRECTORY_SYNC_FAILED');
      assert.equal(existsSync(f.keyPath), true);
      assert.equal(rows(f).length, 0);
    } finally {
      f.close();
    }
  });

  test('existing key read fails closed when directory fsync fails', async () => {
    const f = await openFixture();
    try {
      const creator = new KeyFileCredentialProvider(f.db, { keyPath: f.keyPath });
      await creator.store(CONTEXT, Buffer.from(DUMMY_TOKEN));

      expectSyncCode(
        () => loadOrCreateCredentialKey(f.keyPath, {
          platform: 'linux',
          hasEncryptedRecords: true,
          fsyncDirectory: () => { throw new Error('sync failed'); },
        }),
        'KEY_DIRECTORY_SYNC_FAILED',
      );
    } finally {
      f.close();
    }
  });

  test('competing reader fails closed when its own fsync fails while creator is paused', async () => {
    const f = await openFixture();
    const children: ReturnType<typeof spawn>[] = [];
    try {
      const tsxCli = resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs');
      const publishedPath = join(f.dir, 'published.marker');
      const releasePath = join(f.dir, 'release.marker');
      const creatorDone = join(f.dir, 'creator.done');
      const creatorOut = join(f.dir, 'creator.hex');

      const creatorScript = join(f.dir, 'creator.ts');
      writeFileSync(creatorScript, `
import { existsSync, writeFileSync } from 'node:fs';
import { openSync, fsyncSync, closeSync, constants } from 'node:fs';
import { loadOrCreateCredentialKey } from ${JSON.stringify(resolve(process.cwd(), 'src/credentials/key-file.js'))};

const [keyPath, publishedPath, releasePath, donePath, outPath] = process.argv.slice(2);

function fsyncDirectory(dir: string) {
  // The marker is emitted only after link() published the final key path.
  writeFileSync(publishedPath, 'published');
  while (!existsSync(releasePath)) {
    // Hold the creator between publication and its directory fsync.
  }
  const fd = openSync(dir, constants.O_RDONLY | (constants.O_DIRECTORY ?? 0));
  try { fsyncSync(fd); } finally { closeSync(fd); }
}

const key = loadOrCreateCredentialKey(keyPath, { platform: 'linux', hasEncryptedRecords: false, fsyncDirectory });
writeFileSync(outPath, key.toString('hex'));
writeFileSync(donePath, 'done');
`);

      const creator = spawn(
        process.execPath,
        [tsxCli, creatorScript, f.keyPath, publishedPath, releasePath, creatorDone, creatorOut],
        { stdio: ['ignore', 'ignore', 'pipe'] },
      );
      children.push(creator);
      let stderr = '';
      creator.stderr?.on('data', (chunk) => { stderr += String(chunk); });

      const waitForFile = async (path: string, timeoutMs: number) => {
        const deadline = Date.now() + timeoutMs;
        while (!existsSync(path)) {
          if (Date.now() > deadline) throw new Error(`timed out waiting for ${path}: ${stderr}`);
          await new Promise((resolveWait) => setTimeout(resolveWait, 5));
        }
      };

      await waitForFile(publishedPath, 10_000);
      assert.equal(existsSync(creatorDone), false, 'creator must still be paused before its fsync');

      // This provider is a separate process-equivalent reader. Its own fsync
      // fails while the creator is still paused, so it must not persist a row.
      const competingReader = new KeyFileCredentialProvider(f.db, {
        keyPath: f.keyPath,
        fsyncDirectory: () => { throw new Error('competing reader fsync failed'); },
      });
      await expectCode(
        competingReader.store(CONTEXT, Buffer.from(DUMMY_TOKEN)),
        'KEY_DIRECTORY_SYNC_FAILED',
      );
      assert.equal(rows(f).length, 0, 'failed competing reader must not persist ciphertext');
      assert.equal(existsSync(creatorDone), false, 'creator must remain paused during reader failure');

      writeFileSync(releasePath, 'go');
      await waitForFile(creatorDone, 10_000);
      assert.equal(readFileSync(creatorOut, 'utf8').length, 64);
      assert.equal(readFileSync(f.keyPath).length, 32);
    } finally {
      for (const child of children) {
        if (child.exitCode === null) child.kill('SIGKILL');
      }
      f.close();
    }
  });

  test('concurrent initialization records a directory fsync for every initializer', async () => {
    const f = await openFixture();
    const children: ReturnType<typeof spawn>[] = [];
    try {
      const tsxCli = resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs');
      const barrierPath = join(f.dir, 'start.barrier');
      const ready1 = join(f.dir, 'ready-1');
      const ready2 = join(f.dir, 'ready-2');
      const out1 = join(f.dir, 'key-1.hex');
      const out2 = join(f.dir, 'key-2.hex');
      const logPath = join(f.dir, 'fsync-all.log');

      const scriptPath = join(f.dir, 'init-key.ts');
      writeFileSync(scriptPath, `
import { existsSync, writeFileSync, appendFileSync } from 'node:fs';
import { openSync, fsyncSync, closeSync, constants } from 'node:fs';
import { loadOrCreateCredentialKey } from ${JSON.stringify(resolve(process.cwd(), 'src/credentials/key-file.js'))};

async function main() {
  const [keyPath, barrier, ready, out, logPath] = process.argv.slice(2);
  writeFileSync(ready, 'ready');
  while (!existsSync(barrier)) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 2));
  }
  const key = loadOrCreateCredentialKey(keyPath, {
    platform: 'linux',
    hasEncryptedRecords: false,
    fsyncDirectory: (dir) => {
      const fd = openSync(dir, constants.O_RDONLY | (constants.O_DIRECTORY ?? 0));
      fsyncSync(fd);
      closeSync(fd);
      appendFileSync(logPath, 'fsync\\n');
    },
  });
  writeFileSync(out, key.toString('hex'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
`);

      const startChild = (ready: string, out: string) => {
        const child = spawn(process.execPath, [tsxCli, scriptPath, f.keyPath, barrierPath, ready, out, logPath], { stdio: ['ignore', 'ignore', 'pipe'] });
        children.push(child);
        return child;
      };
      const child1 = startChild(ready1, out1);
      const child2 = startChild(ready2, out2);
      let stderr = '';
      child1.stderr?.on('data', (chunk) => { stderr += String(chunk); });
      child2.stderr?.on('data', (chunk) => { stderr += String(chunk); });

      const waitFor = async (predicate: () => boolean, timeoutMs: number) => {
        const deadline = Date.now() + timeoutMs;
        while (!predicate()) {
          if (Date.now() > deadline) throw new Error('timed out waiting for child process readiness');
          await new Promise((resolveWait) => setTimeout(resolveWait, 5));
        }
      };
      await waitFor(() => existsSync(ready1) && existsSync(ready2), 10_000);
      writeFileSync(barrierPath, 'go');

      const exitCode = (child: ReturnType<typeof spawn>) => new Promise<number>((resolveExit, rejectExit) => {
        child.once('error', rejectExit);
        child.once('exit', (code) => resolveExit(code ?? 1));
      });
      const [code1, code2] = await Promise.all([exitCode(child1), exitCode(child2)]);
      assert.equal(code1, 0, `first child failed: ${stderr}`);
      assert.equal(code2, 0, `second child failed: ${stderr}`);

      assert.equal(readFileSync(out1, 'utf8'), readFileSync(out2, 'utf8'));
      // Each initializer synchronizes the directory at least once, including the
      // loser of the creation race through its EEXIST path.
      const fsyncCount = readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean).length;
      assert.ok(fsyncCount >= 2, `expected at least two directory fsyncs, got ${fsyncCount}`);
    } finally {
      for (const child of children) {
        if (child.exitCode === null) child.kill('SIGKILL');
      }
      f.close();
    }
  });
});
