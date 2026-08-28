const express = require('express');
const carsController = require('../controllers/carsController');
const authMiddleware = require('../middlewares/authMiddleware');
const requireAdmin = require('../middlewares/requireAdmin');

const router = express.Router();

router.delete('/cars/:id', authMiddleware, requireAdmin, carsController.remove);

module.exports = router;
