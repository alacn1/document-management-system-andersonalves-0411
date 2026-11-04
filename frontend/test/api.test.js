import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { downloadDocument, listDocuments, uploadDocument } from '../src/services/api.js';

afterEach(() => mock.restoreAll());

test('lista documentos via /api com proprietário e sinal de cancelamento', async () => {
  const documents = [{ id: 'document-1', originalName: 'relatorio.pdf' }];
  const fetchMock = mock.method(globalThis, 'fetch', async () => Response.json({ documents }));
  const { signal } = new AbortController();

  assert.deepEqual(await listDocuments('demo', signal), documents);
  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, '/api/documents');
  assert.equal(options.headers['X-User-Id'], 'demo');
  assert.equal(options.signal, signal);
});

test('envia um arquivo no campo file sem definir o boundary manualmente', async () => {
  const document = { id: 'document-1', originalName: 'relatorio.txt' };
  const fetchMock = mock.method(globalThis, 'fetch', async () => Response.json(document, { status: 201 }));
  const file = new File(['conteúdo'], 'relatorio.txt', { type: 'text/plain' });

  assert.deepEqual(await uploadDocument(file, 'demo'), document);
  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, '/api/upload');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers['X-User-Id'], 'demo');
  assert.equal(options.headers['Content-Type'], undefined);
  assert.ok(options.body instanceof FormData);
  assert.deepEqual([...options.body.keys()], ['file']);
  assert.equal(options.body.get('file').name, file.name);
  assert.equal(await options.body.get('file').text(), 'conteúdo');
});

test('baixa os bytes via fetch com proprietário e identificador codificado', async () => {
  const bytes = new Uint8Array([0, 1, 128, 255]);
  const fetchMock = mock.method(globalThis, 'fetch', async () => new Response(bytes));

  const blob = await downloadDocument('id/especial', 'demo');
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), bytes);
  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, '/api/documents/id%2Fespecial/download');
  assert.equal(options.headers['X-User-Id'], 'demo');
});

test('expõe erros estruturados do backend em todas as operações', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({
    error: { code: 'USER_ID_REQUIRED', message: 'Informe o cabeçalho X-User-Id.' },
  }, { status: 400 }));

  for (const operation of [
    () => listDocuments(''),
    () => uploadDocument(new File(['x'], 'arquivo.txt'), ''),
    () => downloadDocument('document-1', ''),
  ]) {
    await assert.rejects(operation, { message: 'Informe o cabeçalho X-User-Id.' });
  }
});

test('informa falhas HTTP sem JSON, incluindo erros do proxy', async () => {
  mock.method(globalThis, 'fetch', async () => new Response('Bad Gateway', { status: 502 }));
  await assert.rejects(listDocuments('demo'), /HTTP 502/);
});

test('informa falhas de conexão em português e preserva a causa', async () => {
  const cause = new TypeError('Failed to fetch');
  mock.method(globalThis, 'fetch', async () => { throw cause; });
  await assert.rejects(listDocuments('demo'), {
    message: 'Não foi possível conectar ao servidor.',
    cause,
  });
});

test('preserva o cancelamento para não apresentar erros após desmontagem', async () => {
  const { signal } = new AbortController();
  const error = new DOMException('Aborted', 'AbortError');
  mock.method(globalThis, 'fetch', async () => { throw error; });
  await assert.rejects(listDocuments('demo', signal), { name: 'AbortError' });
});
