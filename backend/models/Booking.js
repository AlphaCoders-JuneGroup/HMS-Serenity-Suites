const mongoose = require('mongoose');

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
      enum: ['Pending', 'Confirmed', 'Checked-In', 'Checked-Out', 'Cancelled'],
      default: 'Pending',
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
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
  },
  { timestamps: true }
);

bookingSchema.pre('validate', function (next) {
  if (this.checkIn && this.checkOut && this.checkOut <= this.checkIn) {
    this.invalidate('checkOut', 'Check-out date must be after check-in date');
  }
  next();
});

// Active bookings that block a room
bookingSchema.index({ room: 1, checkIn: 1, checkOut: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
