const path = require('path');
const fs = require('fs');
const Guest = require('../models/Guest');
const Booking = require('../models/Booking');

let RestaurantOrder;
try {
  RestaurantOrder = require('../models/RestaurantOrder');
} catch {
  RestaurantOrder = null;
}

const ACTIVE_STAY_STATUSES = ['Pending', 'Confirmed', 'Checked-In'];
const SRI_LANKAN_PHONE = /^0\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validatePhone(phone) {
  if (phone === null || phone === undefined || phone === '') {
    return 'Phone number is required.';
  }
  const value = String(phone);
  if (value.trim() === '') return 'Please enter a phone number.';
  if (!/^\d+$/.test(value)) return 'Phone number must contain only numbers.';
  if (value.length !== 10) return 'Phone number must be exactly 10 digits.';
  if (!value.startsWith('0')) return 'Phone number must start with 0.';
  if (!SRI_LANKAN_PHONE.test(value)) return 'Please enter a valid phone number.';
  return null;
}

function validateEmail(email) {
  if (!email || !String(email).trim()) return 'Email is required.';
  if (!EMAIL_RE.test(String(email).trim())) return 'Please enter a valid email address.';
  return null;
}

function duplicateKeyMessage(error) {
  const key = Object.keys(error.keyPattern || {})[0];
  if (key === 'phone') return 'This phone number is already registered.';
  if (key === 'email') return 'This email is already registered.';
  return 'A guest with these details already exists.';
}

const GUEST_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'nationality',
  'idType',
  'idNumber',
  'address',
  'loyaltyTier',
  'preferences',
  'isBlacklisted',
  'blacklistReason',
  'emergencyContact',
  'company',
  'isArchived',
  'marketingOptIn',
  'dataProcessingConsent',
  'dateOfBirth',
  'anniversary',
];

// ─── GET / ────────────────────────────────────────────────────────────────────
exports.getAllGuests = async (req, res) => {
  try {
    const filter = {};
    const includeArchived = req.query.includeArchived === 'true';
    if (!includeArchived) filter.isArchived = { $ne: true };

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
        { 'company.name': regex },
      ];
    }

    if (req.query.loyaltyTier) filter.loyaltyTier = req.query.loyaltyTier;
    if (req.query.isBlacklisted === 'true') filter.isBlacklisted = true;
    if (req.query.isBlacklisted === 'false') filter.isBlacklisted = false;
    if (req.query.isArchived === 'true') {
      delete filter.isArchived;
      filter.isArchived = true;
    }
    if (req.query.birthdayMonth) {
      const month = Number(req.query.birthdayMonth);
      filter.$expr = { $eq: [{ $month: '$dateOfBirth' }, month] };
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const skip = (page - 1) * limit;

    const [total, guests] = await Promise.all([
      Guest.countDocuments(filter),
      Guest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ]);

    res.json({
      success: true,
      count: guests.length,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      data: guests,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /export ──────────────────────────────────────────────────────────────
exports.exportGuestsCsv = async (req, res) => {
  try {
    const filter = { isArchived: { $ne: true } };
    const guests = await Guest.find(filter).sort({ lastName: 1, firstName: 1 });

    const headers = [
      'FirstName',
      'LastName',
      'Email',
      'Phone',
      'Nationality',
      'LoyaltyTier',
      'Company',
      'Blacklisted',
      'MarketingOptIn',
      'City',
      'Country',
    ];
    const rows = guests.map((g) =>
      [
        g.firstName,
        g.lastName,
        g.email,
        g.phone,
        g.nationality || '',
        g.loyaltyTier || 'Regular',
        g.company?.name || '',
        g.isBlacklisted ? 'Yes' : 'No',
        g.marketingOptIn ? 'Yes' : 'No',
        g.address?.city || '',
        g.address?.country || '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );

    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="guests.csv"');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /reminders ───────────────────────────────────────────────────────────
exports.getReminders = async (req, res) => {
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    const guests = await Guest.find({ isArchived: { $ne: true } });
    const birthdays = guests.filter((g) => {
      if (!g.dateOfBirth) return false;
      const d = new Date(g.dateOfBirth);
      return d.getMonth() + 1 === month && d.getDate() === day;
    });
    const anniversaries = guests.filter((g) => {
      if (!g.anniversary) return false;
      const d = new Date(g.anniversary);
      return d.getMonth() + 1 === month && d.getDate() === day;
    });

    res.json({
      success: true,
      data: { birthdays, anniversaries },
      counts: { birthdays: birthdays.length, anniversaries: anniversaries.length },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getGuestById = async (req, res) => {
  try {
    const guest = await Guest.findById(req.params.id);
    if (!guest) return res.status(404).json({ success: false, message: 'Guest not found' });
    res.json({ success: true, data: guest });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getGuestProfile = async (req, res) => {
  try {
    const guest = await Guest.findById(req.params.id);
    if (!guest) return res.status(404).json({ success: false, message: 'Guest not found' });

    const bookings = await Booking.find({ guest: guest._id })
      .populate('room', 'roomNumber type price status floor')
      .sort({ checkIn: -1 });

    const currentStays = bookings.filter((b) => b.status === 'Checked-In');
    const upcomingStays = bookings.filter(
      (b) => b.status === 'Pending' || b.status === 'Confirmed'
    );
    const previousStays = bookings.filter(
      (b) => b.status === 'Checked-Out' || b.status === 'Cancelled' || b.status === 'No-Show'
    );

    const completed = bookings.filter((b) => b.status === 'Checked-Out');
    const totalSpend = bookings.reduce((s, b) => s + (b.amountPaid || b.totalAmount || 0), 0);
    const lastVisit = completed[0]?.checkOut || null;

    let restaurantTotal = 0;
    if (RestaurantOrder) {
      const orders = await RestaurantOrder.find({ guest: guest._id });
      restaurantTotal = orders.reduce((s, o) => s + (o.totalAmount || 0), 0);
    }

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
          totalStays: completed.length,
          currentStays: currentStays.length,
          upcomingStays: upcomingStays.length,
          previousStays: previousStays.length,
          activeReservations: bookings.filter((b) =>
            ACTIVE_STAY_STATUSES.includes(b.status)
          ).length,
          totalSpend,
          restaurantTotal,
          grandSpend: totalSpend + restaurantTotal,
          lastVisit,
          isRepeatGuest: completed.length >= 2,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /:id/folio-history ───────────────────────────────────────────────────
exports.getGuestFolioHistory = async (req, res) => {
  try {
    const guest = await Guest.findById(req.params.id);
    if (!guest) return res.status(404).json({ success: false, message: 'Guest not found' });

    const bookings = await Booking.find({ guest: guest._id })
      .populate('room', 'roomNumber type')
      .sort({ checkIn: -1 });

    let restaurantOrders = [];
    if (RestaurantOrder) {
      restaurantOrders = await RestaurantOrder.find({ guest: guest._id }).sort({ createdAt: -1 });
    }

    const roomTotal = bookings.reduce((s, b) => s + (b.totalAmount || 0), 0);
    const paidTotal = bookings.reduce((s, b) => s + (b.amountPaid || 0), 0);
    const restaurantTotal = restaurantOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);

    res.json({
      success: true,
      data: {
        guest,
        bookings,
        restaurantOrders,
        totals: {
          roomCharges: roomTotal,
          amountPaid: paidTotal,
          restaurantTotal,
          grandTotal: roomTotal + restaurantTotal,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createGuest = async (req, res) => {
  try {
    const body = req.body;
    if (!body.firstName || !body.lastName || !body.email || !body.phone) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, email, and phone are required.',
      });
    }

    const phoneError = validatePhone(body.phone);
    if (phoneError) return res.status(400).json({ success: false, message: phoneError });
    const emailError = validateEmail(body.email);
    if (emailError) return res.status(400).json({ success: false, message: emailError });

    const existingEmail = await Guest.findOne({ email: body.email.toLowerCase().trim() });
    if (existingEmail) {
      return res.status(400).json({ success: false, message: 'This email is already registered.' });
    }
    const existingPhone = await Guest.findOne({ phone: String(body.phone).trim() });
    if (existingPhone) {
      return res.status(400).json({
        success: false,
        message: 'This phone number is already registered.',
      });
    }

    const data = {};
    for (const key of GUEST_FIELDS) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    if (data.idType === '') data.idType = undefined;
    data.phone = String(body.phone).trim();
    data.email = body.email.toLowerCase().trim();

    const guest = await Guest.create(data);
    res.status(201).json({ success: true, data: guest });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: duplicateKeyMessage(error) });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateGuest = async (req, res) => {
  try {
    const update = {};
    for (const key of GUEST_FIELDS) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }

    if (update.phone !== undefined) {
      const phoneError = validatePhone(update.phone);
      if (phoneError) return res.status(400).json({ success: false, message: phoneError });
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
      const emailError = validateEmail(update.email);
      if (emailError) return res.status(400).json({ success: false, message: emailError });
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
      update.email = String(update.email).toLowerCase().trim();
    }

    if (update.idType === '') update.idType = undefined;
    if (update.isArchived === true) update.archivedAt = new Date();
    if (update.isArchived === false) update.archivedAt = null;

    const guest = await Guest.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!guest) return res.status(404).json({ success: false, message: 'Guest not found' });
    res.json({ success: true, data: guest });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: duplicateKeyMessage(error) });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteGuest = async (req, res) => {
  try {
    const soft = req.query.soft !== 'false';

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

    if (soft) {
      const guest = await Guest.findByIdAndUpdate(
        req.params.id,
        { isArchived: true, archivedAt: new Date() },
        { new: true }
      );
      if (!guest) return res.status(404).json({ success: false, message: 'Guest not found' });
      return res.json({ success: true, message: 'Guest archived successfully', data: guest });
    }

    const guest = await Guest.findByIdAndDelete(req.params.id);
    if (!guest) return res.status(404).json({ success: false, message: 'Guest not found' });
    res.json({ success: true, message: 'Guest deleted permanently' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addNote = async (req, res) => {
  try {
    const guest = await Guest.findById(req.params.id);
    if (!guest) return res.status(404).json({ success: false, message: 'Guest not found' });
    const text = (req.body.text || '').trim();
    if (!text) return res.status(400).json({ success: false, message: 'Note text is required.' });

    guest.notes.push({
      text,
      author: req.user?.id,
      authorName: req.user?.email || 'Staff',
      at: new Date(),
    });
    await guest.save();
    res.json({ success: true, data: guest });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.uploadDocument = async (req, res) => {
  try {
    const guest = await Guest.findById(req.params.id);
    if (!guest) return res.status(404).json({ success: false, message: 'Guest not found' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });

    guest.documents.push({
      originalName: req.file.originalname,
      path: `/uploads/guest-docs/${req.file.filename}`,
      mimeType: req.file.mimetype,
      label: req.body.label || 'ID',
      uploadedAt: new Date(),
    });
    await guest.save();
    res.json({ success: true, message: 'Document uploaded.', data: guest });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.uploadPhoto = async (req, res) => {
  try {
    const guest = await Guest.findById(req.params.id);
    if (!guest) return res.status(404).json({ success: false, message: 'Guest not found' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });

    guest.photo = {
      originalName: req.file.originalname,
      path: `/uploads/guest-photos/${req.file.filename}`,
      mimeType: req.file.mimetype,
      uploadedAt: new Date(),
    };
    await guest.save();
    res.json({ success: true, message: 'Photo uploaded.', data: guest });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.notifyGuest = async (req, res) => {
  try {
    const guest = await Guest.findById(req.params.id);
    if (!guest) return res.status(404).json({ success: false, message: 'Guest not found' });

    const channel = req.body.channel || 'email';
    const subject = req.body.subject || 'Message from Serenity Suites';
    const message =
      req.body.message ||
      `Hello ${guest.firstName}, thank you for staying with Serenity Suites.`;

    const preview = `[SIMULATED ${channel.toUpperCase()}] To: ${guest.email} / ${guest.phone} — ${subject}: ${message}`;
    console.log(preview);

    guest.communications.push({
      channel,
      subject,
      message,
      simulated: true,
      at: new Date(),
      sentBy: req.user?.email || 'Staff',
    });
    await guest.save();

    res.json({
      success: true,
      message: `Guest ${channel} simulated successfully.`,
      simulated: true,
      preview,
      data: guest,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.mergeGuests = async (req, res) => {
  try {
    const { primaryId, secondaryId } = req.body;
    if (!primaryId || !secondaryId || primaryId === secondaryId) {
      return res.status(400).json({
        success: false,
        message: 'primaryId and secondaryId are required and must differ.',
      });
    }

    const [primary, secondary] = await Promise.all([
      Guest.findById(primaryId),
      Guest.findById(secondaryId),
    ]);
    if (!primary || !secondary) {
      return res.status(404).json({ success: false, message: 'One or both guests not found.' });
    }

    await Booking.updateMany({ guest: secondaryId }, { guest: primaryId });
    if (RestaurantOrder) {
      await RestaurantOrder.updateMany({ guest: secondaryId }, { guest: primaryId });
    }

    // Merge notes/docs/comms
    primary.notes.push(...(secondary.notes || []));
    primary.documents.push(...(secondary.documents || []));
    primary.communications.push(...(secondary.communications || []));
    if (!primary.photo?.path && secondary.photo?.path) primary.photo = secondary.photo;
    if (!primary.company?.name && secondary.company?.name) primary.company = secondary.company;
    if (!primary.emergencyContact?.name && secondary.emergencyContact?.name) {
      primary.emergencyContact = secondary.emergencyContact;
    }
    await primary.save();

    secondary.isArchived = true;
    secondary.archivedAt = new Date();
    secondary.email = `merged.${secondary._id}.${secondary.email}`;
    secondary.phone = `9${String(Date.now()).slice(-9)}`;
    await secondary.save();

    res.json({
      success: true,
      message: 'Guests merged. Secondary guest archived.',
      data: primary,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
