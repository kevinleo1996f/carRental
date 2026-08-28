const express = require('express');
const carsController = require('../controllers/carsController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/', authMiddleware, carsController.list);
router.get('/:id', authMiddleware, carsController.getById);

module.exports = router;
