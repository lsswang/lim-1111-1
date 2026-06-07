const express = require('express');
const router = express.Router();
const DeliveryService = require('../services/deliveryService');

router.post('/dispatch', async (req, res) => {
  try {
    const result = await DeliveryService.createDeliveryOrder(req.body);
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

router.post('/temperature/:deliveryNo', async (req, res) => {
  try {
    const { deliveryNo } = req.params;
    const result = await DeliveryService.reportTemperature(deliveryNo);
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

router.get('/:deliveryNo', async (req, res) => {
  try {
    const { deliveryNo } = req.params;
    const result = await DeliveryService.getDeliveryOrder(deliveryNo);
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
