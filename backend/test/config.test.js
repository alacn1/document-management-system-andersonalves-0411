const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

function loadConfig(overrides) {
  const env = { ...process.env };
  delete env.STORAGE_DIR;
  delete env.UPLOAD_MAX_BYTES;
  return spawnSync(process.execPath, [
    '-e',
    `console.log(JSON.stringify(require(${JSON.stringify(require.resolve('../src/config'))})))`,
  ], {
    env: { ...env, ...overrides },
    cwd: path.parse(__dirname).root,
    encoding: 'utf8',
  });
}

test('configuração padrão é independente do diretório de execução', () => {
  const result = loadConfig({});
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    storageDir: path.resolve(__dirname, '../storage'),
    uploadMaxBytes: 10485760,
  });
});

test('aceita armazenamento relativo ao backend e limite customizado', () => {
  const result = loadConfig({ STORAGE_DIR: 'storage/teste', UPLOAD_MAX_BYTES: '512' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    storageDir: path.resolve(__dirname, '../storage/teste'),
    uploadMaxBytes: 512,
  });
});

test('aceita armazenamento absoluto', () => {
  const storageDir = path.resolve(__dirname, 'storage');
  const result = loadConfig({ STORAGE_DIR: storageDir });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).storageDir, storageDir);
});

test('rejeita limites inválidos explicitamente na inicialização', () => {
  for (const value of ['0', '-1', 'abc', '1.5', 'Infinity', '9007199254740992']) {
    const result = loadConfig({ UPLOAD_MAX_BYTES: value });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /UPLOAD_MAX_BYTES deve ser um inteiro positivo/);
  }
});
