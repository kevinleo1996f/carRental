const express = require('express');
const carsController = require('../controllers/carsController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/', authMiddleware, carsController.list);
// Must come before /:id -- otherwise Express would match the literal
// word "search" as the :id value and this route would never be reached.
router.get('/search', authMiddleware, carsController.search);
router.get('/:id', authMiddleware, carsController.getById);

module.exports = router;
