const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getAllBookings,
  getBookingById,
  createBooking,
  updateBooking,
  deleteBooking,
  checkAvailability,
  getGuestBookingHistory,
  confirmBooking,
  cancelBooking,
} = require('../controllers/bookingController');

const viewRoles = ['Admin', 'Manager', 'Receptionist'];
const manageRoles = ['Admin', 'Receptionist']; // Manager is view-only

router.use(protect);

// View access (Admin, Manager, Receptionist)
router.get('/availability', authorize(...viewRoles), checkAvailability);
router.get('/guest/:guestId', authorize(...viewRoles), getGuestBookingHistory);
router.get('/', authorize(...viewRoles), getAllBookings);
router.get('/:id', authorize(...viewRoles), getBookingById);

// Write access (Admin, Receptionist only — Manager cannot update)
router.post('/', authorize(...manageRoles), createBooking);
router.put('/:id', authorize(...manageRoles), updateBooking);
router.patch('/:id/confirm', authorize(...manageRoles), confirmBooking);
router.patch('/:id/cancel', authorize(...manageRoles), cancelBooking);
router.delete('/:id', authorize(...manageRoles), deleteBooking);

module.exports = router;
