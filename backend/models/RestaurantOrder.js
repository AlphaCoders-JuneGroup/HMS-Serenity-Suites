const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
    },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    note: { type: String, default: '' },
  },
  { _id: true }
);

const paymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    method: {
      type: String,
      enum: ['Cash', 'Card', 'Transfer', 'Room Charge', 'Other'],
      default: 'Cash',
    },
    note: String,
    at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const restaurantOrderSchema = new mongoose.Schema(
  {
    items: {
      type: [orderItemSchema],
      validate: [(v) => v.length > 0, 'Order must include at least one item'],
    },
    orderType: {
      type: String,
      enum: ['Dine-In', 'Room Service', 'Takeaway'],
      default: 'Dine-In',
    },
    table: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RestaurantTable',
      default: null,
    },
    tableNumber: { type: String, default: '', trim: true },
    roomNumber: {
      type: String,
      trim: true,
      default: '',
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
    guest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Guest',
      default: null,
    },
    guestName: {
      type: String,
      trim: true,
      default: '',
    },
    guestAllergies: { type: String, default: '' },
    waiter: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: ['Pending', 'Preparing', 'Ready', 'Served', 'Billed', 'Cancelled'],
      default: 'Pending',
    },
    cancelReason: { type: String, default: '' },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Partial', 'Paid', 'Charged to Room'],
      default: 'Pending',
    },
    subtotal: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, default: 0.1 },
    taxAmount: { type: Number, default: 0, min: 0 },
    serviceChargeRate: { type: Number, default: 0.05 },
    serviceCharge: { type: Number, default: 0, min: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    discountAmount: { type: Number, default: 0, min: 0 },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    amountPaid: { type: Number, default: 0, min: 0 },
    payments: [paymentSchema],
    estimatedPrepMinutes: { type: Number, default: 0 },
    notes: {
      type: String,
      default: '',
    },
    billedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

restaurantOrderSchema.pre('validate', function (next) {
  if (this.orderType === 'Room Service' && !this.roomNumber) {
    this.invalidate('roomNumber', 'Room number is required for room service');
  }
  next();
});

module.exports = mongoose.model('RestaurantOrder', restaurantOrderSchema);
