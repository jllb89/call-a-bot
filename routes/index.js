const express = require('express');
const { handleWhatsAppMessage } = require('../controllers/whatsappController');
const webhookHandler = require('../webhook');
const router = express.Router();

router.post('/whatsapp', handleWhatsAppMessage);
router.post('/webhook', webhookHandler);

module.exports = router;
