const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getAllRoomTypes,
  getRoomTypeById,
  createRoomType,
  updateRoomType,
  deleteRoomType,
} = require('../controllers/roomTypeController');

const viewRoles = ['Admin', 'Manager', 'Receptionist', 'Housekeeping Manager'];
const manageRoles = ['Admin', 'Manager'];

router.use(protect);

router.get('/', authorize(...viewRoles), getAllRoomTypes);
router.get('/:id', authorize(...viewRoles), getRoomTypeById);
router.post('/', authorize(...manageRoles), createRoomType);
router.put('/:id', authorize(...manageRoles), updateRoomType);
router.delete('/:id', authorize(...manageRoles), deleteRoomType);

module.exports = router;
