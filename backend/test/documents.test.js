const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { mkdtempSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');

const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'dms-test-'));
process.env.STORAGE_DIR = path.join(temporaryDirectory, 'storage');
delete process.env.UPLOAD_MAX_BYTES;

const app = require('../src/app');
const repository = require('../src/repositories/documents.repository');
const { storageDir, uploadMaxBytes } = require('../src/config');

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
});

function request(route, owner, options = {}) {
  return fetch(`${baseUrl}${route}`, {
    ...options,
    headers: {
      ...(owner === undefined ? {} : { 'X-User-Id': owner }),
      ...options.headers,
    },
  });
}

function upload(owner, content = 'Conteúdo do documento', name = 'relatorio.txt', fields = {}) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    body.append(key, value);
  }
  body.append('file', new Blob([content]), name);
  return request('/upload', owner, { method: 'POST', body });
}

async function expectError(response, status, code) {
  assert.equal(response.status, status);
  assert.match(response.headers.get('content-type'), /application\/json/);
  const body = await response.json();
  assert.deepEqual(Object.keys(body), ['error']);
  assert.deepEqual(Object.keys(body.error).sort(), ['code', 'message']);
  assert.equal(body.error.code, code);
  assert.equal(typeof body.error.message, 'string');
  assert.ok(body.error.message.length > 0);
  assert.ok(!JSON.stringify(body).includes(storageDir));
  return body;
}

test('preserva a rota de saúde', async () => {
  const response = await request('/health');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('cria o diretório e grava bytes com metadados públicos gerados pelo servidor', async () => {
  const owner = randomUUID();
  const content = Buffer.from([0, 1, 2, 128, 255]);
  const response = await upload(owner, content, 'relatorio.bin', {
    id: 'id-forjado',
    owner: 'outro-usuario',
    uploadedAt: 'ontem',
    storageName: '../../arquivo',
  });
  assert.equal(response.status, 201);
  const document = await response.json();
  assert.deepEqual(Object.keys(document).sort(), ['id', 'originalName', 'owner', 'size', 'uploadedAt']);
  assert.match(document.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(document.originalName, 'relatorio.bin');
  assert.equal(document.owner, owner);
  assert.equal(document.size, content.length);
  assert.equal(new Date(document.uploadedAt).toISOString(), document.uploadedAt);

  const stored = repository.findById(document.id);
  assert.notEqual(stored.storageName, document.originalName);
  assert.notEqual(stored.storageName, document.id);
  assert.deepEqual(await fs.readFile(repository.getFilePath(stored.storageName)), content);
});

test('lista somente documentos do proprietário e aceita nomes repetidos', async () => {
  const owner = randomUUID();
  const first = await (await upload(owner)).json();
  const second = await (await upload(owner)).json();
  assert.notEqual(first.id, second.id);
  assert.notEqual(repository.findById(first.id).storageName, repository.findById(second.id).storageName);
  const response = await request('/documents', owner);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { documents: [first, second] });
  const emptyResponse = await request('/documents', randomUUID());
  assert.deepEqual(await emptyResponse.json(), { documents: [] });
});

test('faz download dos bytes originais com nome seguro e tipo binário', async () => {
  const owner = randomUUID();
  const bytes = Buffer.from([0, 255, 10, 13, 128]);
  const document = await (await upload(owner, bytes, 'relatorio.txt')).json();
  const response = await request(`/documents/${document.id.toUpperCase()}/download`, owner);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/octet-stream');
  assert.equal(response.headers.get('content-length'), String(bytes.length));
  assert.match(response.headers.get('content-disposition'), /^attachment; filename="relatorio.txt"/);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
});

test('nega download de outro usuário, id inexistente e arquivo removido com o mesmo erro', async () => {
  const owner = randomUUID();
  const document = await (await upload(owner)).json();
  const otherOwner = await expectError(
    await request(`/documents/${document.id}/download`, randomUUID()),
    404, 'DOCUMENT_NOT_FOUND',
  );
  const missingId = await expectError(
    await request(`/documents/${randomUUID()}/download`, owner),
    404, 'DOCUMENT_NOT_FOUND',
  );
  await repository.removeFile(repository.findById(document.id).storageName);
  const missingFile = await expectError(
    await request(`/documents/${document.id}/download`, owner),
    404, 'DOCUMENT_NOT_FOUND',
  );
  assert.deepEqual(otherOwner, missingId);
  assert.deepEqual(otherOwner, missingFile);
});

test('valida o usuário antes de gravar uploads e exige usuário em todas as rotas', async () => {
  const filesBefore = await fs.readdir(storageDir);
  for (const owner of [undefined, '   ']) {
    await expectError(await upload(owner), 400, 'USER_ID_REQUIRED');
    await expectError(await request('/documents', owner), 400, 'USER_ID_REQUIRED');
    await expectError(
      await request(`/documents/${randomUUID()}/download`, owner),
      400, 'USER_ID_REQUIRED',
    );
  }
  assert.deepEqual(await fs.readdir(storageDir), filesBefore);
});

test('rejeita identificadores fora do formato UUID v4', async () => {
  for (const id of ['invalido', '00000000-0000-1000-8000-000000000000']) {
    await expectError(await request(`/documents/${id}/download`, 'user'), 400, 'INVALID_DOCUMENT_ID');
  }
});

test('rejeita arquivo ausente ou vazio e remove o arquivo vazio', async () => {
  const filesBefore = await fs.readdir(storageDir);
  await expectError(await request('/upload', 'user', { method: 'POST' }), 400, 'FILE_REQUIRED');
  await expectError(
    await request('/upload', 'user', { method: 'POST', body: new FormData() }),
    400, 'FILE_REQUIRED',
  );
  await expectError(await upload('user', ''), 400, 'FILE_REQUIRED');
  assert.deepEqual(await fs.readdir(storageDir), filesBefore);
});

test('aceita exatamente 10 MiB e rejeita um byte acima sem deixar arquivo parcial', async () => {
  assert.equal(uploadMaxBytes, 10485760);
  const owner = randomUUID();
  const accepted = await upload(owner, Buffer.alloc(uploadMaxBytes));
  assert.equal(accepted.status, 201);
  const document = await accepted.json();
  assert.equal(document.size, uploadMaxBytes);
  assert.equal((await fs.stat(repository.getFilePath(repository.findById(document.id).storageName))).size, uploadMaxBytes);

  const filesBefore = await fs.readdir(storageDir);
  await expectError(await upload(owner, Buffer.alloc(uploadMaxBytes + 1)), 413, 'FILE_TOO_LARGE');
  assert.deepEqual(await fs.readdir(storageDir), filesBefore);
});

test('rejeita campo incorreto, múltiplos arquivos e multipart malformado', async () => {
  const filesBefore = await fs.readdir(storageDir);
  const wrongField = new FormData();
  wrongField.append('document', new Blob(['texto']), 'arquivo.txt');
  const multipleFiles = new FormData();
  multipleFiles.append('file', new Blob(['primeiro']), 'arquivo.txt');
  multipleFiles.append('file', new Blob(['segundo']), 'arquivo.txt');
  for (const body of [wrongField, multipleFiles]) {
    await expectError(await request('/upload', 'user', { method: 'POST', body }), 400, 'INVALID_MULTIPART');
  }
  await expectError(await request('/upload', 'user', {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data' },
    body: 'inválido',
  }), 400, 'INVALID_MULTIPART');
  await expectError(await request('/upload', 'user', {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data; boundary=teste' },
    body: '--teste\r\nContent-Disposition: form-data; name="file"; filename="a.txt"\r\n\r\nincompleto',
  }), 400, 'INVALID_MULTIPART');
  assert.deepEqual(await fs.readdir(storageDir), filesBefore);
});

test('remove o arquivo se a gravação dos metadados falhar e registra o erro', async (t) => {
  const filesBefore = await fs.readdir(storageDir);
  t.mock.method(repository, 'save', () => { throw new Error('Falha simulada de persistência'); });
  const log = t.mock.method(console, 'error', () => {});
  await expectError(await upload('user'), 500, 'UPLOAD_FAILED');
  assert.deepEqual(await fs.readdir(storageDir), filesBefore);
  assert.equal(log.mock.callCount(), 1);
});

test('registra falhas na limpeza sem mascarar a falha original', async (t) => {
  const filesBefore = new Set(await fs.readdir(storageDir));
  const persistenceError = new Error('Falha de persistência');
  t.mock.method(repository, 'save', () => { throw persistenceError; });
  t.mock.method(repository, 'removeFile', async () => { throw new Error('Falha de limpeza'); });
  const log = t.mock.method(console, 'error', () => {});
  await expectError(await upload('user'), 500, 'UPLOAD_FAILED');
  assert.equal(log.mock.callCount(), 2);
  assert.match(log.mock.calls[0].arguments[0], /remover arquivo/);
  assert.equal(log.mock.calls[1].arguments[1], persistenceError);
  for (const name of await fs.readdir(storageDir)) {
    if (!filesBefore.has(name)) {
      await fs.unlink(path.join(storageDir, name));
    }
  }
});

test('expõe erros estruturados e registra falhas inesperadas sem vazar detalhes', async (t) => {
  const log = t.mock.method(console, 'error', () => {});
  t.mock.method(repository, 'findByOwner', () => { throw new Error(storageDir); });
  await expectError(await request('/documents', 'user'), 500, 'DOCUMENT_LIST_FAILED');
  t.mock.method(repository, 'findById', () => { throw new Error(storageDir); });
  await expectError(await request(`/documents/${randomUUID()}/download`, 'user'), 500, 'DOWNLOAD_FAILED');
  assert.equal(log.mock.callCount(), 2);
});

test('trata falhas ao preparar o armazenamento', async (t) => {
  const service = require('../src/services/documents.service');
  t.mock.method(service, 'prepareStorage', async () => { throw new Error('Sem permissão'); });
  const log = t.mock.method(console, 'error', () => {});
  const filesBefore = await fs.readdir(storageDir);
  await expectError(await upload('user'), 500, 'UPLOAD_FAILED');
  assert.deepEqual(await fs.readdir(storageDir), filesBefore);
  assert.equal(log.mock.callCount(), 1);
});
