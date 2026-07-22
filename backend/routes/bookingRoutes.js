const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
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
  getDeskToday,
  getCalendar,
  getReportsSummary,
  getWaitlist,
  createWaitlist,
  updateWaitlist,
  deleteWaitlist,
  processNoShows,
  createWalkIn,
  createGroupBooking,
  getFolio,
  checkInBooking,
  checkOutBooking,
  addPayment,
  changeRoom,
  addNote,
  uploadIdDocument,
  notifyBooking,
} = require('../controllers/bookingController');

const viewRoles = ['Admin', 'Manager', 'Receptionist'];
const manageRoles = ['Admin', 'Receptionist'];
const reportRoles = ['Admin', 'Manager'];

const uploadDir = path.join(__dirname, '..', 'uploads', 'guest-ids');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /jpeg|jpg|png|pdf|webp/i.test(path.extname(file.originalname)) ||
      /image\/|application\/pdf/.test(file.mimetype);
    cb(ok ? null : new Error('Only images and PDF allowed'), ok);
  },
});

router.use(protect);

// Static paths first
router.get('/availability', authorize(...viewRoles), checkAvailability);
router.get('/desk/today', authorize(...viewRoles), getDeskToday);
router.get('/calendar', authorize(...viewRoles), getCalendar);
router.get('/reports/summary', authorize(...reportRoles), getReportsSummary);
router.get('/guest/:guestId', authorize(...viewRoles), getGuestBookingHistory);

router.get('/waitlist', authorize(...viewRoles), getWaitlist);
router.post('/waitlist', authorize(...manageRoles), createWaitlist);
router.put('/waitlist/:id', authorize(...manageRoles), updateWaitlist);
router.delete('/waitlist/:id', authorize(...manageRoles), deleteWaitlist);

router.post('/no-show/process', authorize(...manageRoles), processNoShows);
router.post('/walk-in', authorize(...manageRoles), createWalkIn);
router.post('/group', authorize(...manageRoles), createGroupBooking);

router.get('/', authorize(...viewRoles), getAllBookings);
router.get('/:id/folio', authorize(...viewRoles), getFolio);
router.get('/:id', authorize(...viewRoles), getBookingById);

router.post('/', authorize(...manageRoles), createBooking);
router.put('/:id', authorize(...manageRoles), updateBooking);
router.patch('/:id/confirm', authorize(...manageRoles), confirmBooking);
router.patch('/:id/cancel', authorize(...manageRoles), cancelBooking);
router.patch('/:id/check-in', authorize(...manageRoles), checkInBooking);
router.patch('/:id/check-out', authorize(...manageRoles), checkOutBooking);
router.post('/:id/payments', authorize(...manageRoles), addPayment);
router.patch('/:id/change-room', authorize(...manageRoles), changeRoom);
router.post('/:id/notes', authorize(...manageRoles), addNote);
router.post('/:id/id-document', authorize(...manageRoles), upload.single('document'), uploadIdDocument);
router.post('/:id/notify', authorize(...manageRoles), notifyBooking);
router.delete('/:id', authorize(...manageRoles), deleteBooking);

module.exports = router;
