const express = require('express');
const router = express.Router();
const { login, register, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// POST /api/auth/register  — public
router.post('/register', register);

// POST /api/auth/login  — public
router.post('/login', login);

// GET  /api/auth/me     — requires valid JWT
router.get('/me', protect, getMe);

module.exports = router;
