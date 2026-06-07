const express = require('express');
const router = express.Router();
const RecyclingService = require('../services/recyclingService');

router.get('/', async (req, res) => {
  try {
    const { storeId } = req.query;
    const result = await RecyclingService.getInventory(storeId || null);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
