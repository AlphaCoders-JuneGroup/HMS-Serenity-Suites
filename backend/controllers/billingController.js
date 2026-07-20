const Booking = require('../models/Booking');
const Guest = require('../models/Guest');
const Event = require('../models/Event');

let RestaurantOrder;
try {
  RestaurantOrder = require('../models/RestaurantOrder');
} catch {
  RestaurantOrder = null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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

const populateBookingForInvoice = (query) =>
  query
    .populate('guest', 'firstName lastName email phone nationality idType idNumber')
    .populate('room', 'roomNumber type price floor')
    .populate('payments.recordedBy', 'name email');

const populateEventForInvoice = (query) =>
  query
    .populate('hall', 'name type capacity ratePerHour ratePerDay')
    .populate('guest', 'firstName lastName email phone')
    .populate('payments.recordedBy', 'name email');

// ═══════════════════════════════════════════════════════════════════════════
// GET /summary — overall billing dashboard (room + restaurant + event revenue)
// ═══════════════════════════════════════════════════════════════════════════
exports.getBillingSummary = async (req, res) => {
  try {
    const bookings = await Booking.find({ status: { $ne: 'Cancelled' } });
    const events = await Event.find({ status: { $ne: 'Cancelled' } });
    const restaurantOrders = RestaurantOrder
      ? await RestaurantOrder.find({ status: { $ne: 'Cancelled' } })
      : [];

    const roomRevenue = bookings.reduce((s, b) => s + (b.totalAmount || 0), 0);
    const roomCollected = bookings.reduce((s, b) => s + (b.amountPaid || 0), 0);

    const eventRevenue = events.reduce((s, e) => s + (e.totalAmount || 0), 0);
    const eventCollected = events.reduce((s, e) => s + (e.amountPaid || 0), 0);

    const restaurantRevenue = restaurantOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
    const restaurantCollected = restaurantOrders.reduce((s, o) => s + (o.amountPaid || 0), 0);

    const totalRevenue = roomRevenue + eventRevenue + restaurantRevenue;
    const totalCollected = roomCollected + eventCollected + restaurantCollected;
    const totalPending = Math.max(0, totalRevenue - totalCollected);

    const pendingBookings = bookings.filter((b) => b.paymentStatus !== 'Paid').length;
    const pendingEvents = events.filter((e) => e.paymentStatus !== 'Paid').length;
    const pendingRestaurantOrders = restaurantOrders.filter(
      (o) => o.paymentStatus !== 'Paid' && o.paymentStatus !== 'Charged to Room'
    ).length;

    res.json({
      success: true,
      data: {
        totalRevenue,
        totalCollected,
        totalPending,
        breakdown: {
          room: {
            revenue: roomRevenue,
            collected: roomCollected,
            pending: Math.max(0, roomRevenue - roomCollected),
            pendingCount: pendingBookings,
          },
          restaurant: {
            revenue: restaurantRevenue,
            collected: restaurantCollected,
            pending: Math.max(0, restaurantRevenue - restaurantCollected),
            pendingCount: pendingRestaurantOrders,
          },
          event: {
            revenue: eventRevenue,
            collected: eventCollected,
            pending: Math.max(0, eventRevenue - eventCollected),
            pendingCount: pendingEvents,
          },
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// GET /pending — unified list of all pending/partial payments (room + event + restaurant)
// ═══════════════════════════════════════════════════════════════════════════
exports.getPendingPayments = async (req, res) => {
  try {
    const bookings = await populateBookingForInvoice(
      Booking.find({ paymentStatus: { $in: ['Pending', 'Partial'] }, status: { $ne: 'Cancelled' } })
    ).sort({ checkIn: -1 });

    const events = await populateEventForInvoice(
      Event.find({ paymentStatus: { $in: ['Pending', 'Partial'] }, status: { $ne: 'Cancelled' } })
    ).sort({ eventDate: -1 });

    const restaurantOrders = RestaurantOrder
      ? await RestaurantOrder.find({
          paymentStatus: { $in: ['Pending', 'Partial'] },
          status: { $ne: 'Cancelled' },
        })
          .populate('guest', 'firstName lastName phone')
          .sort({ createdAt: -1 })
      : [];

    const items = [
      ...bookings.map((b) => ({
        type: 'Room Booking',
        id: b._id,
        reference: `Room ${b.room?.roomNumber || '-'}`,
        customerName: b.guest ? `${b.guest.firstName} ${b.guest.lastName}` : '-',
        totalAmount: b.totalAmount,
        amountPaid: b.amountPaid,
        balance: Math.max(0, (b.totalAmount || 0) - (b.amountPaid || 0)),
        paymentStatus: b.paymentStatus,
        date: b.checkIn,
      })),
      ...events.map((e) => ({
        type: 'Event',
        id: e._id,
        reference: e.eventTitle,
        customerName: e.customerName,
        totalAmount: e.totalAmount,
        amountPaid: e.amountPaid,
        balance: Math.max(0, (e.totalAmount || 0) - (e.amountPaid || 0)),
        paymentStatus: e.paymentStatus,
        date: e.eventDate,
      })),
      ...restaurantOrders.map((o) => ({
        type: 'Restaurant Order',
        id: o._id,
        reference: `${o.orderType}${o.tableNumber ? ' - Table ' + o.tableNumber : ''}`,
        customerName: o.guest ? `${o.guest.firstName} ${o.guest.lastName}` : o.guestName || '-',
        totalAmount: o.totalAmount,
        amountPaid: o.amountPaid,
        balance: Math.max(0, (o.totalAmount || 0) - (o.amountPaid || 0)),
        paymentStatus: o.paymentStatus,
        date: o.createdAt,
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ success: true, count: items.length, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// GET /invoice/booking/:id — printable invoice for a room booking (+ linked restaurant charges)
// ═══════════════════════════════════════════════════════════════════════════
exports.getBookingInvoice = async (req, res) => {
  try {
    const booking = await populateBookingForInvoice(Booking.findById(req.params.id));
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    let restaurantOrders = [];
    let restaurantTotal = 0;
    if (RestaurantOrder) {
      restaurantOrders = await RestaurantOrder.find({
        $or: [
          { booking: booking._id },
          { guest: booking.guest?._id, roomNumber: booking.room?.roomNumber },
        ],
        status: { $ne: 'Cancelled' },
      }).sort({ createdAt: -1 });
      restaurantTotal = restaurantOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
    }

    const roomCharges = booking.baseAmount || 0;
    const grandTotal = (booking.totalAmount || 0) + restaurantTotal;
    const balance = Math.max(0, grandTotal - (booking.amountPaid || 0));

    res.json({
      success: true,
      data: {
        invoiceType: 'Room Booking',
        invoiceNumber: `INV-B-${booking._id.toString().slice(-8).toUpperCase()}`,
        issuedAt: new Date(),
        booking,
        charges: {
          roomCharges,
          earlyCheckInFee: booking.earlyCheckInFee || 0,
          lateCheckOutFee: booking.lateCheckOutFee || 0,
          discountPercent: booking.discountPercent || 0,
          roomTotal: booking.totalAmount || 0,
          restaurantTotal,
        },
        restaurantOrders,
        grandTotal,
        amountPaid: booking.amountPaid || 0,
        balance,
        paymentStatus: booking.paymentStatus,
        payments: booking.payments || [],
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// GET /invoice/event/:id — printable invoice for an event/banquet booking
// ═══════════════════════════════════════════════════════════════════════════
exports.getEventInvoice = async (req, res) => {
  try {
    const event = await populateEventForInvoice(Event.findById(req.params.id));
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const balance = Math.max(0, (event.totalAmount || 0) - (event.amountPaid || 0));

    res.json({
      success: true,
      data: {
        invoiceType: 'Event / Banquet',
        invoiceNumber: `INV-E-${event._id.toString().slice(-8).toUpperCase()}`,
        issuedAt: new Date(),
        event,
        charges: {
          hallCharge: event.hallCharge || 0,
          services: event.services || [],
          servicesTotal: event.servicesTotal || 0,
          discountPercent: event.discountPercent || 0,
          taxPercent: event.taxPercent || 0,
        },
        grandTotal: event.totalAmount || 0,
        amountPaid: event.amountPaid || 0,
        balance,
        paymentStatus: event.paymentStatus,
        payments: event.payments || [],
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// GET /invoice/guest/:guestId — master folio combining ALL of a guest's charges
// (bookings + restaurant + any events linked to their profile)
// ═══════════════════════════════════════════════════════════════════════════
exports.getGuestMasterInvoice = async (req, res) => {
  try {
    const guest = await Guest.findById(req.params.guestId);
    if (!guest) return res.status(404).json({ success: false, message: 'Guest not found' });

    const bookings = await populateBookingForInvoice(Booking.find({ guest: guest._id })).sort({
      checkIn: -1,
    });
    const events = await populateEventForInvoice(Event.find({ guest: guest._id })).sort({
      eventDate: -1,
    });
    const restaurantOrders = RestaurantOrder
      ? await RestaurantOrder.find({ guest: guest._id, status: { $ne: 'Cancelled' } }).sort({
          createdAt: -1,
        })
      : [];

    const roomTotal = bookings.reduce((s, b) => s + (b.totalAmount || 0), 0);
    const eventTotal = events.reduce((s, e) => s + (e.totalAmount || 0), 0);
    const restaurantTotal = restaurantOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
    const grandTotal = roomTotal + eventTotal + restaurantTotal;

    const amountPaid =
      bookings.reduce((s, b) => s + (b.amountPaid || 0), 0) +
      events.reduce((s, e) => s + (e.amountPaid || 0), 0) +
      restaurantOrders.reduce((s, o) => s + (o.amountPaid || 0), 0);

    res.json({
      success: true,
      data: {
        invoiceType: 'Guest Master Folio',
        invoiceNumber: `INV-G-${guest._id.toString().slice(-8).toUpperCase()}`,
        issuedAt: new Date(),
        guest: {
          _id: guest._id,
          firstName: guest.firstName,
          lastName: guest.lastName,
          email: guest.email,
          phone: guest.phone,
        },
        bookings,
        events,
        restaurantOrders,
        summary: { roomTotal, eventTotal, restaurantTotal, grandTotal },
        amountPaid,
        balance: Math.max(0, grandTotal - amountPaid),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// GET /revenue-report?from=&to= — revenue report across all 3 streams for a date range
// ═══════════════════════════════════════════════════════════════════════════
exports.getRevenueReport = async (req, res) => {
  try {
    const from = req.query.from
      ? startOfDay(new Date(req.query.from))
      : startOfDay(new Date(new Date().setDate(new Date().getDate() - 30)));
    const to = req.query.to ? endOfDay(new Date(req.query.to)) : endOfDay(new Date());

    const bookings = await Booking.find({
      createdAt: { $gte: from, $lte: to },
      status: { $ne: 'Cancelled' },
    });
    const events = await Event.find({
      createdAt: { $gte: from, $lte: to },
      status: { $ne: 'Cancelled' },
    });
    const restaurantOrders = RestaurantOrder
      ? await RestaurantOrder.find({
          createdAt: { $gte: from, $lte: to },
          status: { $ne: 'Cancelled' },
        })
      : [];

    const roomRevenue = bookings.reduce((s, b) => s + (b.totalAmount || 0), 0);
    const eventRevenue = events.reduce((s, e) => s + (e.totalAmount || 0), 0);
    const restaurantRevenue = restaurantOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);

    // Group by day for a simple trend line
    const dailyMap = {};
    const addToDay = (date, amount) => {
      const key = new Date(date).toISOString().slice(0, 10);
      dailyMap[key] = (dailyMap[key] || 0) + amount;
    };
    bookings.forEach((b) => addToDay(b.createdAt, b.totalAmount || 0));
    events.forEach((e) => addToDay(e.createdAt, e.totalAmount || 0));
    restaurantOrders.forEach((o) => addToDay(o.createdAt, o.totalAmount || 0));

    const dailyTrend = Object.entries(dailyMap)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      success: true,
      data: {
        from,
        to,
        totalRevenue: roomRevenue + eventRevenue + restaurantRevenue,
        roomRevenue,
        eventRevenue,
        restaurantRevenue,
        bookingCount: bookings.length,
        eventCount: events.length,
        restaurantOrderCount: restaurantOrders.length,
        dailyTrend,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
