const express = require('express');
const router = express.Router();
const RecyclingService = require('../services/recyclingService');

router.post('/verify', async (req, res) => {
  try {
    const result = await RecyclingService.verifyAndRecycle(req.body);
    res.status(201).json({
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

router.post('/inspect', async (req, res) => {
  try {
    const result = await RecyclingService.qualityInspect(req.body);
    res.status(201).json({
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

router.get('/:recordId', async (req, res) => {
  try {
    const { recordId } = req.params;
    const result = await RecyclingService.getRecyclingRecord(recordId);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
