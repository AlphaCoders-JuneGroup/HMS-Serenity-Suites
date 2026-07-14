const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getAllGuests,
  getGuestById,
  getGuestProfile,
  getGuestFolioHistory,
  createGuest,
  updateGuest,
  deleteGuest,
  exportGuestsCsv,
  getReminders,
  addNote,
  uploadDocument,
  uploadPhoto,
  notifyGuest,
  mergeGuests,
} = require('../controllers/guestController');

const viewRoles = ['Admin', 'Manager', 'Receptionist'];
const manageRoles = ['Admin', 'Receptionist'];

const docsDir = path.join(__dirname, '..', 'uploads', 'guest-docs');
const photosDir = path.join(__dirname, '..', 'uploads', 'guest-photos');
fs.mkdirSync(docsDir, { recursive: true });
fs.mkdirSync(photosDir, { recursive: true });

const makeStorage = (dir) =>
  multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${safe}`);
    },
  });

const uploadDoc = multer({
  storage: makeStorage(docsDir),
  limits: { fileSize: 5 * 1024 * 1024 },
});
const uploadPhotoMw = multer({
  storage: makeStorage(photosDir),
  limits: { fileSize: 3 * 1024 * 1024 },
});

router.use(protect);

router.get('/export', authorize(...viewRoles), exportGuestsCsv);
router.get('/reminders', authorize(...viewRoles), getReminders);
router.get('/', authorize(...viewRoles), getAllGuests);
router.get('/:id/profile', authorize(...viewRoles), getGuestProfile);
router.get('/:id/folio-history', authorize(...viewRoles), getGuestFolioHistory);
router.get('/:id', authorize(...viewRoles), getGuestById);

router.post('/', authorize(...manageRoles), createGuest);
router.post('/merge', authorize(...manageRoles), mergeGuests);
router.put('/:id', authorize(...manageRoles), updateGuest);
router.post('/:id/notes', authorize(...manageRoles), addNote);
router.post('/:id/documents', authorize(...manageRoles), uploadDoc.single('document'), uploadDocument);
router.post('/:id/photo', authorize(...manageRoles), uploadPhotoMw.single('photo'), uploadPhoto);
router.post('/:id/notify', authorize(...manageRoles), notifyGuest);
router.delete('/:id', authorize(...manageRoles), deleteGuest);

module.exports = router;
