const fs = require('node:fs/promises');
const path = require('node:path');
const { storageDir } = require('../config');

const documents = new Map();

function save(document) {
  documents.set(document.id, { ...document });
}

function findByOwner(owner) {
  return Array.from(documents.values())
    .filter((document) => document.owner === owner)
    .map((document) => ({ ...document }));
}

function findById(id) {
  const document = documents.get(id);
  return document ? { ...document } : undefined;
}

function prepareStorage() {
  return fs.mkdir(storageDir, { recursive: true });
}

function getFilePath(storageName) {
  return path.join(storageDir, storageName);
}

function removeFile(storageName) {
  return fs.unlink(getFilePath(storageName));
}

module.exports = {
  save,
  findByOwner,
  findById,
  prepareStorage,
  getFilePath,
  removeFile,
};
