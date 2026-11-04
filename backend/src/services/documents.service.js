const { randomUUID } = require('node:crypto');
const repository = require('../repositories/documents.repository');
const { uploadMaxBytes } = require('../config');

function publicDocument({ id, originalName, size, uploadedAt, owner }) {
  return { id, originalName, size, uploadedAt, owner };
}

async function createDocument(file, owner) {
  if (!file) {
    throw Object.assign(new Error('Envie um arquivo não vazio no campo file.'), {
      code: 'FILE_REQUIRED',
    });
  }

  try {
    if (file.size === 0) {
      throw Object.assign(new Error('Envie um arquivo não vazio no campo file.'), {
        code: 'FILE_REQUIRED',
      });
    }
    if (file.size > uploadMaxBytes) {
      throw Object.assign(new Error('O arquivo excede o limite de upload permitido.'), {
        code: 'FILE_TOO_LARGE',
      });
    }

    const document = {
      id: randomUUID(),
      originalName: file.originalname,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      owner,
      storageName: file.filename,
    };

    await repository.save(document);
    return publicDocument(document);
  } catch (error) {
    try {
      await repository.removeFile(file.filename);
    } catch (cleanupError) {
      console.error('Falha ao remover arquivo após upload rejeitado.', cleanupError);
    }
    throw error;
  }
}

async function listDocuments(owner) {
  const documents = await repository.findByOwner(owner);
  return documents.map(publicDocument);
}

async function getDownload(id, owner) {
  const document = await repository.findById(id);
  if (!document || document.owner !== owner) {
    throw Object.assign(new Error('Documento não encontrado.'), {
      code: 'DOCUMENT_NOT_FOUND',
    });
  }

  return {
    originalName: document.originalName,
    path: repository.getFilePath(document.storageName),
  };
}

module.exports = {
  createDocument,
  listDocuments,
  getDownload,
  prepareStorage: repository.prepareStorage,
};
