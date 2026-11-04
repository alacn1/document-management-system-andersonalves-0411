const express = require('express');
const controller = require('../controllers/documents.controller');

const router = express.Router();

router.post('/upload', controller.requireUser, controller.uploadDocument);
router.get('/documents', controller.requireUser, controller.listDocuments);
router.get('/documents/:id/download', controller.requireUser, controller.downloadDocument);
router.use(controller.handleError);

module.exports = router;
