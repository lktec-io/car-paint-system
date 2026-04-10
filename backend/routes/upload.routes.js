const express = require('express');
const router = express.Router();
const { uploadImage } = require('../controllers/upload.controller');
const authenticate = require('../middleware/authenticate');
const upload = require('../middleware/upload');

router.post('/', authenticate, upload.single('image'), uploadImage);

module.exports = router;
