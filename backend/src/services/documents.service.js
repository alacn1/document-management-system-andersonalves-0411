const { randomUUID } = require('node:crypto');
const repository = require('../repositories/documents.repository');
const { uploadMaxBytes } = require('../config');
const fileRequiredMessage = 'Envie um arquivo não vazio no campo file.';

function serviceError(code, message) {
  return Object.assign(new Error(message), { code });
}

function fileRequiredError() {
  return serviceError('FILE_REQUIRED', fileRequiredMessage);
}

function publicDocument({ id, originalName, size, uploadedAt, owner }) {
  return { id, originalName, size, uploadedAt, owner };
}

function requireFile(file) {
  if (!file) {
    throw fileRequiredError();
  }
}

function validateFile(file) {
  if (file.size === 0) {
    throw fileRequiredError();
  }
  if (file.size > uploadMaxBytes) {
    throw serviceError('FILE_TOO_LARGE', 'O arquivo excede o limite de upload permitido.');
  }
}

function createDocumentMetadata(file, owner) {
  return {
    id: randomUUID(),
    originalName: file.originalname,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    owner,
    storageName: file.filename,
  };
}

async function removeRejectedUpload(file) {
  try {
    await repository.removeFile(file.filename);
  } catch (cleanupError) {
    console.error('Falha ao remover arquivo após upload rejeitado.', cleanupError);
  }
}

async function createDocument(file, owner) {
  requireFile(file);

  try {
    validateFile(file);
    const document = createDocumentMetadata(file, owner);
    await repository.save(document);
    return publicDocument(document);
  } catch (error) {
    await removeRejectedUpload(file);
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
    throw serviceError('DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
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
