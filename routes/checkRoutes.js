const express = require('express');
const router = express.Router();
const { checkCall, checkSms, checkEmail } = require('../controllers/checkController');

router.post('/check-call', checkCall);
router.post('/check-sms', checkSms);
router.post('/check-email', checkEmail);

module.exports = router;
