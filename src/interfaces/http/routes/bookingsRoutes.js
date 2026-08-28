const express = require('express');
const bookingsController = require('../controllers/bookingsController');
const authMiddleware = require('../middlewares/authMiddleware');
const requireCustomer = require('../middlewares/requireCustomer');

const router = express.Router();

router.post('/', authMiddleware, requireCustomer, bookingsController.create);
router.get('/', authMiddleware, requireCustomer, bookingsController.listMine);
router.get('/:id', authMiddleware, bookingsController.getById);

module.exports = router;
