const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getBillingSummary,
  getPendingPayments,
  getBookingInvoice,
  getEventInvoice,
  getGuestMasterInvoice,
  getRevenueReport,
} = require('../controllers/billingController');

// Same access level as Booking module — Admin, Manager, Receptionist can view/manage billing
const viewRoles = ['Admin', 'Manager', 'Receptionist'];

router.use(protect);

router.get('/summary', authorize(...viewRoles), getBillingSummary);
router.get('/pending', authorize(...viewRoles), getPendingPayments);
router.get('/revenue-report', authorize('Admin', 'Manager'), getRevenueReport);

router.get('/invoice/booking/:id', authorize(...viewRoles), getBookingInvoice);
router.get('/invoice/event/:id', authorize(...viewRoles), getEventInvoice);
router.get('/invoice/guest/:guestId', authorize(...viewRoles), getGuestMasterInvoice);

module.exports = router;
