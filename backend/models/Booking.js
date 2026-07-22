const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    method: {
      type: String,
      enum: ['Cash', 'Card', 'Transfer', 'Other'],
      default: 'Cash',
    },
    note: String,
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const noteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    authorName: String,
    at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const bookingSchema = new mongoose.Schema(
  {
    guest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Guest',
      required: true,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },
    checkIn: {
      type: Date,
      required: [true, 'Check-in date is required'],
    },
    checkOut: {
      type: Date,
      required: [true, 'Check-out date is required'],
    },
    status: {
      type: String,
      enum: ['Pending', 'Confirmed', 'Checked-In', 'Checked-Out', 'Cancelled', 'No-Show'],
      default: 'Pending',
    },
    baseAmount: { type: Number, min: 0, default: 0 },
    earlyCheckInFee: { type: Number, min: 0, default: 0 },
    lateCheckOutFee: { type: Number, min: 0, default: 0 },
    discountPercent: { type: Number, min: 0, max: 100, default: 0 },
    promoCode: { type: String, trim: true, default: '' },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    amountPaid: { type: Number, min: 0, default: 0 },
    payments: [paymentSchema],
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid', 'Partial', 'Refunded'],
      default: 'Pending',
    },
    specialRequests: String,
    numberOfGuests: {
      type: Number,
      default: 1,
      min: 1,
    },
    groupId: { type: String, trim: true, index: true },
    notes: [noteSchema],
    idDocument: {
      originalName: String,
      path: String,
      mimeType: String,
      uploadedAt: Date,
    },
    noShowAt: Date,
  },
  { timestamps: true }
);

bookingSchema.pre('validate', function (next) {
  if (this.checkIn && this.checkOut && this.checkOut <= this.checkIn) {
    this.invalidate('checkOut', 'Check-out must be after check-in (date and time)');
  }
  next();
});

bookingSchema.index({ room: 1, checkIn: 1, checkOut: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
