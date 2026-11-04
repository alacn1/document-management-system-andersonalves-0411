const { randomUUID } = require('node:crypto');
const multer = require('multer');
const service = require('../services/documents.service');
const { storageDir, uploadMaxBytes } = require('../config');

const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, callback) {
      service.prepareStorage().then(
        () => callback(null, storageDir),
        (error) => callback(error),
      );
    },
    filename(req, file, callback) {
      callback(null, randomUUID());
    },
  }),
  // O parser rejeita ao atingir o limite; um byte extra torna o máximo inclusivo.
  limits: { fileSize: uploadMaxBytes + 1, files: 1 },
}).single('file');

const errors = {
  USER_ID_REQUIRED: [400, 'Informe o cabeçalho X-User-Id.'],
  FILE_REQUIRED: [400, 'Envie um arquivo não vazio no campo file.'],
  FILE_TOO_LARGE: [413, 'O arquivo excede o limite de upload permitido.'],
  INVALID_MULTIPART: [400, 'Envie somente um arquivo no campo file em um formulário multipart válido.'],
  INVALID_DOCUMENT_ID: [400, 'Informe um identificador UUID v4 válido.'],
  DOCUMENT_NOT_FOUND: [404, 'Documento não encontrado.'],
  UPLOAD_FAILED: [500, 'Não foi possível salvar o documento.'],
  DOCUMENT_LIST_FAILED: [500, 'Não foi possível listar os documentos.'],
  DOWNLOAD_FAILED: [500, 'Não foi possível baixar o documento.'],
};

function requireUser(req, res, next) {
  const owner = req.get('X-User-Id')?.trim();
  if (!owner) {
    return next(Object.assign(new Error(errors.USER_ID_REQUIRED[1]), {
      code: 'USER_ID_REQUIRED',
    }));
  }
  res.locals.owner = owner;
  next();
}

function uploadDocument(req, res, next) {
  upload(req, res, (error) => {
    if (error) {
      if (error instanceof multer.MulterError) {
        error.code = error.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'INVALID_MULTIPART';
      } else if (/^(Multipart:|Unexpected end of (form|file)|Malformed part header)/.test(error.message)) {
        error.code = 'INVALID_MULTIPART';
      }
      return next(error);
    }

    service.createDocument(req.file, res.locals.owner)
      .then((document) => res.status(201).json(document))
      .catch(next);
  });
}

async function listDocuments(req, res) {
  const documents = await service.listDocuments(res.locals.owner);
  res.json({ documents });
}

async function downloadDocument(req, res, next) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) {
    return next(Object.assign(new Error(errors.INVALID_DOCUMENT_ID[1]), {
      code: 'INVALID_DOCUMENT_ID',
    }));
  }

  const document = await service.getDownload(req.params.id.toLowerCase(), res.locals.owner);
  res.download(document.path, document.originalName, {
    headers: { 'Content-Type': 'application/octet-stream' },
    dotfiles: 'allow',
  }, (error) => {
    if (error) {
      if (error.code === 'ENOENT' || error.status === 404) {
        error.code = 'DOCUMENT_NOT_FOUND';
      }
      next(error);
    }
  });
}

function handleError(error, req, res, next) {
  let code = error.code;
  if (!Object.hasOwn(errors, code)) {
    if (req.route?.path === '/upload') {
      code = 'UPLOAD_FAILED';
    } else if (req.route?.path === '/documents') {
      code = 'DOCUMENT_LIST_FAILED';
    } else {
      code = 'DOWNLOAD_FAILED';
    }
  }

  const [status, message] = errors[code];
  if (status === 500 || res.headersSent) {
    console.error(message, error);
  }
  if (res.headersSent) {
    return next(error);
  }
  res.status(status).json({ error: { code, message } });
}

module.exports = {
  requireUser,
  uploadDocument,
  listDocuments,
  downloadDocument,
  handleError,
};
