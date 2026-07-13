const Booking = require('../models/Booking');
const Room = require('../models/Room');
const Guest = require('../models/Guest');

const ACTIVE_STATUSES = ['Pending', 'Confirmed', 'Checked-In'];

const nightsBetween = (checkIn, checkOut) => {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const ms = end.setHours(0, 0, 0, 0) - start.setHours(0, 0, 0, 0);
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
};

const validateDates = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) {
    return 'Check-in and check-out dates are required.';
  }
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Invalid check-in or check-out date.';
  }
  if (end <= start) {
    return 'Check-out date must be after check-in date.';
  }
  return null;
};

/**
 * Find overlapping active bookings for a room in a date range.
 * Overlap rule: existing.checkIn < newCheckOut AND existing.checkOut > newCheckIn
 */
const findOverlappingBooking = async (roomId, checkIn, checkOut, excludeBookingId = null) => {
  const query = {
    room: roomId,
    status: { $in: ACTIVE_STATUSES },
    checkIn: { $lt: new Date(checkOut) },
    checkOut: { $gt: new Date(checkIn) },
  };

  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  return Booking.findOne(query)
    .populate('guest', 'firstName lastName')
    .populate('room', 'roomNumber');
};

const populateBooking = (query) =>
  query
    .populate('guest', 'firstName lastName email phone nationality idType idNumber')
    .populate('room', 'roomNumber type price status capacity floor');

// ─── GET /api/bookings ────────────────────────────────────────────────────────
exports.getAllBookings = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.guest) filter.guest = req.query.guest;
    if (req.query.room) filter.room = req.query.room;

    const bookings = await populateBooking(Booking.find(filter)).sort({ createdAt: -1 });
    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/bookings/availability?checkIn=&checkOut= ───────────────────────
exports.checkAvailability = async (req, res) => {
  try {
    const { checkIn, checkOut } = req.query;
    const dateError = validateDates(checkIn, checkOut);
    if (dateError) {
      return res.status(400).json({ success: false, message: dateError });
    }

    const rooms = await Room.find({ status: { $ne: 'Maintenance' } }).sort({ roomNumber: 1 });

    const conflicting = await Booking.find({
      status: { $in: ACTIVE_STATUSES },
      checkIn: { $lt: new Date(checkOut) },
      checkOut: { $gt: new Date(checkIn) },
    }).select('room status');

    const bookedRoomIds = new Set(conflicting.map((b) => b.room.toString()));
    const available = rooms.filter((room) => !bookedRoomIds.has(room._id.toString()));

    res.json({
      success: true,
      checkIn,
      checkOut,
      nights: nightsBetween(checkIn, checkOut),
      count: available.length,
      data: available,
      conflictingBookings: conflicting,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/bookings/guest/:guestId ─────────────────────────────────────────
exports.getGuestBookingHistory = async (req, res) => {
  try {
    const guest = await Guest.findById(req.params.guestId);
    if (!guest) {
      return res.status(404).json({ success: false, message: 'Guest not found' });
    }

    const bookings = await populateBooking(
      Booking.find({ guest: req.params.guestId })
    ).sort({ checkIn: -1 });

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

// ─── GET /api/bookings/:id ────────────────────────────────────────────────────
exports.getBookingById = async (req, res) => {
  try {
    const booking = await populateBooking(Booking.findById(req.params.id));
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/bookings ───────────────────────────────────────────────────────
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
    } = req.body;

    if (!guest || !room) {
      return res.status(400).json({
        success: false,
        message: 'Guest and room are required.',
      });
    }

    const dateError = validateDates(checkIn, checkOut);
    if (dateError) {
      return res.status(400).json({ success: false, message: dateError });
    }

    const guestDoc = await Guest.findById(guest);
    if (!guestDoc) {
      return res.status(404).json({ success: false, message: 'Guest not found' });
    }

    const roomDoc = await Room.findById(room);
    if (!roomDoc) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

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
        message: `Room ${roomDoc.roomNumber} is already booked for the selected dates. Duplicate reservations are not allowed.`,
      });
    }

    const nights = nightsBetween(checkIn, checkOut);
    const totalAmount =
      req.body.totalAmount != null ? Number(req.body.totalAmount) : nights * roomDoc.price;

    const booking = await Booking.create({
      guest,
      room,
      checkIn,
      checkOut,
      numberOfGuests: numberOfGuests || 1,
      specialRequests,
      paymentStatus: paymentStatus || 'Pending',
      status: status || 'Pending',
      totalAmount,
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

// ─── PUT /api/bookings/:id ────────────────────────────────────────────────────
exports.updateBooking = async (req, res) => {
  try {
    const existing = await Booking.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (['Checked-Out', 'Cancelled'].includes(existing.status) && !req.body.status) {
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
    if (dateError) {
      return res.status(400).json({ success: false, message: dateError });
    }

    const roomDoc = await Room.findById(room);
    if (!roomDoc) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    if (roomDoc.status === 'Maintenance') {
      return res.status(400).json({
        success: false,
        message: `Room ${roomDoc.roomNumber} is under maintenance and cannot be booked.`,
      });
    }

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
        message: `Room ${roomDoc.roomNumber} is already booked for the selected dates. Duplicate reservations are not allowed.`,
      });
    }

    // If room is changed, release the old room
    if (room.toString() !== existing.room.toString()) {
      const oldRoom = await Room.findById(existing.room);
      if (oldRoom && ['Reserved', 'Occupied'].includes(oldRoom.status)) {
        oldRoom.status = 'Available';
        await oldRoom.save();
      }
    }

    const nights = nightsBetween(checkIn, checkOut);
    const totalAmount =
      req.body.totalAmount != null ? Number(req.body.totalAmount) : nights * roomDoc.price;

    const update = {
      guest,
      room,
      checkIn,
      checkOut,
      numberOfGuests,
      totalAmount,
    };

    if (req.body.specialRequests !== undefined) update.specialRequests = req.body.specialRequests;
    if (req.body.paymentStatus) update.paymentStatus = req.body.paymentStatus;
    if (req.body.status) update.status = req.body.status;

    const booking = await populateBooking(
      Booking.findByIdAndUpdate(req.params.id, update, {
        new: true,
        runValidators: true,
      })
    );

    // Update Room status dynamically in DB
    const targetStatus = req.body.status || existing.status;
    const finalRoomId = room || existing.room;
    if (targetStatus === 'Confirmed') {
      await Room.findByIdAndUpdate(finalRoomId, { status: 'Reserved' });
    } else if (targetStatus === 'Checked-In') {
      await Room.findByIdAndUpdate(finalRoomId, { status: 'Occupied' });
    } else if (['Checked-Out', 'Cancelled'].includes(targetStatus)) {
      await Room.findByIdAndUpdate(finalRoomId, { status: 'Available' });
    }

    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─── PATCH /api/bookings/:id/confirm ──────────────────────────────────────────
exports.confirmBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

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

// ─── PATCH /api/bookings/:id/cancel ───────────────────────────────────────────
exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (['Checked-Out', 'Cancelled'].includes(booking.status)) {
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

    // Free room if it was reserved or occupied for this booking
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

// ─── DELETE /api/bookings/:id ─────────────────────────────────────────────────
exports.deleteBooking = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    res.json({ success: true, message: 'Booking deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
