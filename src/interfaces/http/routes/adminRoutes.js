const express = require('express');
const carsController = require('../controllers/carsController');
const bookingsController = require('../controllers/bookingsController');
const authMiddleware = require('../middlewares/authMiddleware');
const requireAdmin = require('../middlewares/requireAdmin');

const router = express.Router();

router.delete('/cars/:id', authMiddleware, requireAdmin, carsController.remove);
router.get('/bookings', authMiddleware, requireAdmin, bookingsController.listAll);
router.patch('/bookings/:id/approve', authMiddleware, requireAdmin, bookingsController.approve);
router.patch('/bookings/:id/reject', authMiddleware, requireAdmin, bookingsController.reject);

module.exports = router;
