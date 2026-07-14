const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const Guest = require('../models/Guest');
const Waitlist = require('../models/Waitlist');
const {
  nightsBetween,
  hoursBetween,
  calculateBilling,
  derivePaymentStatus,
} = require('../utils/bookingBilling');

let RestaurantOrder;
try {
  RestaurantOrder = require('../models/RestaurantOrder');
} catch {
  RestaurantOrder = null;
}

const ACTIVE_STATUSES = ['Pending', 'Confirmed', 'Checked-In'];

const validateDates = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) {
    return 'Check-in and check-out date/time are required.';
  }
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Invalid check-in or check-out date/time.';
  }
  if (end <= start) {
    return 'Check-out must be after check-in (date and time).';
  }
  return null;
};

const findOverlappingBooking = async (roomId, checkIn, checkOut, excludeBookingId = null) => {
  const query = {
    room: roomId,
    status: { $in: ACTIVE_STATUSES },
    checkIn: { $lt: new Date(checkOut) },
    checkOut: { $gt: new Date(checkIn) },
  };
  if (excludeBookingId) query._id = { $ne: excludeBookingId };
  return Booking.findOne(query)
    .populate('guest', 'firstName lastName')
    .populate('room', 'roomNumber');
};

const populateBooking = (query) =>
  query
    .populate('guest', 'firstName lastName email phone nationality idType idNumber loyaltyTier isBlacklisted')
    .populate('room', 'roomNumber type price status capacity floor')
    .populate('payments.recordedBy', 'name email');

const assertGuestBookable = (guestDoc) => {
  if (!guestDoc) return 'Guest not found';
  if (guestDoc.isBlacklisted) {
    return `Guest is blacklisted${guestDoc.blacklistReason ? ': ' + guestDoc.blacklistReason : ''}. Booking not allowed.`;
  }
  if (guestDoc.isArchived) {
    return 'Cannot create booking for an archived guest. Restore the guest first.';
  }
  return null;
};

const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const endOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const buildBookingFields = (roomDoc, body) => {
  const billing = calculateBilling(
    body.checkIn,
    body.checkOut,
    roomDoc.price,
    body.discountPercent
  );
  return {
    baseAmount: billing.baseAmount,
    earlyCheckInFee: billing.earlyCheckInFee,
    lateCheckOutFee: billing.lateCheckOutFee,
    discountPercent: billing.discountPercent,
    promoCode: body.promoCode || '',
    totalAmount: billing.totalAmount,
    billing,
  };
};

// ─── GET / ────────────────────────────────────────────────────────────────────
exports.getAllBookings = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.guest) filter.guest = req.query.guest;
    if (req.query.room) filter.room = req.query.room;
    if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
    if (req.query.groupId) filter.groupId = req.query.groupId;

    if (req.query.from || req.query.to) {
      filter.checkIn = {};
      if (req.query.from) filter.checkIn.$gte = new Date(req.query.from);
      if (req.query.to) filter.checkIn.$lte = new Date(req.query.to);
    }

    const q = (req.query.q || req.query.search || '').trim();
    let bookings = await populateBooking(Booking.find(filter)).sort({ createdAt: -1 });

    if (q) {
      const lower = q.toLowerCase();
      bookings = bookings.filter((b) => {
        const g = b.guest && typeof b.guest === 'object' ? b.guest : {};
        const r = b.room && typeof b.room === 'object' ? b.room : {};
        return (
          `${g.firstName || ''} ${g.lastName || ''}`.toLowerCase().includes(lower) ||
          (g.email || '').toLowerCase().includes(lower) ||
          (g.phone || '').includes(q) ||
          String(r.roomNumber || '').toLowerCase().includes(lower) ||
          (b.promoCode || '').toLowerCase().includes(lower) ||
          (b.groupId || '').toLowerCase().includes(lower) ||
          (b._id || '').toString().toLowerCase().includes(lower)
        );
      });
    }

    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /availability ────────────────────────────────────────────────────────
exports.checkAvailability = async (req, res) => {
  try {
    const { checkIn, checkOut } = req.query;
    const dateError = validateDates(checkIn, checkOut);
    if (dateError) return res.status(400).json({ success: false, message: dateError });

    const rooms = await Room.find({ status: { $ne: 'Maintenance' } }).sort({ roomNumber: 1 });
    const conflicting = await Booking.find({
      status: { $in: ACTIVE_STATUSES },
      checkIn: { $lt: new Date(checkOut) },
      checkOut: { $gt: new Date(checkIn) },
    }).select('room status');

    const bookedRoomIds = new Set(conflicting.map((b) => b.room.toString()));
    const available = rooms.filter((room) => !bookedRoomIds.has(room._id.toString()));
    const samplePrice = available[0]?.price || rooms[0]?.price || 0;
    const billing = calculateBilling(checkIn, checkOut, samplePrice, Number(req.query.discountPercent) || 0);

    res.json({
      success: true,
      checkIn,
      checkOut,
      hours: billing.hours,
      nights: billing.nights,
      earlyCheckInFee: billing.earlyCheckInFee,
      lateCheckOutFee: billing.lateCheckOutFee,
      count: available.length,
      data: available,
      conflictingBookings: conflicting,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /guest/:guestId ──────────────────────────────────────────────────────
exports.getGuestBookingHistory = async (req, res) => {
  try {
    const guest = await Guest.findById(req.params.guestId);
    if (!guest) return res.status(404).json({ success: false, message: 'Guest not found' });

    const bookings = await populateBooking(Booking.find({ guest: req.params.guestId })).sort({
      checkIn: -1,
    });

    res.json({
      success: true,
      guest: {
        _id: guest._id,
        firstName: guest.firstName,
        lastName: guest.lastName,
        email: guest.email,
        phone: guest.phone,
      },
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /desk/today ──────────────────────────────────────────────────────────
exports.getDeskToday = async (req, res) => {
  try {
    const from = startOfDay();
    const to = endOfDay();

    const [arrivals, departures, inHouse] = await Promise.all([
      populateBooking(
        Booking.find({
          status: { $in: ['Pending', 'Confirmed'] },
          checkIn: { $gte: from, $lte: to },
        })
      ).sort({ checkIn: 1 }),
      populateBooking(
        Booking.find({
          status: 'Checked-In',
          checkOut: { $gte: from, $lte: to },
        })
      ).sort({ checkOut: 1 }),
      populateBooking(Booking.find({ status: 'Checked-In' })).sort({ checkOut: 1 }),
    ]);

    res.json({
      success: true,
      date: from.toISOString(),
      data: { arrivals, departures, inHouse },
      counts: {
        arrivals: arrivals.length,
        departures: departures.length,
        inHouse: inHouse.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /calendar ────────────────────────────────────────────────────────────
exports.getCalendar = async (req, res) => {
  try {
    const from = req.query.from ? new Date(req.query.from) : startOfDay();
    const to = req.query.to ? new Date(req.query.to) : endOfDay(new Date(Date.now() + 7 * 86400000));

    const rooms = await Room.find().sort({ roomNumber: 1 });
    const bookings = await populateBooking(
      Booking.find({
        status: { $in: [...ACTIVE_STATUSES, 'Checked-Out'] },
        checkIn: { $lt: to },
        checkOut: { $gt: from },
      })
    );

    res.json({
      success: true,
      from,
      to,
      rooms,
      bookings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /reports/summary ─────────────────────────────────────────────────────
exports.getReportsSummary = async (req, res) => {
  try {
    const from = req.query.from ? new Date(req.query.from) : startOfDay(new Date(Date.now() - 30 * 86400000));
    const to = req.query.to ? new Date(req.query.to) : endOfDay();

    const rooms = await Room.find();
    const totalRooms = rooms.length || 1;

    const bookings = await Booking.find({
      status: { $nin: ['Cancelled', 'No-Show'] },
      checkIn: { $lt: to },
      checkOut: { $gt: from },
    }).populate('room', 'price');

    const paidBookings = bookings.filter((b) =>
      ['Paid', 'Partial'].includes(b.paymentStatus)
    );
    const revenue = bookings.reduce((sum, b) => sum + (b.amountPaid || 0), 0);
    const roomNights = bookings.reduce((sum, b) => sum + nightsBetween(b.checkIn, b.checkOut), 0);
    const days = Math.max(1, Math.ceil((to - from) / 86400000));
    const occupancy = Math.min(100, Math.round((roomNights / (totalRooms * days)) * 1000) / 10);
    const adr =
      roomNights > 0
        ? Math.round(bookings.reduce((s, b) => s + (b.totalAmount || 0), 0) / roomNights)
        : 0;

    res.json({
      success: true,
      from,
      to,
      data: {
        totalRooms,
        bookingsCount: bookings.length,
        roomNights,
        occupancyPercent: occupancy,
        adr,
        revenue,
        amountPaidTotal: revenue,
        pendingPayments: bookings.filter((b) => b.paymentStatus === 'Pending').length,
        checkedIn: bookings.filter((b) => b.status === 'Checked-In').length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Waitlist CRUD ────────────────────────────────────────────────────────────
exports.getWaitlist = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const items = await Waitlist.find(filter)
      .populate('guest', 'firstName lastName email phone')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: items.length, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createWaitlist = async (req, res) => {
  try {
    const { guest, preferredType, checkIn, checkOut, notes, numberOfGuests } = req.body;
    if (!guest || !checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        message: 'Guest, check-in, and check-out are required.',
      });
    }
    const dateError = validateDates(checkIn, checkOut);
    if (dateError) return res.status(400).json({ success: false, message: dateError });

    const guestDoc = await Guest.findById(guest);
    if (!guestDoc) return res.status(404).json({ success: false, message: 'Guest not found' });

    const item = await Waitlist.create({
      guest,
      preferredType: preferredType || 'Any',
      checkIn,
      checkOut,
      notes,
      numberOfGuests: numberOfGuests || 1,
    });
    const populated = await Waitlist.findById(item._id).populate(
      'guest',
      'firstName lastName email phone'
    );
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateWaitlist = async (req, res) => {
  try {
    const allowed = ['preferredType', 'checkIn', 'checkOut', 'status', 'notes', 'numberOfGuests'];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    const item = await Waitlist.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    }).populate('guest', 'firstName lastName email phone');
    if (!item) return res.status(404).json({ success: false, message: 'Waitlist entry not found' });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteWaitlist = async (req, res) => {
  try {
    const item = await Waitlist.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Waitlist entry not found' });
    res.json({ success: true, message: 'Waitlist entry deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /no-show/process ────────────────────────────────────────────────────
exports.processNoShows = async (req, res) => {
  try {
    const cutoff = new Date();
    const overdue = await Booking.find({
      status: 'Confirmed',
      checkIn: { $lt: cutoff },
    });

    const updated = [];
    for (const booking of overdue) {
      booking.status = 'No-Show';
      booking.noShowAt = new Date();
      await booking.save();
      const room = await Room.findById(booking.room);
      if (room && ['Reserved', 'Occupied'].includes(room.status)) {
        room.status = 'Available';
        await room.save();
      }
      updated.push(booking._id);
    }

    res.json({
      success: true,
      message: `${updated.length} booking(s) marked as No-Show.`,
      count: updated.length,
      ids: updated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /walk-in ────────────────────────────────────────────────────────────
exports.createWalkIn = async (req, res) => {
  try {
    let guestId = req.body.guest;
    if (!guestId && req.body.guestDetails) {
      const g = req.body.guestDetails;
      if (!g.firstName || !g.lastName || !g.email || !g.phone) {
        return res.status(400).json({
          success: false,
          message: 'Guest details require firstName, lastName, email, and phone.',
        });
      }
      const guest = await Guest.create({
        firstName: g.firstName,
        lastName: g.lastName,
        email: g.email,
        phone: g.phone,
        nationality: g.nationality,
        idType: g.idType || undefined,
        idNumber: g.idNumber,
      });
      guestId = guest._id;
    }

    const { room, checkIn, checkOut, numberOfGuests, specialRequests, discountPercent, promoCode } =
      req.body;
    if (!guestId || !room) {
      return res.status(400).json({ success: false, message: 'Guest and room are required.' });
    }

    const walkInGuest = await Guest.findById(guestId);
    const walkInBlock = assertGuestBookable(walkInGuest);
    if (walkInBlock) return res.status(400).json({ success: false, message: walkInBlock });

    const now = new Date();
    const inAt = checkIn || now.toISOString();
    const outAt =
      checkOut ||
      new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().replace(/T.*/, 'T12:00:00');

    const dateError = validateDates(inAt, outAt);
    if (dateError) return res.status(400).json({ success: false, message: dateError });

    const roomDoc = await Room.findById(room);
    if (!roomDoc) return res.status(404).json({ success: false, message: 'Room not found' });
    if (roomDoc.status === 'Maintenance') {
      return res.status(400).json({ success: false, message: 'Room is under maintenance.' });
    }

    const overlap = await findOverlappingBooking(room, inAt, outAt);
    if (overlap) {
      return res.status(409).json({
        success: false,
        message: `Room ${roomDoc.roomNumber} is already booked for these times.`,
      });
    }

    const fields = buildBookingFields(roomDoc, {
      checkIn: inAt,
      checkOut: outAt,
      discountPercent,
      promoCode,
    });

    const booking = await Booking.create({
      guest: guestId,
      room,
      checkIn: inAt,
      checkOut: outAt,
      numberOfGuests: numberOfGuests || 1,
      specialRequests,
      status: 'Checked-In',
      paymentStatus: 'Pending',
      baseAmount: fields.baseAmount,
      earlyCheckInFee: fields.earlyCheckInFee,
      lateCheckOutFee: fields.lateCheckOutFee,
      discountPercent: fields.discountPercent,
      promoCode: fields.promoCode,
      totalAmount: fields.totalAmount,
      amountPaid: 0,
    });

    roomDoc.status = 'Occupied';
    await roomDoc.save();

    const populated = await populateBooking(Booking.findById(booking._id));
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─── POST /group ──────────────────────────────────────────────────────────────
exports.createGroupBooking = async (req, res) => {
  try {
    const {
      guest,
      rooms,
      checkIn,
      checkOut,
      numberOfGuests,
      specialRequests,
      discountPercent,
      promoCode,
      status,
    } = req.body;

    if (!guest || !Array.isArray(rooms) || rooms.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Guest and at least 2 rooms are required for a group booking.',
      });
    }

    const dateError = validateDates(checkIn, checkOut);
    if (dateError) return res.status(400).json({ success: false, message: dateError });

    const guestDoc = await Guest.findById(guest);
    if (!guestDoc) return res.status(404).json({ success: false, message: 'Guest not found' });
    const guestBlock = assertGuestBookable(guestDoc);
    if (guestBlock) return res.status(400).json({ success: false, message: guestBlock });

    const groupId = `GRP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const created = [];

    for (const roomId of rooms) {
      const roomDoc = await Room.findById(roomId);
      if (!roomDoc) {
        return res.status(404).json({ success: false, message: `Room ${roomId} not found` });
      }
      if (roomDoc.status === 'Maintenance') {
        return res.status(400).json({
          success: false,
          message: `Room ${roomDoc.roomNumber} is under maintenance.`,
        });
      }
      const overlap = await findOverlappingBooking(roomId, checkIn, checkOut);
      if (overlap) {
        return res.status(409).json({
          success: false,
          message: `Room ${roomDoc.roomNumber} is already booked for the selected dates.`,
        });
      }

      const fields = buildBookingFields(roomDoc, { checkIn, checkOut, discountPercent, promoCode });
      const booking = await Booking.create({
        guest,
        room: roomId,
        checkIn,
        checkOut,
        numberOfGuests: numberOfGuests || 1,
        specialRequests,
        status: status || 'Pending',
        paymentStatus: 'Pending',
        groupId,
        baseAmount: fields.baseAmount,
        earlyCheckInFee: fields.earlyCheckInFee,
        lateCheckOutFee: fields.lateCheckOutFee,
        discountPercent: fields.discountPercent,
        promoCode: fields.promoCode,
        totalAmount: fields.totalAmount,
        amountPaid: 0,
      });

      if (booking.status === 'Confirmed') {
        roomDoc.status = 'Reserved';
        await roomDoc.save();
      }
      created.push(booking._id);
    }

    const populated = await populateBooking(Booking.find({ _id: { $in: created } }));
    res.status(201).json({ success: true, groupId, count: populated.length, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─── GET /:id/folio ───────────────────────────────────────────────────────────
exports.getFolio = async (req, res) => {
  try {
    const booking = await populateBooking(Booking.findById(req.params.id));
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    let restaurantOrders = [];
    let restaurantTotal = 0;
    if (RestaurantOrder) {
      restaurantOrders = await RestaurantOrder.find({
        guest: booking.guest._id || booking.guest,
        createdAt: { $gte: booking.checkIn, $lte: booking.checkOut },
      }).sort({ createdAt: -1 });
      restaurantTotal = restaurantOrders.reduce(
        (s, o) => s + (o.totalAmount || o.grandTotal || 0),
        0
      );
    }

    const roomCharges = booking.totalAmount || 0;
    const grandTotal = roomCharges + restaurantTotal;
    const balance = Math.max(0, grandTotal - (booking.amountPaid || 0));

    res.json({
      success: true,
      data: {
        booking,
        roomCharges,
        earlyCheckInFee: booking.earlyCheckInFee || 0,
        lateCheckOutFee: booking.lateCheckOutFee || 0,
        restaurantOrders,
        restaurantTotal,
        grandTotal,
        amountPaid: booking.amountPaid || 0,
        balance,
        payments: booking.payments || [],
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /:id ─────────────────────────────────────────────────────────────────
exports.getBookingById = async (req, res) => {
  try {
    const booking = await populateBooking(Booking.findById(req.params.id));
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST / ───────────────────────────────────────────────────────────────────
exports.createBooking = async (req, res) => {
  try {
    const {
      guest,
      room,
      checkIn,
      checkOut,
      numberOfGuests,
      specialRequests,
      paymentStatus,
      status,
      discountPercent,
      promoCode,
      groupId,
    } = req.body;

    if (!guest || !room) {
      return res.status(400).json({ success: false, message: 'Guest and room are required.' });
    }

    const dateError = validateDates(checkIn, checkOut);
    if (dateError) return res.status(400).json({ success: false, message: dateError });

    const guestDoc = await Guest.findById(guest);
    if (!guestDoc) return res.status(404).json({ success: false, message: 'Guest not found' });
    const guestBlock = assertGuestBookable(guestDoc);
    if (guestBlock) return res.status(400).json({ success: false, message: guestBlock });

    const roomDoc = await Room.findById(room);
    if (!roomDoc) return res.status(404).json({ success: false, message: 'Room not found' });
    if (roomDoc.status === 'Maintenance') {
      return res.status(400).json({
        success: false,
        message: `Room ${roomDoc.roomNumber} is under maintenance and cannot be booked.`,
      });
    }
    if (numberOfGuests && numberOfGuests > roomDoc.capacity) {
      return res.status(400).json({
        success: false,
        message: `Room ${roomDoc.roomNumber} capacity is ${roomDoc.capacity} guests.`,
      });
    }

    const overlap = await findOverlappingBooking(room, checkIn, checkOut);
    if (overlap) {
      return res.status(409).json({
        success: false,
        message: `Room ${roomDoc.roomNumber} is already booked for the selected dates.`,
      });
    }

    const fields = buildBookingFields(roomDoc, { checkIn, checkOut, discountPercent, promoCode });

    const booking = await Booking.create({
      guest,
      room,
      checkIn,
      checkOut,
      numberOfGuests: numberOfGuests || 1,
      specialRequests,
      paymentStatus: paymentStatus || 'Pending',
      status: status || 'Pending',
      groupId: groupId || undefined,
      baseAmount: fields.baseAmount,
      earlyCheckInFee: fields.earlyCheckInFee,
      lateCheckOutFee: fields.lateCheckOutFee,
      discountPercent: fields.discountPercent,
      promoCode: fields.promoCode,
      totalAmount: fields.totalAmount,
      amountPaid: 0,
    });

    if (booking.status === 'Confirmed') {
      roomDoc.status = 'Reserved';
      await roomDoc.save();
    } else if (booking.status === 'Checked-In') {
      roomDoc.status = 'Occupied';
      await roomDoc.save();
    }

    const populated = await populateBooking(Booking.findById(booking._id));
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─── PUT /:id ─────────────────────────────────────────────────────────────────
exports.updateBooking = async (req, res) => {
  try {
    const existing = await Booking.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (
      ['Checked-Out', 'Cancelled', 'No-Show'].includes(existing.status) &&
      !req.body.status &&
      req.body.paymentStatus == null &&
      !req.body.amountPaid
    ) {
      return res.status(400).json({
        success: false,
        message: `Cannot update a ${existing.status.toLowerCase()} booking.`,
      });
    }

    const guest = req.body.guest || existing.guest;
    const room = req.body.room || existing.room;
    const checkIn = req.body.checkIn || existing.checkIn;
    const checkOut = req.body.checkOut || existing.checkOut;

    const dateError = validateDates(checkIn, checkOut);
    if (dateError) return res.status(400).json({ success: false, message: dateError });

    const roomDoc = await Room.findById(room);
    if (!roomDoc) return res.status(404).json({ success: false, message: 'Room not found' });

    const numberOfGuests = req.body.numberOfGuests ?? existing.numberOfGuests;
    if (numberOfGuests > roomDoc.capacity) {
      return res.status(400).json({
        success: false,
        message: `Room ${roomDoc.roomNumber} capacity is ${roomDoc.capacity} guests.`,
      });
    }

    const overlap = await findOverlappingBooking(room, checkIn, checkOut, existing._id);
    if (overlap) {
      return res.status(409).json({
        success: false,
        message: `Room ${roomDoc.roomNumber} is already booked for the selected dates.`,
      });
    }

    if (room.toString() !== existing.room.toString()) {
      const oldRoom = await Room.findById(existing.room);
      if (oldRoom && ['Reserved', 'Occupied'].includes(oldRoom.status)) {
        oldRoom.status = 'Available';
        await oldRoom.save();
      }
    }

    const datesOrRoomOrDiscountChanged =
      req.body.checkIn != null ||
      req.body.checkOut != null ||
      req.body.room != null ||
      req.body.discountPercent != null ||
      req.body.promoCode != null;

    const update = {
      guest,
      room,
      checkIn,
      checkOut,
      numberOfGuests,
    };

    if (datesOrRoomOrDiscountChanged) {
      const fields = buildBookingFields(roomDoc, {
        checkIn,
        checkOut,
        discountPercent:
          req.body.discountPercent != null ? req.body.discountPercent : existing.discountPercent,
        promoCode: req.body.promoCode != null ? req.body.promoCode : existing.promoCode,
      });
      update.baseAmount = fields.baseAmount;
      update.earlyCheckInFee = fields.earlyCheckInFee;
      update.lateCheckOutFee = fields.lateCheckOutFee;
      update.discountPercent = fields.discountPercent;
      update.promoCode = fields.promoCode;
      update.totalAmount = fields.totalAmount;
      update.paymentStatus = derivePaymentStatus(fields.totalAmount, existing.amountPaid);
    } else if (req.body.totalAmount != null) {
      update.totalAmount = Number(req.body.totalAmount);
    }

    if (req.body.specialRequests !== undefined) update.specialRequests = req.body.specialRequests;
    if (req.body.paymentStatus) update.paymentStatus = req.body.paymentStatus;
    if (req.body.status) update.status = req.body.status;
    if (req.body.amountPaid != null) {
      update.amountPaid = Number(req.body.amountPaid);
      update.paymentStatus = derivePaymentStatus(
        update.totalAmount ?? existing.totalAmount,
        update.amountPaid
      );
    }

    const booking = await populateBooking(
      Booking.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
    );

    const targetStatus = req.body.status || existing.status;
    const finalRoomId = room || existing.room;
    if (targetStatus === 'Confirmed') {
      await Room.findByIdAndUpdate(finalRoomId, { status: 'Reserved' });
    } else if (targetStatus === 'Checked-In') {
      await Room.findByIdAndUpdate(finalRoomId, { status: 'Occupied' });
    } else if (targetStatus === 'Checked-Out') {
      await Room.findByIdAndUpdate(finalRoomId, { status: 'Cleaning' });
    } else if (['Cancelled', 'No-Show'].includes(targetStatus)) {
      await Room.findByIdAndUpdate(finalRoomId, { status: 'Available' });
    }

    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─── PATCH check-in / check-out ───────────────────────────────────────────────
exports.checkInBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (!['Pending', 'Confirmed'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot check in a ${booking.status} booking.`,
      });
    }
    booking.status = 'Checked-In';
    await booking.save();
    await Room.findByIdAndUpdate(booking.room, { status: 'Occupied' });
    const populated = await populateBooking(Booking.findById(booking._id));
    res.json({ success: true, message: 'Guest checked in.', data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.checkOutBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.status !== 'Checked-In') {
      return res.status(400).json({
        success: false,
        message: 'Only checked-in guests can be checked out.',
      });
    }
    booking.status = 'Checked-Out';
    await booking.save();
    await Room.findByIdAndUpdate(booking.room, { status: 'Cleaning' });
    const populated = await populateBooking(Booking.findById(booking._id));
    res.json({ success: true, message: 'Guest checked out.', data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─── POST /:id/payments ───────────────────────────────────────────────────────
exports.addPayment = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (['Cancelled', 'No-Show'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'Cannot take payment for this booking.' });
    }

    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Payment amount must be greater than 0.' });
    }

    booking.payments.push({
      amount,
      method: req.body.method || 'Cash',
      note: req.body.note || '',
    recordedBy: req.user?.id,
    at: new Date(),
  });
  booking.amountPaid = (booking.amountPaid || 0) + amount;
  booking.paymentStatus = derivePaymentStatus(booking.totalAmount, booking.amountPaid);
  await booking.save();

  const populated = await populateBooking(Booking.findById(booking._id));
  res.json({ success: true, message: 'Payment recorded.', data: populated });
} catch (error) {
  res.status(400).json({ success: false, message: error.message });
}
};

// ─── PATCH /:id/change-room ───────────────────────────────────────────────────
exports.changeRoom = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (['Checked-Out', 'Cancelled', 'No-Show'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'Cannot change room for this booking.' });
    }

    const newRoomId = req.body.room;
    if (!newRoomId) {
      return res.status(400).json({ success: false, message: 'New room is required.' });
    }

    const newRoom = await Room.findById(newRoomId);
    if (!newRoom) return res.status(404).json({ success: false, message: 'Room not found' });
    if (newRoom.status === 'Maintenance') {
      return res.status(400).json({ success: false, message: 'Room is under maintenance.' });
    }

    const overlap = await findOverlappingBooking(
      newRoomId,
      booking.checkIn,
      booking.checkOut,
      booking._id
    );
    if (overlap) {
      return res.status(409).json({
        success: false,
        message: `Room ${newRoom.roomNumber} is not available for these dates.`,
      });
    }

    const oldRoom = await Room.findById(booking.room);
    if (oldRoom && ['Reserved', 'Occupied'].includes(oldRoom.status)) {
      oldRoom.status = 'Available';
      await oldRoom.save();
    }

    const fields = buildBookingFields(newRoom, {
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      discountPercent: booking.discountPercent,
      promoCode: booking.promoCode,
    });

    booking.room = newRoomId;
    booking.baseAmount = fields.baseAmount;
    booking.earlyCheckInFee = fields.earlyCheckInFee;
    booking.lateCheckOutFee = fields.lateCheckOutFee;
    booking.totalAmount = fields.totalAmount;
    booking.paymentStatus = derivePaymentStatus(fields.totalAmount, booking.amountPaid);
    await booking.save();

    if (booking.status === 'Confirmed') newRoom.status = 'Reserved';
    else if (booking.status === 'Checked-In') newRoom.status = 'Occupied';
    await newRoom.save();

    const populated = await populateBooking(Booking.findById(booking._id));
    res.json({ success: true, message: 'Room changed.', data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─── POST /:id/notes ──────────────────────────────────────────────────────────
exports.addNote = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    const text = (req.body.text || '').trim();
    if (!text) return res.status(400).json({ success: false, message: 'Note text is required.' });

    booking.notes.push({
      text,
      author: req.user?.id,
      authorName: req.user?.email || 'Staff',
      at: new Date(),
    });
    await booking.save();
    const populated = await populateBooking(Booking.findById(booking._id));
    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─── POST /:id/id-document ────────────────────────────────────────────────────
exports.uploadIdDocument = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    booking.idDocument = {
      originalName: req.file.originalname,
      path: `/uploads/guest-ids/${req.file.filename}`,
      mimeType: req.file.mimetype,
      uploadedAt: new Date(),
    };
    await booking.save();
    const populated = await populateBooking(Booking.findById(booking._id));
    res.json({ success: true, message: 'ID document uploaded.', data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─── POST /:id/notify ─────────────────────────────────────────────────────────
exports.notifyBooking = async (req, res) => {
  try {
    const booking = await populateBooking(Booking.findById(req.params.id));
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const guest = booking.guest;
    const channel = req.body.channel || 'email';
    const message = `[SIMULATED ${channel.toUpperCase()}] Booking confirmation for ${guest.firstName} ${guest.lastName} (${guest.email} / ${guest.phone}) — Room ${booking.room?.roomNumber}, ${booking.checkIn} → ${booking.checkOut}, Total LKR ${booking.totalAmount}`;
    console.log(message);

    res.json({
      success: true,
      message: `Confirmation ${channel} simulated successfully.`,
      simulated: true,
      preview: message,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── confirm / cancel / delete ────────────────────────────────────────────────
exports.confirmBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Only pending bookings can be confirmed (current: ${booking.status}).`,
      });
    }
    const overlap = await findOverlappingBooking(
      booking.room,
      booking.checkIn,
      booking.checkOut,
      booking._id
    );
    if (overlap) {
      return res.status(409).json({
        success: false,
        message: 'Cannot confirm — the room has a conflicting reservation.',
      });
    }
    booking.status = 'Confirmed';
    await booking.save();
    await Room.findByIdAndUpdate(booking.room, { status: 'Reserved' });
    const populated = await populateBooking(Booking.findById(booking._id));
    res.json({ success: true, message: 'Booking confirmed.', data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (['Checked-Out', 'Cancelled', 'No-Show'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a ${booking.status.toLowerCase()} booking.`,
      });
    }
    if (booking.status === 'Checked-In') {
      return res.status(400).json({
        success: false,
        message: 'Checked-in bookings cannot be cancelled. Please check out first.',
      });
    }
    booking.status = 'Cancelled';
    await booking.save();
    const room = await Room.findById(booking.room);
    if (room && ['Reserved', 'Occupied'].includes(room.status)) {
      room.status = 'Available';
      await room.save();
    }
    const populated = await populateBooking(Booking.findById(booking._id));
    res.json({ success: true, message: 'Booking cancelled.', data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteBooking = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    res.json({ success: true, message: 'Booking deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
