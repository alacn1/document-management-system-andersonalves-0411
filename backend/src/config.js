const path = require('node:path');

const uploadMaxBytes = Number(process.env.UPLOAD_MAX_BYTES || 10485760);

if (!Number.isSafeInteger(uploadMaxBytes) || uploadMaxBytes <= 0) {
  throw new Error('UPLOAD_MAX_BYTES deve ser um inteiro positivo.');
}

module.exports = {
  storageDir: path.resolve(__dirname, '..', process.env.STORAGE_DIR || 'storage'),
  uploadMaxBytes,
};
