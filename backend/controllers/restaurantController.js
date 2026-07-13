const MenuItem = require('../models/MenuItem');
const RestaurantOrder = require('../models/RestaurantOrder');

const calcTotal = (items) =>
  items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);

// ─── Menu ─────────────────────────────────────────────────────────────────────
exports.getMenu = async (req, res) => {
  try {
    const filter = {};
    if (req.query.available === 'true') filter.available = true;
    if (req.query.available === 'false') filter.available = false;
    if (req.query.category) filter.category = req.query.category;

    const items = await MenuItem.find(filter).sort({ category: 1, name: 1 });
    res.json({ success: true, count: items.length, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createMenuItem = async (req, res) => {
  try {
    const { name, description, category, price, available, preparationTime } = req.body;
    if (!name || !category || price == null) {
      return res.status(400).json({
        success: false,
        message: 'Name, category, and price are required.',
      });
    }
    const item = await MenuItem.create({
      name,
      description,
      category,
      price,
      available: available !== false,
      preparationTime,
    });
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateMenuItem = async (req, res) => {
  try {
    const allowed = ['name', 'description', 'category', 'price', 'available', 'preparationTime'];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }

    const item = await MenuItem.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.toggleMenuAvailability = async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }
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
    if (!item) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }
    res.json({ success: true, message: 'Menu item deleted' });
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

    const orders = await RestaurantOrder.find(filter)
      .populate('guest', 'firstName lastName email phone')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const order = await RestaurantOrder.findById(req.params.id).populate(
      'guest',
      'firstName lastName email phone'
    );
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const { items, orderType, roomNumber, guest, guestName, notes } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must include at least one item.',
      });
    }

    const normalized = [];
    for (const line of items) {
      if (!line.menuItem && !line.name) {
        return res.status(400).json({
          success: false,
          message: 'Each order line needs a menu item or name.',
        });
      }

      let name = line.name;
      let price = line.price;
      let menuItemId = line.menuItem || null;

      if (line.menuItem) {
        const menu = await MenuItem.findById(line.menuItem);
        if (!menu) {
          return res.status(404).json({
            success: false,
            message: `Menu item not found: ${line.menuItem}`,
          });
        }
        if (!menu.available) {
          return res.status(400).json({
            success: false,
            message: `"${menu.name}" is currently unavailable.`,
          });
        }
        name = menu.name;
        price = menu.price;
        menuItemId = menu._id;
      }

      normalized.push({
        menuItem: menuItemId,
        name,
        price: Number(price),
        quantity: Number(line.quantity) || 1,
      });
    }

    const type = orderType || 'Dine-In';
    if (type === 'Room Service' && !roomNumber) {
      return res.status(400).json({
        success: false,
        message: 'Room number is required for room service.',
      });
    }

    const order = await RestaurantOrder.create({
      items: normalized,
      orderType: type,
      roomNumber: roomNumber || '',
      guest: guest || null,
      guestName: guestName || '',
      notes: notes || '',
      totalAmount: calcTotal(normalized),
      status: 'Pending',
      paymentStatus: type === 'Room Service' ? 'Charged to Room' : 'Pending',
    });

    const populated = await RestaurantOrder.findById(order._id).populate(
      'guest',
      'firstName lastName email phone'
    );
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['Pending', 'Preparing', 'Ready', 'Served', 'Billed', 'Cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid order status.' });
    }

    const order = await RestaurantOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (order.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cancelled orders cannot be updated.',
      });
    }

    order.status = status;
    if (status === 'Billed' && !order.billedAt) {
      order.billedAt = new Date();
      if (order.paymentStatus === 'Pending') order.paymentStatus = 'Paid';
    }
    await order.save();

    const populated = await RestaurantOrder.findById(order._id).populate(
      'guest',
      'firstName lastName email phone'
    );
    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.generateBill = async (req, res) => {
  try {
    const order = await RestaurantOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (order.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot bill a cancelled order.',
      });
    }

    order.status = 'Billed';
    order.billedAt = new Date();
    if (order.orderType === 'Room Service') {
      order.paymentStatus = 'Charged to Room';
    } else {
      order.paymentStatus = req.body.paymentStatus || 'Paid';
    }
    await order.save();

    const populated = await RestaurantOrder.findById(order._id).populate(
      'guest',
      'firstName lastName email phone'
    );

    res.json({
      success: true,
      message: 'Restaurant bill generated.',
      data: populated,
      bill: {
        orderId: order._id,
        items: order.items,
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

// ─── Daily sales ──────────────────────────────────────────────────────────────
exports.getDailySales = async (req, res) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    const start = new Date(`${dateStr}T00:00:00.000Z`);
    const end = new Date(`${dateStr}T23:59:59.999Z`);

    const orders = await RestaurantOrder.find({
      createdAt: { $gte: start, $lte: end },
      status: { $ne: 'Cancelled' },
    }).sort({ createdAt: -1 });

    const billed = orders.filter((o) => o.status === 'Billed' || o.paymentStatus !== 'Pending');
    const revenue = billed.reduce((sum, o) => sum + o.totalAmount, 0);
    const byType = {};
    for (const o of orders) {
      byType[o.orderType] = (byType[o.orderType] || 0) + 1;
    }

    res.json({
      success: true,
      date: dateStr,
      data: {
        totalOrders: orders.length,
        billedOrders: billed.length,
        revenue,
        byType,
        orders,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
