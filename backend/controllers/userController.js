const User = require('../models/User');

// ─── GET /api/users ───────────────────────────────────────────────────────────
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── GET /api/users/:id ───────────────────────────────────────────────────────
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── POST /api/users ──────────────────────────────────────────────────────────
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;

    // Check for duplicate email
    const existing = await User.findOne({ email: email?.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: 'A user with this email already exists.' });
    }

    const user = await User.create({ name, email, password, role, phone });

    // Return without password
    const result = user.toObject();
    delete result.password;

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: err.message });
  }
};

// ─── PUT /api/users/:id ───────────────────────────────────────────────────────
exports.updateUser = async (req, res) => {
  try {
    const { name, email, password, role, phone, isActive } = req.body;

    // Build update payload
    const updateData = { name, email, role, phone, isActive };

    // Only include password if it was actually provided
    if (password && password.trim() !== '') {
      updateData.password = password;
    }

    const user = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    }).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({ success: true, data: user });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: err.message });
  }
};

// ─── DELETE /api/users/:id ────────────────────────────────────────────────────
exports.deleteUser = async (req, res) => {
  try {
    // Prevent deleting yourself
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own account.' });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── PATCH /api/users/:id/toggle-status ───────────────────────────────────────
exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.isActive = !user.isActive;
    await user.save();

    const result = user.toObject();
    delete result.password;

    res.json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully.`,
      data: result,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
