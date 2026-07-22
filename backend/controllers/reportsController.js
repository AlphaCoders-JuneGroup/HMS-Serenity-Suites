const Booking = require('../models/Booking');
const Room = require('../models/Room');
const RestaurantOrder = require('../models/RestaurantOrder');
const { nightsBetween } = require('../utils/bookingBilling');

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

const parseRange = (query) => {
  const from = query.from ? startOfDay(new Date(query.from)) : startOfDay(new Date(Date.now() - 30 * 86400000));
  const to = query.to ? endOfDay(new Date(query.to)) : endOfDay();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    return { error: 'Invalid from/to date range.' };
  }
  return { from, to };
};

const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

const eachDay = (from, to) => {
  const days = [];
  const cursor = startOfDay(from);
  const last = startOfDay(to);
  while (cursor <= last) {
    days.push(dayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
};

const guestName = (g) => {
  if (!g || typeof g === 'string') return 'Guest';
  return `${g.firstName || ''} ${g.lastName || ''}`.trim() || g.email || 'Guest';
};

const roomLabel = (r) => {
  if (!r || typeof r === 'string') return '—';
  return r.roomNumber || '—';
};

// ─── Overview (period KPIs) ───────────────────────────────────────────────────
exports.getOverview = async (req, res) => {
  try {
    const range = parseRange(req.query);
    if (range.error) return res.status(400).json({ success: false, message: range.error });
    const { from, to } = range;

    const rooms = await Room.find().lean();
    const totalRooms = rooms.length || 1;

    const bookings = await Booking.find({
      status: { $nin: ['Cancelled', 'No-Show'] },
      checkIn: { $lt: to },
      checkOut: { $gt: from },
    }).lean();

    const restaurantOrders = await RestaurantOrder.find({
      status: 'Billed',
      billedAt: { $gte: from, $lte: to },
    }).lean();

    const roomNights = bookings.reduce((sum, b) => sum + nightsBetween(b.checkIn, b.checkOut), 0);
    const days = Math.max(1, eachDay(from, to).length);
    const roomRevenue = bookings.reduce((sum, b) => sum + (b.amountPaid || 0), 0);
    const restaurantRevenue = restaurantOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
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
        roomRevenue,
        restaurantRevenue,
        revenue: roomRevenue + restaurantRevenue,
        pendingPayments: bookings.filter((b) => b.paymentStatus === 'Pending').length,
        partialPayments: bookings.filter((b) => b.paymentStatus === 'Partial').length,
        checkedIn: bookings.filter((b) => b.status === 'Checked-In').length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Daily booking report ─────────────────────────────────────────────────────
exports.getDailyBookings = async (req, res) => {
  try {
    const range = parseRange(req.query);
    if (range.error) return res.status(400).json({ success: false, message: range.error });
    const { from, to } = range;
    const days = eachDay(from, to);

    const bookings = await Booking.find({
      $or: [
        { createdAt: { $gte: from, $lte: to } },
        { checkIn: { $gte: from, $lte: to } },
        { checkOut: { $gte: from, $lte: to } },
      ],
    })
      .populate('guest', 'firstName lastName email')
      .populate('room', 'roomNumber')
      .sort({ createdAt: -1 })
      .lean();

    const byDay = {};
    for (const d of days) {
      byDay[d] = {
        date: d,
        created: 0,
        arrivals: 0,
        departures: 0,
        cancelled: 0,
        noShow: 0,
        confirmed: 0,
        checkedIn: 0,
        revenueBooked: 0,
      };
    }

    const rows = [];
    for (const b of bookings) {
      const createdKey = dayKey(b.createdAt);
      const inKey = dayKey(b.checkIn);
      const outKey = dayKey(b.checkOut);

      if (byDay[createdKey]) {
        byDay[createdKey].created += 1;
        if (b.status !== 'Cancelled' && b.status !== 'No-Show') {
          byDay[createdKey].revenueBooked += b.totalAmount || 0;
        }
        if (b.status === 'Cancelled') byDay[createdKey].cancelled += 1;
        if (b.status === 'No-Show') byDay[createdKey].noShow += 1;
        if (b.status === 'Confirmed') byDay[createdKey].confirmed += 1;
      }
      if (byDay[inKey] && ['Pending', 'Confirmed', 'Checked-In', 'Checked-Out'].includes(b.status)) {
        byDay[inKey].arrivals += 1;
      }
      if (byDay[outKey] && ['Checked-In', 'Checked-Out'].includes(b.status)) {
        byDay[outKey].departures += 1;
      }
      if (b.status === 'Checked-In' && byDay[inKey]) byDay[inKey].checkedIn += 1;

      rows.push({
        _id: b._id,
        guestName: guestName(b.guest),
        roomNumber: roomLabel(b.room),
        status: b.status,
        paymentStatus: b.paymentStatus,
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        createdAt: b.createdAt,
        totalAmount: b.totalAmount || 0,
        amountPaid: b.amountPaid || 0,
        numberOfGuests: b.numberOfGuests || 1,
      });
    }

    const daily = days.map((d) => byDay[d]);
    const totals = daily.reduce(
      (acc, d) => ({
        created: acc.created + d.created,
        arrivals: acc.arrivals + d.arrivals,
        departures: acc.departures + d.departures,
        cancelled: acc.cancelled + d.cancelled,
        noShow: acc.noShow + d.noShow,
        revenueBooked: acc.revenueBooked + d.revenueBooked,
      }),
      { created: 0, arrivals: 0, departures: 0, cancelled: 0, noShow: 0, revenueBooked: 0 }
    );

    res.json({
      success: true,
      from,
      to,
      data: { daily, totals, bookings: rows },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Revenue report ───────────────────────────────────────────────────────────
exports.getRevenue = async (req, res) => {
  try {
    const range = parseRange(req.query);
    if (range.error) return res.status(400).json({ success: false, message: range.error });
    const { from, to } = range;
    const days = eachDay(from, to);

    const bookings = await Booking.find({
      status: { $nin: ['Cancelled', 'No-Show'] },
      $or: [
        { 'payments.at': { $gte: from, $lte: to } },
        { updatedAt: { $gte: from, $lte: to }, amountPaid: { $gt: 0 } },
      ],
    })
      .populate('guest', 'firstName lastName')
      .populate('room', 'roomNumber')
      .lean();

    const restaurantOrders = await RestaurantOrder.find({
      status: 'Billed',
      billedAt: { $gte: from, $lte: to },
    }).lean();

    const byDay = {};
    for (const d of days) {
      byDay[d] = {
        date: d,
        roomCollected: 0,
        roomBooked: 0,
        restaurant: 0,
        total: 0,
      };
    }

    const roomLines = [];
    for (const b of bookings) {
      const payments = Array.isArray(b.payments) ? b.payments : [];
      let periodPaid = 0;
      for (const p of payments) {
        const at = p.at ? new Date(p.at) : null;
        if (at && at >= from && at <= to) {
          const key = dayKey(at);
          if (byDay[key]) {
            byDay[key].roomCollected += p.amount || 0;
            byDay[key].total += p.amount || 0;
          }
          periodPaid += p.amount || 0;
        }
      }
      // Fallback if no payment line items but amountPaid exists in range via updatedAt
      if (!payments.length && (b.amountPaid || 0) > 0) {
        const key = dayKey(b.updatedAt || b.createdAt);
        if (byDay[key]) {
          byDay[key].roomCollected += b.amountPaid || 0;
          byDay[key].total += b.amountPaid || 0;
          periodPaid = b.amountPaid || 0;
        }
      }

      const createdKey = dayKey(b.createdAt);
      if (byDay[createdKey]) byDay[createdKey].roomBooked += b.totalAmount || 0;

      if (periodPaid > 0) {
        roomLines.push({
          _id: b._id,
          source: 'Room',
          guestName: guestName(b.guest),
          roomNumber: roomLabel(b.room),
          paymentStatus: b.paymentStatus,
          totalAmount: b.totalAmount || 0,
          amountPaid: b.amountPaid || 0,
          collectedInPeriod: periodPaid,
          balance: Math.max(0, (b.totalAmount || 0) - (b.amountPaid || 0)),
        });
      }
    }

    const restaurantLines = [];
    for (const o of restaurantOrders) {
      const key = dayKey(o.billedAt || o.createdAt);
      if (byDay[key]) {
        byDay[key].restaurant += o.totalAmount || 0;
        byDay[key].total += o.totalAmount || 0;
      }
      restaurantLines.push({
        _id: o._id,
        source: 'Restaurant',
        guestName: o.guestName || o.roomNumber || o.tableNumber || 'Walk-in',
        orderType: o.orderType,
        paymentStatus: o.paymentStatus,
        totalAmount: o.totalAmount || 0,
        billedAt: o.billedAt,
      });
    }

    const daily = days.map((d) => byDay[d]);
    const totals = daily.reduce(
      (acc, d) => ({
        roomCollected: acc.roomCollected + d.roomCollected,
        roomBooked: acc.roomBooked + d.roomBooked,
        restaurant: acc.restaurant + d.restaurant,
        total: acc.total + d.total,
      }),
      { roomCollected: 0, roomBooked: 0, restaurant: 0, total: 0 }
    );

    res.json({
      success: true,
      from,
      to,
      data: {
        daily,
        totals,
        roomLines,
        restaurantLines,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Room occupancy report ────────────────────────────────────────────────────
exports.getOccupancy = async (req, res) => {
  try {
    const range = parseRange(req.query);
    if (range.error) return res.status(400).json({ success: false, message: range.error });
    const { from, to } = range;
    const days = eachDay(from, to);

    const rooms = await Room.find().select('roomNumber status roomType').lean();
    const totalRooms = rooms.length || 1;

    const bookings = await Booking.find({
      status: { $in: ['Confirmed', 'Checked-In', 'Checked-Out', 'Pending'] },
      checkIn: { $lt: to },
      checkOut: { $gt: from },
    })
      .populate('room', 'roomNumber')
      .lean();

    const daily = days.map((date) => {
      const dayStart = startOfDay(new Date(date));
      const dayEnd = endOfDay(new Date(date));
      const occupied = bookings.filter(
        (b) =>
          new Date(b.checkIn) < dayEnd &&
          new Date(b.checkOut) > dayStart &&
          b.status !== 'Cancelled' &&
          b.status !== 'No-Show'
      ).length;
      const occ = Math.min(100, Math.round((occupied / totalRooms) * 1000) / 10);
      return {
        date,
        totalRooms,
        occupiedRooms: Math.min(occupied, totalRooms),
        availableRooms: Math.max(0, totalRooms - Math.min(occupied, totalRooms)),
        occupancyPercent: occ,
      };
    });

    const avgOccupancy =
      daily.length > 0
        ? Math.round((daily.reduce((s, d) => s + d.occupancyPercent, 0) / daily.length) * 10) / 10
        : 0;

    const statusBreakdown = {
      Available: rooms.filter((r) => r.status === 'Available').length,
      Occupied: rooms.filter((r) => r.status === 'Occupied' || r.status === 'Booked').length,
      Cleaning: rooms.filter((r) => r.status === 'Cleaning').length,
      Maintenance: rooms.filter((r) => r.status === 'Maintenance').length,
      Reserved: rooms.filter((r) => r.status === 'Reserved').length,
    };

    const roomNights = bookings
      .filter((b) => !['Cancelled', 'No-Show'].includes(b.status))
      .reduce((sum, b) => sum + nightsBetween(b.checkIn, b.checkOut), 0);

    res.json({
      success: true,
      from,
      to,
      data: {
        totalRooms,
        avgOccupancy,
        roomNights,
        statusBreakdown,
        daily,
        currentRooms: rooms.map((r) => ({
          _id: r._id,
          roomNumber: r.roomNumber,
          status: r.status,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Payment report ───────────────────────────────────────────────────────────
exports.getPayments = async (req, res) => {
  try {
    const range = parseRange(req.query);
    if (range.error) return res.status(400).json({ success: false, message: range.error });
    const { from, to } = range;

    const bookings = await Booking.find({
      $or: [
        { 'payments.at': { $gte: from, $lte: to } },
        {
          amountPaid: { $gt: 0 },
          updatedAt: { $gte: from, $lte: to },
          paymentStatus: { $in: ['Paid', 'Partial'] },
        },
      ],
    })
      .populate('guest', 'firstName lastName email')
      .populate('room', 'roomNumber')
      .lean();

    const restaurantOrders = await RestaurantOrder.find({
      $or: [
        { billedAt: { $gte: from, $lte: to }, status: 'Billed' },
        { 'payments.at': { $gte: from, $lte: to } },
      ],
    }).lean();

    const paymentRows = [];
    const byMethod = { Cash: 0, Card: 0, Transfer: 0, Other: 0 };
    const byStatus = { Paid: 0, Partial: 0, Pending: 0, Refunded: 0, 'Charged to Room': 0 };

    for (const b of bookings) {
      const payments = Array.isArray(b.payments) ? b.payments : [];
      if (payments.length) {
        for (const p of payments) {
          const at = p.at ? new Date(p.at) : null;
          if (!at || at < from || at > to) continue;
          const method = byMethod[p.method] != null ? p.method : 'Other';
          byMethod[method] += p.amount || 0;
          paymentRows.push({
            _id: `${b._id}-${p._id || at.getTime()}`,
            source: 'Room',
            guestName: guestName(b.guest),
            reference: roomLabel(b.room),
            amount: p.amount || 0,
            method,
            paymentStatus: b.paymentStatus,
            at,
            note: p.note || '',
          });
        }
      } else if ((b.amountPaid || 0) > 0) {
        byMethod.Other += b.amountPaid || 0;
        paymentRows.push({
          _id: String(b._id),
          source: 'Room',
          guestName: guestName(b.guest),
          reference: roomLabel(b.room),
          amount: b.amountPaid || 0,
          method: 'Other',
          paymentStatus: b.paymentStatus,
          at: b.updatedAt,
          note: 'Recorded without payment lines',
        });
      }
      if (byStatus[b.paymentStatus] != null) byStatus[b.paymentStatus] += 1;
    }

    for (const o of restaurantOrders) {
      const payments = Array.isArray(o.payments) ? o.payments : [];
      if (payments.length) {
        for (const p of payments) {
          const at = p.at ? new Date(p.at) : null;
          if (!at || at < from || at > to) continue;
          const method = byMethod[p.method] != null ? p.method : 'Other';
          byMethod[method] += p.amount || 0;
          paymentRows.push({
            _id: `${o._id}-${p._id || at.getTime()}`,
            source: 'Restaurant',
            guestName: o.guestName || o.roomNumber || 'Walk-in',
            reference: o.orderType,
            amount: p.amount || 0,
            method,
            paymentStatus: o.paymentStatus,
            at,
            note: p.note || '',
          });
        }
      } else if (o.status === 'Billed' && o.billedAt) {
        const billed = new Date(o.billedAt);
        if (billed >= from && billed <= to) {
          byMethod.Other += o.totalAmount || 0;
          paymentRows.push({
            _id: String(o._id),
            source: 'Restaurant',
            guestName: o.guestName || o.roomNumber || 'Walk-in',
            reference: o.orderType,
            amount: o.totalAmount || 0,
            method: o.paymentStatus === 'Charged to Room' ? 'Other' : 'Cash',
            paymentStatus: o.paymentStatus,
            at: o.billedAt,
            note: 'Bill total',
          });
        }
      }
      if (byStatus[o.paymentStatus] != null) byStatus[o.paymentStatus] += 1;
    }

    paymentRows.sort((a, b) => new Date(b.at) - new Date(a.at));

    const outstanding = await Booking.find({
      status: { $in: ['Checked-In', 'Checked-Out', 'Confirmed'] },
      paymentStatus: { $in: ['Pending', 'Partial'] },
    })
      .populate('guest', 'firstName lastName')
      .populate('room', 'roomNumber')
      .lean();

    const outstandingRows = outstanding.map((b) => ({
      _id: b._id,
      guestName: guestName(b.guest),
      roomNumber: roomLabel(b.room),
      paymentStatus: b.paymentStatus,
      totalAmount: b.totalAmount || 0,
      amountPaid: b.amountPaid || 0,
      balance: Math.max(0, (b.totalAmount || 0) - (b.amountPaid || 0)),
      checkOut: b.checkOut,
    }));

    const collected = paymentRows.reduce((s, r) => s + (r.amount || 0), 0);
    const outstandingTotal = outstandingRows.reduce((s, r) => s + r.balance, 0);

    res.json({
      success: true,
      from,
      to,
      data: {
        collected,
        outstandingTotal,
        outstandingCount: outstandingRows.length,
        byMethod,
        byStatus,
        payments: paymentRows,
        outstanding: outstandingRows,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const pctChange = (current, previous) => {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
};

const summarizePeriod = async (from, to) => {
  const rooms = await Room.find().lean();
  const totalRooms = rooms.length || 1;
  const days = Math.max(1, eachDay(from, to).length);

  const bookings = await Booking.find({
    status: { $nin: ['Cancelled', 'No-Show'] },
    checkIn: { $lt: to },
    checkOut: { $gt: from },
  }).lean();

  const createdBookings = await Booking.find({
    createdAt: { $gte: from, $lte: to },
  }).lean();

  const restaurantOrders = await RestaurantOrder.find({
    status: 'Billed',
    billedAt: { $gte: from, $lte: to },
  }).lean();

  const roomNights = bookings.reduce((sum, b) => sum + nightsBetween(b.checkIn, b.checkOut), 0);
  const roomRevenue = bookings.reduce((sum, b) => sum + (b.amountPaid || 0), 0);
  const restaurantRevenue = restaurantOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const occupancy = Math.min(100, Math.round((roomNights / (totalRooms * days)) * 1000) / 10);
  const adr =
    roomNights > 0
      ? Math.round(bookings.reduce((s, b) => s + (b.totalAmount || 0), 0) / roomNights)
      : 0;

  const statusMix = {
    Pending: 0,
    Confirmed: 0,
    'Checked-In': 0,
    'Checked-Out': 0,
    Cancelled: 0,
    'No-Show': 0,
  };
  for (const b of createdBookings) {
    if (statusMix[b.status] != null) statusMix[b.status] += 1;
  }

  return {
    totalRooms,
    days,
    bookingsCount: bookings.length,
    createdCount: createdBookings.length,
    roomNights,
    occupancyPercent: occupancy,
    adr,
    roomRevenue,
    restaurantRevenue,
    revenue: roomRevenue + restaurantRevenue,
    statusMix,
    cancelledRate:
      createdBookings.length > 0
        ? Math.round(
            (createdBookings.filter((b) => b.status === 'Cancelled' || b.status === 'No-Show').length /
              createdBookings.length) *
              1000
          ) / 10
        : 0,
  };
};

// ─── Analytics (trends + comparisons) ─────────────────────────────────────────
exports.getAnalytics = async (req, res) => {
  try {
    const range = parseRange(req.query);
    if (range.error) return res.status(400).json({ success: false, message: range.error });
    const { from, to } = range;
    const days = eachDay(from, to);
    const spanMs = to.getTime() - from.getTime();
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - spanMs);

    const [current, previous] = await Promise.all([
      summarizePeriod(from, to),
      summarizePeriod(startOfDay(prevFrom), endOfDay(prevTo)),
    ]);

    const bookings = await Booking.find({
      $or: [
        { createdAt: { $gte: from, $lte: to } },
        { checkIn: { $gte: from, $lte: to } },
        { checkOut: { $gte: from, $lte: to } },
      ],
    }).lean();

    const revenueBookings = await Booking.find({
      status: { $nin: ['Cancelled', 'No-Show'] },
      $or: [
        { 'payments.at': { $gte: from, $lte: to } },
        { updatedAt: { $gte: from, $lte: to }, amountPaid: { $gt: 0 } },
      ],
    }).lean();

    const restaurantOrders = await RestaurantOrder.find({
      status: 'Billed',
      billedAt: { $gte: from, $lte: to },
    }).lean();

    const rooms = await Room.find().select('roomNumber status').lean();
    const totalRooms = rooms.length || 1;

    const trendMap = {};
    for (const d of days) {
      trendMap[d] = {
        date: d,
        bookingsCreated: 0,
        arrivals: 0,
        roomRevenue: 0,
        restaurantRevenue: 0,
        occupancyPercent: 0,
        occupiedRooms: 0,
      };
    }

    for (const b of bookings) {
      const createdKey = dayKey(b.createdAt);
      const inKey = dayKey(b.checkIn);
      if (trendMap[createdKey]) trendMap[createdKey].bookingsCreated += 1;
      if (
        trendMap[inKey] &&
        ['Pending', 'Confirmed', 'Checked-In', 'Checked-Out'].includes(b.status)
      ) {
        trendMap[inKey].arrivals += 1;
      }
    }

    for (const b of revenueBookings) {
      const payments = Array.isArray(b.payments) ? b.payments : [];
      if (payments.length) {
        for (const p of payments) {
          const at = p.at ? new Date(p.at) : null;
          if (!at || at < from || at > to) continue;
          const key = dayKey(at);
          if (trendMap[key]) trendMap[key].roomRevenue += p.amount || 0;
        }
      } else if ((b.amountPaid || 0) > 0) {
        const key = dayKey(b.updatedAt || b.createdAt);
        if (trendMap[key]) trendMap[key].roomRevenue += b.amountPaid || 0;
      }
    }

    for (const o of restaurantOrders) {
      const key = dayKey(o.billedAt || o.createdAt);
      if (trendMap[key]) trendMap[key].restaurantRevenue += o.totalAmount || 0;
    }

    const activeBookings = await Booking.find({
      status: { $in: ['Confirmed', 'Checked-In', 'Checked-Out', 'Pending'] },
      checkIn: { $lt: to },
      checkOut: { $gt: from },
    }).lean();

    for (const date of days) {
      const dayStart = startOfDay(new Date(date));
      const dayEnd = endOfDay(new Date(date));
      const occupied = activeBookings.filter(
        (b) =>
          new Date(b.checkIn) < dayEnd &&
          new Date(b.checkOut) > dayStart &&
          !['Cancelled', 'No-Show'].includes(b.status)
      ).length;
      trendMap[date].occupiedRooms = Math.min(occupied, totalRooms);
      trendMap[date].occupancyPercent = Math.min(
        100,
        Math.round((occupied / totalRooms) * 1000) / 10
      );
    }

    const trends = days.map((d) => ({
      ...trendMap[d],
      totalRevenue: trendMap[d].roomRevenue + trendMap[d].restaurantRevenue,
    }));

    const paymentMethods = { Cash: 0, Card: 0, Transfer: 0, Other: 0 };
    for (const b of revenueBookings) {
      for (const p of b.payments || []) {
        const at = p.at ? new Date(p.at) : null;
        if (!at || at < from || at > to) continue;
        const method = paymentMethods[p.method] != null ? p.method : 'Other';
        paymentMethods[method] += p.amount || 0;
      }
    }

    const peakRevenueDay = trends.reduce(
      (best, d) => (d.totalRevenue > (best?.totalRevenue || 0) ? d : best),
      null
    );
    const peakOccupancyDay = trends.reduce(
      (best, d) => (d.occupancyPercent > (best?.occupancyPercent || 0) ? d : best),
      null
    );
    const peakBookingDay = trends.reduce(
      (best, d) => (d.bookingsCreated > (best?.bookingsCreated || 0) ? d : best),
      null
    );

    const collectionRate =
      current.revenue > 0
        ? Math.round((current.roomRevenue / Math.max(1, current.revenue - current.restaurantRevenue + current.roomRevenue)) * 1000) / 10
        : 0;

    // Simpler collection insight: paid vs booked value in period
    const bookedValue = bookings.reduce((s, b) => s + (b.totalAmount || 0), 0);
    const paidValue = bookings.reduce((s, b) => s + (b.amountPaid || 0), 0);
    const collectionPercent =
      bookedValue > 0 ? Math.round((paidValue / bookedValue) * 1000) / 10 : 0;

    const insights = [];
    insights.push({
      type: 'revenue',
      title: 'Revenue vs previous period',
      detail: `${pctChange(current.revenue, previous.revenue) >= 0 ? 'Up' : 'Down'} ${Math.abs(
        pctChange(current.revenue, previous.revenue)
      )}% (${current.revenue.toLocaleString()} vs ${previous.revenue.toLocaleString()} LKR)`,
    });
    insights.push({
      type: 'occupancy',
      title: 'Occupancy vs previous period',
      detail: `${pctChange(current.occupancyPercent, previous.occupancyPercent) >= 0 ? 'Up' : 'Down'} ${Math.abs(
        pctChange(current.occupancyPercent, previous.occupancyPercent)
      )} pts (${current.occupancyPercent}% vs ${previous.occupancyPercent}%)`,
    });
    if (peakRevenueDay) {
      insights.push({
        type: 'peak',
        title: 'Peak revenue day',
        detail: `${peakRevenueDay.date} with LKR ${peakRevenueDay.totalRevenue.toLocaleString()}`,
      });
    }
    if (peakOccupancyDay) {
      insights.push({
        type: 'peak',
        title: 'Peak occupancy day',
        detail: `${peakOccupancyDay.date} at ${peakOccupancyDay.occupancyPercent}%`,
      });
    }
    if (peakBookingDay) {
      insights.push({
        type: 'bookings',
        title: 'Busiest booking day',
        detail: `${peakBookingDay.date} with ${peakBookingDay.bookingsCreated} new bookings`,
      });
    }
    insights.push({
      type: 'payments',
      title: 'Collection rate',
      detail: `${collectionPercent}% of booked room value collected in overlapping stays`,
    });
    if (current.cancelledRate > 0) {
      insights.push({
        type: 'risk',
        title: 'Cancel / no-show rate',
        detail: `${current.cancelledRate}% of bookings created in this period`,
      });
    }

    const comparison = {
      revenue: {
        current: current.revenue,
        previous: previous.revenue,
        changePercent: pctChange(current.revenue, previous.revenue),
      },
      occupancy: {
        current: current.occupancyPercent,
        previous: previous.occupancyPercent,
        changePercent: pctChange(current.occupancyPercent, previous.occupancyPercent),
      },
      bookings: {
        current: current.createdCount,
        previous: previous.createdCount,
        changePercent: pctChange(current.createdCount, previous.createdCount),
      },
      adr: {
        current: current.adr,
        previous: previous.adr,
        changePercent: pctChange(current.adr, previous.adr),
      },
      roomRevenue: {
        current: current.roomRevenue,
        previous: previous.roomRevenue,
        changePercent: pctChange(current.roomRevenue, previous.roomRevenue),
      },
      restaurantRevenue: {
        current: current.restaurantRevenue,
        previous: previous.restaurantRevenue,
        changePercent: pctChange(current.restaurantRevenue, previous.restaurantRevenue),
      },
    };

    res.json({
      success: true,
      from,
      to,
      previousFrom: startOfDay(prevFrom),
      previousTo: endOfDay(prevTo),
      data: {
        current,
        previous,
        comparison,
        trends,
        bookingStatusMix: current.statusMix,
        paymentMethods,
        revenueSplit: {
          room: current.roomRevenue,
          restaurant: current.restaurantRevenue,
        },
        collectionPercent,
        insights,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
