const MenuItem = require('../models/MenuItem');
const RestaurantOrder = require('../models/RestaurantOrder');
const RestaurantTable = require('../models/RestaurantTable');
const RestaurantShift = require('../models/RestaurantShift');
const Guest = require('../models/Guest');
const Booking = require('../models/Booking');
const {
  effectivePrice,
  estimatePrep,
  calculateOrderTotals,
  DEFAULT_TAX,
  DEFAULT_SERVICE,
} = require('../utils/restaurantBilling');

const populateOrder = (q) =>
  q
    .populate('guest', 'firstName lastName email phone preferences')
    .populate('table', 'tableNumber capacity status')
    .populate('booking', 'room checkIn checkOut status');

async function resolveLines(items) {
  const normalized = [];
  const menuMap = {};
  for (const line of items) {
    if (!line.menuItem && !line.name) {
      throw Object.assign(new Error('Each order line needs a menu item or name.'), { status: 400 });
    }

    let name = line.name;
    let price = line.price;
    let menuItemId = line.menuItem || null;
    let menu = null;

    if (line.menuItem) {
      menu = await MenuItem.findById(line.menuItem);
      if (!menu) {
        throw Object.assign(new Error(`Menu item not found: ${line.menuItem}`), { status: 404 });
      }
      if (!menu.available || (menu.stock != null && menu.stock <= 0)) {
        throw Object.assign(new Error(`"${menu.name}" is currently unavailable.`), { status: 400 });
      }
      name = menu.name;
      price = effectivePrice(menu);
      menuItemId = menu._id;
      menuMap[String(menu._id)] = menu;
    }

    const qty = Number(line.quantity) || 1;
    if (menu && menu.stock != null && menu.stock < qty) {
      throw Object.assign(new Error(`Insufficient stock for "${menu.name}".`), { status: 400 });
    }

    normalized.push({
      menuItem: menuItemId,
      name,
      price: Number(price),
      quantity: qty,
      note: line.note || '',
    });
  }
  return { normalized, menuMap };
}

async function adjustStock(items, direction = -1) {
  for (const line of items) {
    if (!line.menuItem) continue;
    const menu = await MenuItem.findById(line.menuItem);
    if (menu && menu.stock != null) {
      menu.stock = Math.max(0, menu.stock + direction * line.quantity);
      if (menu.stock === 0) menu.available = false;
      if (direction > 0 && menu.stock > 0) menu.available = true;
      await menu.save();
    }
  }
}

async function findInHouseBooking(roomNumber, guestId) {
  const filter = {
    status: 'Checked-In',
  };
  if (guestId) filter.guest = guestId;

  const bookings = await Booking.find(filter).populate('room', 'roomNumber');
  if (roomNumber) {
    return (
      bookings.find((b) => {
        const rn = typeof b.room === 'object' ? b.room?.roomNumber : null;
        return String(rn) === String(roomNumber);
      }) || null
    );
  }
  return bookings[0] || null;
}

// ─── Menu ─────────────────────────────────────────────────────────────────────
exports.getMenu = async (req, res) => {
  try {
    const filter = {};
    if (req.query.available === 'true') filter.available = true;
    if (req.query.available === 'false') filter.available = false;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.q) {
      const regex = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: regex }, { description: regex }, { allergens: regex }];
    }

    const items = await MenuItem.find(filter).sort({ category: 1, name: 1 });
    const withEffective = items.map((i) => {
      const obj = i.toObject();
      obj.effectivePrice = effectivePrice(i);
      obj.isHappyHour = obj.effectivePrice !== obj.price;
      return obj;
    });
    res.json({ success: true, count: items.length, data: withEffective });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createMenuItem = async (req, res) => {
  try {
    const body = req.body;
    if (!body.name || !body.category || body.price == null) {
      return res.status(400).json({
        success: false,
        message: 'Name, category, and price are required.',
      });
    }
    const item = await MenuItem.create({
      name: body.name,
      description: body.description,
      category: body.category,
      price: body.price,
      happyHourPrice: body.happyHourPrice,
      happyHourStart: body.happyHourStart,
      happyHourEnd: body.happyHourEnd,
      available: body.available !== false,
      stock: body.stock != null ? body.stock : null,
      preparationTime: body.preparationTime,
      isCombo: !!body.isCombo,
      comboItemIds: body.comboItemIds || [],
      allergens: body.allergens || '',
      image: body.image || '',
    });
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateMenuItem = async (req, res) => {
  try {
    const allowed = [
      'name',
      'description',
      'category',
      'price',
      'happyHourPrice',
      'happyHourStart',
      'happyHourEnd',
      'available',
      'stock',
      'preparationTime',
      'isCombo',
      'comboItemIds',
      'allergens',
      'image',
    ];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    const item = await MenuItem.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!item) return res.status(404).json({ success: false, message: 'Menu item not found' });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.uploadMenuImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image uploaded.' });
    }
    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Menu item not found' });
    item.image = `/uploads/menu-images/${req.file.filename}`;
    await item.save();
    res.json({ success: true, message: 'Menu image uploaded.', data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.toggleMenuAvailability = async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Menu item not found' });
    item.available = !item.available;
    await item.save();
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteMenuItem = async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Menu item not found' });
    res.json({ success: true, message: 'Menu item deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Tables ───────────────────────────────────────────────────────────────────
exports.getTables = async (req, res) => {
  try {
    const tables = await RestaurantTable.find()
      .populate('currentOrder')
      .sort({ tableNumber: 1 });
    res.json({ success: true, count: tables.length, data: tables });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createTable = async (req, res) => {
  try {
    const table = await RestaurantTable.create(req.body);
    res.status(201).json({ success: true, data: table });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateTable = async (req, res) => {
  try {
    const allowed = ['tableNumber', 'capacity', 'status', 'location', 'image', 'currentOrder'];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    const table = await RestaurantTable.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!table) return res.status(404).json({ success: false, message: 'Table not found' });
    res.json({ success: true, data: table });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteTable = async (req, res) => {
  try {
    const table = await RestaurantTable.findByIdAndDelete(req.params.id);
    if (!table) return res.status(404).json({ success: false, message: 'Table not found' });
    res.json({ success: true, message: 'Table deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Kitchen display ──────────────────────────────────────────────────────────
exports.getKitchenQueue = async (req, res) => {
  try {
    const orders = await populateOrder(
      RestaurantOrder.find({
        status: { $in: ['Pending', 'Preparing', 'Ready'] },
      })
    ).sort({ createdAt: 1 });
    res.json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Orders ───────────────────────────────────────────────────────────────────
exports.getOrders = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.orderType) filter.orderType = req.query.orderType;
    if (req.query.table) filter.table = req.query.table;

    const orders = await populateOrder(RestaurantOrder.find(filter)).sort({ createdAt: -1 });
    res.json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const order = await populateOrder(RestaurantOrder.findById(req.params.id));
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const {
      items,
      orderType,
      roomNumber,
      guest,
      guestName,
      notes,
      table,
      tableNumber,
      waiter,
      taxRate,
      serviceChargeRate,
      discountPercent,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must include at least one item.',
      });
    }

    const type = orderType || 'Dine-In';
    if (type === 'Room Service' && !roomNumber) {
      return res.status(400).json({
        success: false,
        message: 'Room number is required for room service.',
      });
    }

    const { normalized, menuMap } = await resolveLines(items);
    const totals = calculateOrderTotals({
      items: normalized,
      taxRate: taxRate != null ? taxRate : DEFAULT_TAX,
      serviceChargeRate: serviceChargeRate != null ? serviceChargeRate : DEFAULT_SERVICE,
      discountPercent: discountPercent || 0,
    });

    let guestAllergies = '';
    let guestNameFinal = guestName || '';
    if (guest) {
      const g = await Guest.findById(guest);
      if (g) {
        guestNameFinal = guestNameFinal || `${g.firstName} ${g.lastName}`;
        guestAllergies = g.preferences?.dietaryNeeds || g.preferences?.specialNeeds || '';
      }
    }

    let bookingId = null;
    if (type === 'Room Service' || roomNumber) {
      const booking = await findInHouseBooking(roomNumber, guest);
      if (booking) bookingId = booking._id;
    }

    let tableDoc = null;
    if (table) {
      tableDoc = await RestaurantTable.findById(table);
      if (!tableDoc) {
        return res.status(404).json({ success: false, message: 'Table not found' });
      }
    }

    const order = await RestaurantOrder.create({
      items: normalized,
      orderType: type,
      roomNumber: roomNumber || '',
      table: table || null,
      tableNumber: tableNumber || tableDoc?.tableNumber || '',
      guest: guest || null,
      guestName: guestNameFinal,
      guestAllergies,
      waiter: waiter || req.user?.email || '',
      notes: notes || '',
      booking: bookingId,
      estimatedPrepMinutes: estimatePrep(normalized, menuMap),
      ...totals,
      status: 'Pending',
      paymentStatus: type === 'Room Service' ? 'Charged to Room' : 'Pending',
      amountPaid: 0,
    });

    await adjustStock(normalized, -1);

    // ── Issue: Integrate restaurant charge into booking folio ─────────────────
    if (bookingId) {
      const {
        derivePaymentStatus,
      } = require('../utils/bookingBilling');
      const linkedBooking = await Booking.findById(bookingId);
      if (linkedBooking) {
        linkedBooking.totalAmount = (linkedBooking.totalAmount || 0) + (totals.grandTotal || totals.totalAmount || 0);
        linkedBooking.paymentStatus = derivePaymentStatus(linkedBooking.totalAmount, linkedBooking.amountPaid);
        await linkedBooking.save();
      }
    }
    // ──────────────────────────────────────────────────────────────────────────

    if (tableDoc) {
      tableDoc.status = 'Occupied';
      tableDoc.currentOrder = order._id;
      await tableDoc.save();
    }

    const populated = await populateOrder(RestaurantOrder.findById(order._id));
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
};

exports.updateOrder = async (req, res) => {
  try {
    const order = await RestaurantOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (['Billed', 'Cancelled'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit a billed or cancelled order.',
      });
    }

    if (req.body.items) {
      await adjustStock(order.items, +1);
      const { normalized, menuMap } = await resolveLines(req.body.items);
      await adjustStock(normalized, -1);
      order.items = normalized;
      order.estimatedPrepMinutes = estimatePrep(normalized, menuMap);
    }

    if (req.body.notes !== undefined) order.notes = req.body.notes;
    if (req.body.waiter !== undefined) order.waiter = req.body.waiter;
    if (req.body.roomNumber !== undefined) order.roomNumber = req.body.roomNumber;
    if (req.body.guest !== undefined) order.guest = req.body.guest || null;
    if (req.body.guestName !== undefined) order.guestName = req.body.guestName;
    if (req.body.discountPercent !== undefined) order.discountPercent = req.body.discountPercent;
    if (req.body.taxRate !== undefined) order.taxRate = req.body.taxRate;
    if (req.body.serviceChargeRate !== undefined) {
      order.serviceChargeRate = req.body.serviceChargeRate;
    }

    const totals = calculateOrderTotals({
      items: order.items,
      taxRate: order.taxRate,
      serviceChargeRate: order.serviceChargeRate,
      discountPercent: order.discountPercent,
    });
    Object.assign(order, totals);
    await order.save();

    const populated = await populateOrder(RestaurantOrder.findById(order._id));
    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, cancelReason } = req.body;
    const allowed = ['Pending', 'Preparing', 'Ready', 'Served', 'Billed', 'Cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid order status.' });
    }

    const order = await RestaurantOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cancelled orders cannot be updated.',
      });
    }

    if (status === 'Cancelled') {
      order.cancelReason = cancelReason || 'No reason provided';
      await adjustStock(order.items, +1);
      if (order.table) {
        await RestaurantTable.findByIdAndUpdate(order.table, {
          status: 'Available',
          currentOrder: null,
        });
      }
    }

    order.status = status;
    if (status === 'Billed' && !order.billedAt) {
      order.billedAt = new Date();
      if (order.paymentStatus === 'Pending') order.paymentStatus = 'Paid';
    }
    await order.save();

    const populated = await populateOrder(RestaurantOrder.findById(order._id));
    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.addPayment = async (req, res) => {
  try {
    const order = await RestaurantOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.status === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot pay cancelled order.' });
    }

    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0.' });
    }

    order.payments.push({
      amount,
      method: req.body.method || 'Cash',
      note: req.body.note || '',
      at: new Date(),
    });
    order.amountPaid = (order.amountPaid || 0) + amount;

    if (order.amountPaid >= order.totalAmount) {
      order.paymentStatus = order.paymentStatus === 'Charged to Room' ? 'Charged to Room' : 'Paid';
      if (order.status !== 'Billed') {
        order.status = 'Billed';
        order.billedAt = new Date();
      }
    } else if (order.amountPaid > 0) {
      order.paymentStatus = 'Partial';
    }

    await order.save();
    const populated = await populateOrder(RestaurantOrder.findById(order._id));
    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.generateBill = async (req, res) => {
  try {
    const order = await RestaurantOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot bill a cancelled order.',
      });
    }

    if (req.body.discountPercent != null) {
      order.discountPercent = req.body.discountPercent;
      const totals = calculateOrderTotals({
        items: order.items,
        taxRate: order.taxRate,
        serviceChargeRate: order.serviceChargeRate,
        discountPercent: order.discountPercent,
      });
      Object.assign(order, totals);
    }

    order.status = 'Billed';
    order.billedAt = new Date();

    const chargeToRoom = req.body.chargeToRoom || order.orderType === 'Room Service';
    if (chargeToRoom) {
      order.paymentStatus = 'Charged to Room';
      if (!order.booking && order.roomNumber) {
        const booking = await findInHouseBooking(order.roomNumber, order.guest);
        if (booking) order.booking = booking._id;
      }
      order.amountPaid = order.totalAmount;
      order.payments.push({
        amount: order.totalAmount,
        method: 'Room Charge',
        note: `Charged to room ${order.roomNumber}`,
        at: new Date(),
      });
    } else {
      order.paymentStatus = req.body.paymentStatus || 'Paid';
      if (order.paymentStatus === 'Paid' && order.amountPaid < order.totalAmount) {
        const due = order.totalAmount - (order.amountPaid || 0);
        order.payments.push({
          amount: due,
          method: req.body.method || 'Cash',
          note: 'Full settlement',
          at: new Date(),
        });
        order.amountPaid = order.totalAmount;
      }
    }

    await order.save();

    if (order.table) {
      await RestaurantTable.findByIdAndUpdate(order.table, {
        status: 'Cleaning',
        currentOrder: null,
      });
    }

    const populated = await populateOrder(RestaurantOrder.findById(order._id));
    res.json({
      success: true,
      message: 'Restaurant bill generated.',
      data: populated,
      bill: {
        orderId: order._id,
        items: order.items,
        subtotal: order.subtotal,
        taxAmount: order.taxAmount,
        serviceCharge: order.serviceCharge,
        discountAmount: order.discountAmount,
        totalAmount: order.totalAmount,
        orderType: order.orderType,
        roomNumber: order.roomNumber,
        paymentStatus: order.paymentStatus,
        billedAt: order.billedAt,
      },
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.notifyReceipt = async (req, res) => {
  try {
    const order = await populateOrder(RestaurantOrder.findById(req.params.id));
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    const email =
      (order.guest && typeof order.guest === 'object' && order.guest.email) || req.body.email || '';
    const preview = `[SIMULATED EMAIL] Receipt for order ${order._id} → ${email || 'no-email'} Total LKR ${order.totalAmount}`;
    console.log(preview);
    res.json({ success: true, simulated: true, message: 'Receipt email simulated.', preview });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Sales & reports ──────────────────────────────────────────────────────────
exports.getDailySales = async (req, res) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    const start = new Date(`${dateStr}T00:00:00.000`);
    const end = new Date(`${dateStr}T23:59:59.999`);

    const orders = await RestaurantOrder.find({
      createdAt: { $gte: start, $lte: end },
      status: { $ne: 'Cancelled' },
    }).sort({ createdAt: -1 });

    const billed = orders.filter((o) => o.status === 'Billed' || o.paymentStatus !== 'Pending');
    const revenue = billed.reduce((sum, o) => sum + (o.amountPaid || o.totalAmount), 0);
    const byType = {};
    const byItem = {};
    for (const o of orders) {
      byType[o.orderType] = (byType[o.orderType] || 0) + 1;
      for (const line of o.items) {
        if (!byItem[line.name]) byItem[line.name] = { qty: 0, revenue: 0 };
        byItem[line.name].qty += line.quantity;
        byItem[line.name].revenue += line.price * line.quantity;
      }
    }

    const popularItems = Object.entries(byItem)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    res.json({
      success: true,
      date: dateStr,
      data: {
        totalOrders: orders.length,
        billedOrders: billed.length,
        revenue,
        byType,
        popularItems,
        orders,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSalesRange = async (req, res) => {
  try {
    const from = req.query.from || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const to = req.query.to || new Date().toISOString().slice(0, 10);
    const start = new Date(`${from}T00:00:00.000`);
    const end = new Date(`${to}T23:59:59.999`);

    const orders = await RestaurantOrder.find({
      createdAt: { $gte: start, $lte: end },
      status: { $ne: 'Cancelled' },
    });

    const billed = orders.filter((o) => o.status === 'Billed' || o.paymentStatus !== 'Pending');
    const revenue = billed.reduce((s, o) => s + (o.amountPaid || o.totalAmount), 0);
    const byItem = {};
    for (const o of orders) {
      for (const line of o.items) {
        if (!byItem[line.name]) byItem[line.name] = { qty: 0, revenue: 0 };
        byItem[line.name].qty += line.quantity;
        byItem[line.name].revenue += line.price * line.quantity;
      }
    }

    res.json({
      success: true,
      from,
      to,
      data: {
        totalOrders: orders.length,
        billedOrders: billed.length,
        revenue,
        avgTicket: billed.length ? Math.round(revenue / billed.length) : 0,
        popularItems: Object.entries(byItem)
          .map(([name, v]) => ({ name, ...v }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 15),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Shifts ───────────────────────────────────────────────────────────────────
exports.getCurrentShift = async (req, res) => {
  try {
    const shift = await RestaurantShift.findOne({ status: 'Open' }).sort({ openedAt: -1 });
    res.json({ success: true, data: shift });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.openShift = async (req, res) => {
  try {
    const existing = await RestaurantShift.findOne({ status: 'Open' });
    if (existing) {
      return res.status(400).json({ success: false, message: 'A shift is already open.', data: existing });
    }
    const shift = await RestaurantShift.create({
      openedAt: new Date(),
      openedBy: req.user?.email || 'Staff',
      openingCash: Number(req.body.openingCash) || 0,
      status: 'Open',
    });
    res.status(201).json({ success: true, data: shift });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.closeShift = async (req, res) => {
  try {
    const shift = await RestaurantShift.findOne({ status: 'Open' }).sort({ openedAt: -1 });
    if (!shift) {
      return res.status(400).json({ success: false, message: 'No open shift to close.' });
    }

    const orders = await RestaurantOrder.find({
      createdAt: { $gte: shift.openedAt },
      status: { $ne: 'Cancelled' },
    });

    let cash = 0;
    let card = 0;
    let room = 0;
    let revenue = 0;
    for (const o of orders) {
      revenue += o.amountPaid || (o.status === 'Billed' ? o.totalAmount : 0);
      for (const p of o.payments || []) {
        if (p.method === 'Cash') cash += p.amount;
        else if (p.method === 'Card') card += p.amount;
        else if (p.method === 'Room Charge') room += p.amount;
      }
    }

    shift.closedAt = new Date();
    shift.closedBy = req.user?.email || 'Staff';
    shift.closingCash = Number(req.body.closingCash) || 0;
    shift.expectedCash = shift.openingCash + cash;
    shift.cardTotal = card;
    shift.roomChargeTotal = room;
    shift.orderCount = orders.length;
    shift.revenue = revenue;
    shift.notes = req.body.notes || '';
    shift.status = 'Closed';
    await shift.save();

    res.json({ success: true, message: 'Shift closed.', data: shift });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getShifts = async (req, res) => {
  try {
    const shifts = await RestaurantShift.find().sort({ openedAt: -1 }).limit(30);
    res.json({ success: true, count: shifts.length, data: shifts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
