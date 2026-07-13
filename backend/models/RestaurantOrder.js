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
  },
  { _id: false }
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
    roomNumber: {
      type: String,
      trim: true,
      default: '',
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
    status: {
      type: String,
      enum: ['Pending', 'Preparing', 'Ready', 'Served', 'Billed', 'Cancelled'],
      default: 'Pending',
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid', 'Charged to Room'],
      default: 'Pending',
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
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
