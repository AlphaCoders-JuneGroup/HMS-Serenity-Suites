const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getAllRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
} = require('../controllers/roomController');

// Read access for staff who need room data (incl. housekeeping)
router.use(protect);

router.get('/', authorize('Admin', 'Manager', 'Receptionist', 'Housekeeping Manager'), getAllRooms);
router.get('/:id', authorize('Admin', 'Manager', 'Receptionist', 'Housekeeping Manager'), getRoomById);
router.post('/', authorize('Admin', 'Manager'), createRoom);
router.put('/:id', authorize('Admin', 'Manager', 'Housekeeping Manager'), updateRoom);
router.delete('/:id', authorize('Admin', 'Manager'), deleteRoom);

module.exports = router;
