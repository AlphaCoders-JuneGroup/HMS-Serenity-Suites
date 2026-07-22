const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  checkHallAvailability,
  getEventCalendar,
  getEventReportsSummary,
  confirmEvent,
  startEvent,
  completeEvent,
  cancelEvent,
  addService,
  removeService,
  addPayment,
  addNote,
  getAllHalls,
  getHallById,
  createHall,
  updateHall,
  deleteHall,
} = require('../controllers/eventController');

// View: Admin, Manager, Event Coordinator can see events.
// Manage: Admin, Event Coordinator can create/edit. Manager is view-only (matches Booking module pattern).
const viewRoles = ['Admin', 'Manager', 'Event Coordinator'];
const manageRoles = ['Admin', 'Event Coordinator'];
const hallManageRoles = ['Admin', 'Manager']; // Only Admin/Manager manage the hall catalog itself

router.use(protect);

// ── Static/collection routes first (must come before /:id) ──────────────────
router.get('/availability', authorize(...viewRoles), checkHallAvailability);
router.get('/calendar', authorize(...viewRoles), getEventCalendar);
router.get('/reports/summary', authorize('Admin', 'Manager'), getEventReportsSummary);

// ── Hall catalog (halls & meeting rooms available to book) ───────────────────
router.get('/halls', authorize(...viewRoles), getAllHalls);
router.get('/halls/:id', authorize(...viewRoles), getHallById);
router.post('/halls', authorize(...hallManageRoles), createHall);
router.put('/halls/:id', authorize(...hallManageRoles), updateHall);
router.delete('/halls/:id', authorize(...hallManageRoles), deleteHall);

// ── Event CRUD ────────────────────────────────────────────────────────────────
router.get('/', authorize(...viewRoles), getAllEvents);
router.get('/:id', authorize(...viewRoles), getEventById);
router.post('/', authorize(...manageRoles), createEvent);
router.put('/:id', authorize(...manageRoles), updateEvent);
router.delete('/:id', authorize(...manageRoles), deleteEvent);

// ── Status transitions ────────────────────────────────────────────────────────
router.patch('/:id/confirm', authorize(...manageRoles), confirmEvent);
router.patch('/:id/start', authorize(...manageRoles), startEvent);
router.patch('/:id/complete', authorize(...manageRoles), completeEvent);
router.patch('/:id/cancel', authorize(...manageRoles), cancelEvent);

// ── Services / add-ons ────────────────────────────────────────────────────────
router.post('/:id/services', authorize(...manageRoles), addService);
router.delete('/:id/services/:serviceId', authorize(...manageRoles), removeService);

// ── Payments & notes ──────────────────────────────────────────────────────────
router.post('/:id/payments', authorize(...manageRoles), addPayment);
router.post('/:id/notes', authorize(...manageRoles), addNote);

module.exports = router;
