const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getAllGuests,
  getGuestById,
  getGuestProfile,
  createGuest,
  updateGuest,
  deleteGuest,
} = require('../controllers/guestController');

const viewRoles = ['Admin', 'Manager', 'Receptionist'];
const manageRoles = ['Admin', 'Receptionist']; // Manager is view-only

router.use(protect);

router.get('/', authorize(...viewRoles), getAllGuests);
router.get('/:id/profile', authorize(...viewRoles), getGuestProfile);
router.get('/:id', authorize(...viewRoles), getGuestById);

router.post('/', authorize(...manageRoles), createGuest);
router.put('/:id', authorize(...manageRoles), updateGuest);
router.delete('/:id', authorize(...manageRoles), deleteGuest);

module.exports = router;
