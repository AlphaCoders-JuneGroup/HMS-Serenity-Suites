const Guest = require('../models/Guest');
const Booking = require('../models/Booking');

const ACTIVE_STAY_STATUSES = ['Pending', 'Confirmed', 'Checked-In'];
const SRI_LANKAN_PHONE = /^0\d{9}$/;

function validatePhone(phone) {
  if (phone === null || phone === undefined) {
    return 'Phone number is required.';
  }
  const value = String(phone);
  if (value === '') {
    return 'Phone number is required.';
  }
  if (value.trim() === '') {
    return 'Please enter a phone number.';
  }
  if (!/^\d+$/.test(value)) {
    return 'Phone number must contain only numbers.';
  }
  if (value.length !== 10) {
    return 'Phone number must be exactly 10 digits.';
  }
  if (!value.startsWith('0')) {
    return 'Phone number must start with 0.';
  }
  if (!SRI_LANKAN_PHONE.test(value)) {
    return 'Please enter a valid phone number.';
  }
  return null;
}

function duplicateKeyMessage(error) {
  const key = Object.keys(error.keyPattern || {})[0];
  if (key === 'phone') return 'This phone number is already registered.';
  if (key === 'email') return 'This email is already registered.';
  return 'A guest with these details already exists.';
}

exports.getAllGuests = async (req, res) => {
  try {
    const filter = {};
    const q = (req.query.search || req.query.q || '').trim();

    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { phone: regex },
        { nationality: regex },
        { idNumber: regex },
      ];
    }

    const guests = await Guest.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: guests.length, data: guests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getGuestById = async (req, res) => {
  try {
    const guest = await Guest.findById(req.params.id);
    if (!guest) {
      return res.status(404).json({ success: false, message: 'Guest not found' });
    }
    res.json({ success: true, data: guest });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Full guest profile with booking history, current stay, and previous stays.
 * GET /api/guests/:id/profile
 */
exports.getGuestProfile = async (req, res) => {
  try {
    const guest = await Guest.findById(req.params.id);
    if (!guest) {
      return res.status(404).json({ success: false, message: 'Guest not found' });
    }

    const bookings = await Booking.find({ guest: guest._id })
      .populate('room', 'roomNumber type price status floor')
      .sort({ checkIn: -1 });

    const currentStays = bookings.filter((b) => b.status === 'Checked-In');
    const upcomingStays = bookings.filter(
      (b) => b.status === 'Pending' || b.status === 'Confirmed'
    );
    const previousStays = bookings.filter(
      (b) => b.status === 'Checked-Out' || b.status === 'Cancelled'
    );

    res.json({
      success: true,
      data: {
        guest,
        bookings,
        currentStays,
        upcomingStays,
        previousStays,
        stats: {
          totalBookings: bookings.length,
          currentStays: currentStays.length,
          upcomingStays: upcomingStays.length,
          previousStays: previousStays.length,
          activeReservations: bookings.filter((b) =>
            ACTIVE_STAY_STATUSES.includes(b.status)
          ).length,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createGuest = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      nationality,
      idType,
      idNumber,
      address,
    } = req.body;

    if (!firstName || !lastName || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, email, and phone are required.',
      });
    }

    const phoneError = validatePhone(phone);
    if (phoneError) {
      return res.status(400).json({ success: false, message: phoneError });
    }

    const existingEmail = await Guest.findOne({ email: email.toLowerCase().trim() });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'This email is already registered.',
      });
    }

    const existingPhone = await Guest.findOne({ phone: String(phone).trim() });
    if (existingPhone) {
      return res.status(400).json({
        success: false,
        message: 'This phone number is already registered.',
      });
    }

    const guest = await Guest.create({
      firstName,
      lastName,
      email,
      phone: String(phone).trim(),
      nationality,
      idType: idType || undefined,
      idNumber,
      address,
    });

    res.status(201).json({ success: true, data: guest });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: duplicateKeyMessage(error),
      });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateGuest = async (req, res) => {
  try {
    const allowed = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'nationality',
      'idType',
      'idNumber',
      'address',
    ];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }

    if (update.phone !== undefined) {
      const phoneError = validatePhone(update.phone);
      if (phoneError) {
        return res.status(400).json({ success: false, message: phoneError });
      }
      update.phone = String(update.phone).trim();

      const existingPhone = await Guest.findOne({
        phone: update.phone,
        _id: { $ne: req.params.id },
      });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: 'This phone number is already registered.',
        });
      }
    }

    if (update.email) {
      const existing = await Guest.findOne({
        email: String(update.email).toLowerCase().trim(),
        _id: { $ne: req.params.id },
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'This email is already registered.',
        });
      }
    }

    if (update.idType === '') update.idType = undefined;

    const guest = await Guest.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!guest) {
      return res.status(404).json({ success: false, message: 'Guest not found' });
    }
    res.json({ success: true, data: guest });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: duplicateKeyMessage(error),
      });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteGuest = async (req, res) => {
  try {
    const activeBooking = await Booking.findOne({
      guest: req.params.id,
      status: { $in: ACTIVE_STAY_STATUSES },
    });

    if (activeBooking) {
      return res.status(400).json({
        success: false,
        message:
          'Cannot delete a guest with active or upcoming bookings. Cancel or complete them first.',
      });
    }

    const guest = await Guest.findByIdAndDelete(req.params.id);
    if (!guest) {
      return res.status(404).json({ success: false, message: 'Guest not found' });
    }
    res.json({ success: true, message: 'Guest deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
