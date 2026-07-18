const Event = require('../models/Event');
const EventHall = require('../models/EventHall');

// ─── Helpers ────────────────────────────────────────────────────────────────

const timeToMinutes = (t) => {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + m;
};

const validateEventTimes = (eventDate, startTime, endTime) => {
  if (!eventDate) return 'Event date is required.';
  const date = new Date(eventDate);
  if (Number.isNaN(date.getTime())) return 'Invalid event date.';
  if (!startTime || !endTime) return 'Start time and end time are required.';
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    return 'Start time and end time must be in HH:mm format.';
  }
  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    return 'End time must be after start time.';
  }
  return null;
};

/** Calculate hall charge based on hourly/daily rate, whichever is cheaper for the duration. */
const calculateHallCharge = (hallDoc, startTime, endTime) => {
  const durationHours = (timeToMinutes(endTime) - timeToMinutes(startTime)) / 60;
  const hourlyTotal = Math.round(durationHours * (hallDoc.ratePerHour || 0));
  if (hallDoc.ratePerDay && durationHours >= 6) {
    return Math.min(hourlyTotal, hallDoc.ratePerDay);
  }
  return hourlyTotal;
};

const calculateServicesTotal = (services = []) =>
  services.reduce((sum, s) => sum + (Number(s.price) || 0) * (Number(s.quantity) || 1), 0);

const calculateEventBilling = (hallCharge, servicesTotal, discountPercent = 0, taxPercent = 0) => {
  const subtotal = hallCharge + servicesTotal;
  const discount = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  const tax = Math.min(100, Math.max(0, Number(taxPercent) || 0));
  const afterDiscount = subtotal - Math.round((subtotal * discount) / 100);
  const taxAmount = Math.round((afterDiscount * tax) / 100);
  const totalAmount = Math.max(0, afterDiscount + taxAmount);
  return { subtotal, discount, taxAmount, totalAmount };
};

const derivePaymentStatus = (totalAmount, amountPaid) => {
  if (amountPaid <= 0) return 'Pending';
  if (amountPaid >= totalAmount) return 'Paid';
  return 'Partial';
};

const populateEvent = (query) =>
  query
    .populate('hall', 'name type capacity ratePerHour ratePerDay')
    .populate('guest', 'firstName lastName email phone')
    .populate('assignedCoordinator', 'name email')
    .populate('createdBy', 'name email')
    .populate('payments.recordedBy', 'name email');

const ACTIVE_STATUSES = ['Inquiry', 'Confirmed', 'Ongoing'];

const findOverlappingEvent = async (hallId, eventDate, startTime, endTime, excludeEventId = null) => {
  const dayStart = new Date(eventDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(eventDate);
  dayEnd.setHours(23, 59, 59, 999);

  const query = {
    hall: hallId,
    status: { $in: ACTIVE_STATUSES },
    eventDate: { $gte: dayStart, $lte: dayEnd },
  };
  if (excludeEventId) query._id = { $ne: excludeEventId };

  const sameDayEvents = await Event.find(query);
  const newStart = timeToMinutes(startTime);
  const newEnd = timeToMinutes(endTime);

  return sameDayEvents.find((e) => {
    const existingStart = timeToMinutes(e.startTime);
    const existingEnd = timeToMinutes(e.endTime);
    return newStart < existingEnd && newEnd > existingStart;
  });
};

// ─── GET / — list events (filterable) ────────────────────────────────────────
exports.getAllEvents = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.hall) filter.hall = req.query.hall;
    if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
    if (req.query.eventType) filter.eventType = req.query.eventType;

    if (req.query.from || req.query.to) {
      filter.eventDate = {};
      if (req.query.from) filter.eventDate.$gte = new Date(req.query.from);
      if (req.query.to) filter.eventDate.$lte = new Date(req.query.to);
    }

    const q = (req.query.q || req.query.search || '').trim().toLowerCase();
    let events = await populateEvent(Event.find(filter)).sort({ eventDate: 1, startTime: 1 });

    if (q) {
      events = events.filter((e) => {
        const h = e.hall && typeof e.hall === 'object' ? e.hall : {};
        return (
          e.eventTitle.toLowerCase().includes(q) ||
          e.customerName.toLowerCase().includes(q) ||
          (e.customerPhone || '').includes(q) ||
          (e.customerEmail || '').toLowerCase().includes(q) ||
          (h.name || '').toLowerCase().includes(q) ||
          (e._id || '').toString().toLowerCase().includes(q)
        );
      });
    }

    res.json({ success: true, count: events.length, data: events });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /availability — check free halls for a date/time range ─────────────
exports.checkHallAvailability = async (req, res) => {
  try {
    const { eventDate, startTime, endTime } = req.query;
    const timeError = validateEventTimes(eventDate, startTime, endTime);
    if (timeError) return res.status(400).json({ success: false, message: timeError });

    const halls = await EventHall.find({ isActive: true }).sort({ name: 1 });
    const available = [];
    const unavailable = [];

    for (const hall of halls) {
      const conflict = await findOverlappingEvent(hall._id, eventDate, startTime, endTime);
      if (conflict) {
        unavailable.push({ hall, conflictingEvent: conflict.eventTitle });
      } else {
        available.push(hall);
      }
    }

    res.json({
      success: true,
      eventDate,
      startTime,
      endTime,
      count: available.length,
      data: available,
      unavailable,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /calendar — events grouped for calendar view ────────────────────────
exports.getEventCalendar = async (req, res) => {
  try {
    const filter = { status: { $ne: 'Cancelled' } };
    if (req.query.from || req.query.to) {
      filter.eventDate = {};
      if (req.query.from) filter.eventDate.$gte = new Date(req.query.from);
      if (req.query.to) filter.eventDate.$lte = new Date(req.query.to);
    }
    const events = await populateEvent(Event.find(filter)).sort({ eventDate: 1, startTime: 1 });
    res.json({ success: true, count: events.length, data: events });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /reports/summary — revenue & booking stats for events ──────────────
exports.getEventReportsSummary = async (req, res) => {
  try {
    const events = await Event.find();
    const totalEvents = events.length;
    const totalRevenue = events
      .filter((e) => e.status !== 'Cancelled')
      .reduce((s, e) => s + (e.totalAmount || 0), 0);
    const totalCollected = events.reduce((s, e) => s + (e.amountPaid || 0), 0);
    const pendingAmount = Math.max(0, totalRevenue - totalCollected);

    const byStatus = events.reduce((acc, e) => {
      acc[e.status] = (acc[e.status] || 0) + 1;
      return acc;
    }, {});

    const byType = events.reduce((acc, e) => {
      acc[e.eventType] = (acc[e.eventType] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      data: { totalEvents, totalRevenue, totalCollected, pendingAmount, byStatus, byType },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /:id ─────────────────────────────────────────────────────────────────
exports.getEventById = async (req, res) => {
  try {
    const event = await populateEvent(Event.findById(req.params.id));
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    res.json({ success: true, data: event });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST / — create event ───────────────────────────────────────────────────
exports.createEvent = async (req, res) => {
  try {
    const body = req.body;

    if (!body.eventTitle || !body.hall || !body.customerName || !body.customerPhone) {
      return res.status(400).json({
        success: false,
        message: 'Event title, hall, customer name, and customer phone are required.',
      });
    }

    const timeError = validateEventTimes(body.eventDate, body.startTime, body.endTime);
    if (timeError) return res.status(400).json({ success: false, message: timeError });

    const hallDoc = await EventHall.findById(body.hall);
    if (!hallDoc) return res.status(404).json({ success: false, message: 'Hall not found' });
    if (!hallDoc.isActive) {
      return res.status(400).json({ success: false, message: 'This hall is not currently active.' });
    }

    if (body.expectedGuests && body.expectedGuests > hallDoc.capacity) {
      return res.status(400).json({
        success: false,
        message: `Expected guests (${body.expectedGuests}) exceeds hall capacity (${hallDoc.capacity}).`,
      });
    }

    const conflict = await findOverlappingEvent(body.hall, body.eventDate, body.startTime, body.endTime);
    if (conflict) {
      return res.status(409).json({
        success: false,
        message: `Hall is already booked for "${conflict.eventTitle}" during this time.`,
      });
    }

    const hallCharge = calculateHallCharge(hallDoc, body.startTime, body.endTime);
    const servicesTotal = calculateServicesTotal(body.services);
    const billing = calculateEventBilling(
      hallCharge,
      servicesTotal,
      body.discountPercent,
      body.taxPercent
    );

    const event = await Event.create({
      ...body,
      hallCharge,
      servicesTotal,
      discountPercent: billing.discount,
      totalAmount: billing.totalAmount,
      paymentStatus: 'Pending',
      createdBy: req.user?.id || null,
    });

    const populated = await populateEvent(Event.findById(event._id));
    res.status(201).json({ success: true, message: 'Event created successfully.', data: populated });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─── PUT /:id — update event (recalculates billing if hall/time/services change) ─
exports.updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    if (['Completed', 'Cancelled'].includes(event.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot edit a ${event.status.toLowerCase()} event.`,
      });
    }

    const body = req.body;
    const newHallId = body.hall || event.hall.toString();
    const newDate = body.eventDate || event.eventDate;
    const newStart = body.startTime || event.startTime;
    const newEnd = body.endTime || event.endTime;

    const timeError = validateEventTimes(newDate, newStart, newEnd);
    if (timeError) return res.status(400).json({ success: false, message: timeError });

    const hallDoc = await EventHall.findById(newHallId);
    if (!hallDoc) return res.status(404).json({ success: false, message: 'Hall not found' });

    const conflict = await findOverlappingEvent(newHallId, newDate, newStart, newEnd, event._id);
    if (conflict) {
      return res.status(409).json({
        success: false,
        message: `Hall is already booked for "${conflict.eventTitle}" during this time.`,
      });
    }

    const hallCharge = calculateHallCharge(hallDoc, newStart, newEnd);
    const services = body.services !== undefined ? body.services : event.services;
    const servicesTotal = calculateServicesTotal(services);
    const discountPercent = body.discountPercent !== undefined ? body.discountPercent : event.discountPercent;
    const taxPercent = body.taxPercent !== undefined ? body.taxPercent : event.taxPercent;
    const billing = calculateEventBilling(hallCharge, servicesTotal, discountPercent, taxPercent);

    Object.assign(event, body, {
      hallCharge,
      servicesTotal,
      discountPercent: billing.discount,
      totalAmount: billing.totalAmount,
      paymentStatus: derivePaymentStatus(billing.totalAmount, event.amountPaid),
    });

    await event.save();
    const populated = await populateEvent(Event.findById(event._id));
    res.json({ success: true, message: 'Event updated successfully.', data: populated });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─── PATCH /:id/confirm ───────────────────────────────────────────────────────
exports.confirmEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    if (event.status !== 'Inquiry') {
      return res.status(400).json({
        success: false,
        message: `Only inquiry-stage events can be confirmed (current: ${event.status}).`,
      });
    }
    const conflict = await findOverlappingEvent(
      event.hall,
      event.eventDate,
      event.startTime,
      event.endTime,
      event._id
    );
    if (conflict) {
      return res.status(409).json({
        success: false,
        message: 'Cannot confirm — the hall has a conflicting booking.',
      });
    }
    event.status = 'Confirmed';
    await event.save();
    const populated = await populateEvent(Event.findById(event._id));
    res.json({ success: true, message: 'Event confirmed.', data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─── PATCH /:id/start — mark event as ongoing (day-of) ───────────────────────
exports.startEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    if (event.status !== 'Confirmed') {
      return res.status(400).json({
        success: false,
        message: `Only confirmed events can be started (current: ${event.status}).`,
      });
    }
    event.status = 'Ongoing';
    await event.save();
    const populated = await populateEvent(Event.findById(event._id));
    res.json({ success: true, message: 'Event marked as ongoing.', data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─── PATCH /:id/complete ──────────────────────────────────────────────────────
exports.completeEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    if (!['Confirmed', 'Ongoing'].includes(event.status)) {
      return res.status(400).json({
        success: false,
        message: `Only confirmed or ongoing events can be completed (current: ${event.status}).`,
      });
    }
    event.status = 'Completed';
    await event.save();
    const populated = await populateEvent(Event.findById(event._id));
    res.json({ success: true, message: 'Event completed.', data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─── PATCH /:id/cancel ─────────────────────────────────────────────────────────
exports.cancelEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    if (['Completed', 'Cancelled'].includes(event.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a ${event.status.toLowerCase()} event.`,
      });
    }
    event.status = 'Cancelled';
    event.cancellationReason = req.body.reason || '';
    await event.save();
    const populated = await populateEvent(Event.findById(event._id));
    res.json({ success: true, message: 'Event cancelled.', data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─── POST /:id/services — add a service/add-on item ──────────────────────────
exports.addService = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    if (['Completed', 'Cancelled'].includes(event.status)) {
      return res.status(400).json({ success: false, message: 'Cannot modify a closed event.' });
    }

    const { name, price, quantity } = req.body;
    if (!name || price == null) {
      return res.status(400).json({ success: false, message: 'Service name and price are required.' });
    }

    event.services.push({ name, price, quantity: quantity || 1 });
    event.servicesTotal = calculateServicesTotal(event.services);
    const billing = calculateEventBilling(
      event.hallCharge,
      event.servicesTotal,
      event.discountPercent,
      event.taxPercent
    );
    event.totalAmount = billing.totalAmount;
    event.paymentStatus = derivePaymentStatus(event.totalAmount, event.amountPaid);

    await event.save();
    const populated = await populateEvent(Event.findById(event._id));
    res.json({ success: true, message: 'Service added.', data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─── DELETE /:id/services/:serviceId ──────────────────────────────────────────
exports.removeService = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    if (['Completed', 'Cancelled'].includes(event.status)) {
      return res.status(400).json({ success: false, message: 'Cannot modify a closed event.' });
    }

    event.services = event.services.filter((s) => s._id.toString() !== req.params.serviceId);
    event.servicesTotal = calculateServicesTotal(event.services);
    const billing = calculateEventBilling(
      event.hallCharge,
      event.servicesTotal,
      event.discountPercent,
      event.taxPercent
    );
    event.totalAmount = billing.totalAmount;
    event.paymentStatus = derivePaymentStatus(event.totalAmount, event.amountPaid);

    await event.save();
    const populated = await populateEvent(Event.findById(event._id));
    res.json({ success: true, message: 'Service removed.', data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─── POST /:id/payments — record a payment ────────────────────────────────────
exports.addPayment = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    if (event.status === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot record payment for a cancelled event.' });
    }

    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'A valid payment amount is required.' });
    }
    const balance = event.totalAmount - event.amountPaid;
    if (amount > balance + 0.01) {
      return res.status(400).json({
        success: false,
        message: `Payment (LKR ${amount}) exceeds remaining balance (LKR ${balance}).`,
      });
    }

    event.payments.push({
      amount,
      method: req.body.method || 'Cash',
      note: req.body.note || '',
      recordedBy: req.user?.id,
      at: new Date(),
    });
    event.amountPaid += amount;
    event.paymentStatus = derivePaymentStatus(event.totalAmount, event.amountPaid);
    await event.save();

    const populated = await populateEvent(Event.findById(event._id));
    res.json({ success: true, message: 'Payment recorded.', data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─── POST /:id/notes ──────────────────────────────────────────────────────────
exports.addNote = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    const text = (req.body.text || '').trim();
    if (!text) return res.status(400).json({ success: false, message: 'Note text is required.' });

    event.notes.push({
      text,
      author: req.user?.id,
      authorName: req.user?.email || 'Staff',
      at: new Date(),
    });
    await event.save();
    const populated = await populateEvent(Event.findById(event._id));
    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─── DELETE /:id ───────────────────────────────────────────────────────────────
exports.deleteEvent = async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    res.json({ success: true, message: 'Event deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// EVENT HALL CRUD (catalog of halls — Admin/Manager manage these)
// ═══════════════════════════════════════════════════════════════════════════

exports.getAllHalls = async (req, res) => {
  try {
    const filter = {};
    if (req.query.activeOnly === 'true') filter.isActive = true;
    const halls = await EventHall.find(filter).sort({ name: 1 });
    res.json({ success: true, count: halls.length, data: halls });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getHallById = async (req, res) => {
  try {
    const hall = await EventHall.findById(req.params.id);
    if (!hall) return res.status(404).json({ success: false, message: 'Hall not found' });
    res.json({ success: true, data: hall });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createHall = async (req, res) => {
  try {
    const { name, capacity, ratePerHour } = req.body;
    if (!name || !capacity || ratePerHour == null) {
      return res.status(400).json({
        success: false,
        message: 'Hall name, capacity, and rate per hour are required.',
      });
    }
    const existing = await EventHall.findOne({ name: new RegExp(`^${name}$`, 'i') });
    if (existing) {
      return res.status(400).json({ success: false, message: `Hall '${name}' already exists.` });
    }
    const hall = await EventHall.create(req.body);
    res.status(201).json({ success: true, data: hall });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateHall = async (req, res) => {
  try {
    const hall = await EventHall.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!hall) return res.status(404).json({ success: false, message: 'Hall not found' });
    res.json({ success: true, data: hall });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteHall = async (req, res) => {
  try {
    const activeEvents = await Event.countDocuments({
      hall: req.params.id,
      status: { $in: ACTIVE_STATUSES },
    });
    if (activeEvents > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete — ${activeEvents} active event(s) use this hall. Cancel or complete them first.`,
      });
    }
    const hall = await EventHall.findByIdAndDelete(req.params.id);
    if (!hall) return res.status(404).json({ success: false, message: 'Hall not found' });
    res.json({ success: true, message: 'Hall deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
