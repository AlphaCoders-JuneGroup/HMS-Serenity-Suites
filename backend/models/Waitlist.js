const mongoose = require('mongoose');

const waitlistSchema = new mongoose.Schema(
  {
    guest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Guest',
      required: true,
    },
    preferredType: {
      type: String,
      enum: ['Standard', 'Deluxe', 'Suite', 'Presidential', 'Any'],
      default: 'Any',
    },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    status: {
      type: String,
      enum: ['Waiting', 'Notified', 'Booked', 'Cancelled'],
      default: 'Waiting',
    },
    notes: { type: String, trim: true },
    numberOfGuests: { type: Number, default: 1, min: 1 },
  },
  { timestamps: true }
);

waitlistSchema.pre('validate', function (next) {
  if (this.checkIn && this.checkOut && this.checkOut <= this.checkIn) {
    this.invalidate('checkOut', 'Check-out must be after check-in');
  }
  next();
});

module.exports = mongoose.model('Waitlist', waitlistSchema);
