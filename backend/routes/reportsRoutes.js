const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getOverview,
  getDailyBookings,
  getRevenue,
  getOccupancy,
  getPayments,
  getAnalytics,
} = require('../controllers/reportsController');

const reportRoles = ['Admin', 'Manager'];

router.use(protect);
router.get('/overview', authorize(...reportRoles), getOverview);
router.get('/daily-bookings', authorize(...reportRoles), getDailyBookings);
router.get('/revenue', authorize(...reportRoles), getRevenue);
router.get('/occupancy', authorize(...reportRoles), getOccupancy);
router.get('/payments', authorize(...reportRoles), getPayments);
router.get('/analytics', authorize(...reportRoles), getAnalytics);

module.exports = router;
