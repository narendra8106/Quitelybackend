const express = require('express');
const router = express.Router();
const {
  getBlockedItems,
  getSummary,
  getCoordinatedThreats,
  deleteBlockedItem,
  reportSpam,
  markSafe,
} = require('../controllers/itemsController');

router.get('/blocked-items/summary', getSummary);
router.get('/blocked-items/coordinated', getCoordinatedThreats);
router.get('/blocked-items', getBlockedItems);
router.delete('/blocked-items/:id', deleteBlockedItem);
router.patch('/blocked-items/:id/mark-safe', markSafe);
router.post('/report-spam', reportSpam);

module.exports = router;
