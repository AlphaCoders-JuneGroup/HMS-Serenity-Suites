const mongoose = require('mongoose');

const serviceItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1, default: 1 },
  },
  { _id: true }
);

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

const eventSchema = new mongoose.Schema(
  {
    eventTitle: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
    },
    eventType: {
      type: String,
      enum: [
        'Wedding',
        'Conference',
        'Corporate Meeting',
        'Birthday Party',
        'Seminar',
        'Exhibition',
        'Other',
      ],
      default: 'Other',
    },
    hall: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EventHall',
      required: [true, 'Hall is required'],
    },

    // Customer info — event customers are not always registered hotel guests
    customerName: { type: String, required: [true, 'Customer name is required'], trim: true },
    customerEmail: { type: String, trim: true, lowercase: true, default: '' },
    customerPhone: { type: String, required: [true, 'Customer phone is required'], trim: true },
    organization: { type: String, trim: true, default: '' },
    guest: { type: mongoose.Schema.Types.ObjectId, ref: 'Guest', default: null },

    eventDate: {
      type: Date,
      required: [true, 'Event date is required'],
    },
    startTime: {
      type: String, // "HH:mm" 24-hour format
      required: [true, 'Start time is required'],
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
    },
    expectedGuests: {
      type: Number,
      min: 1,
      default: 1,
    },

    status: {
      type: String,
      enum: ['Inquiry', 'Confirmed', 'Ongoing', 'Completed', 'Cancelled'],
      default: 'Inquiry',
    },

    services: {
      type: [serviceItemSchema],
      default: [],
    },

    hallCharge: { type: Number, min: 0, default: 0 },
    servicesTotal: { type: Number, min: 0, default: 0 },
    discountPercent: { type: Number, min: 0, max: 100, default: 0 },
    taxPercent: { type: Number, min: 0, max: 100, default: 0 },
    totalAmount: { type: Number, required: true, min: 0, default: 0 },

    amountPaid: { type: Number, min: 0, default: 0 },
    payments: [paymentSchema],
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Partial', 'Paid', 'Refunded'],
      default: 'Pending',
    },

    specialRequests: { type: String, trim: true, default: '' },
    notes: [noteSchema],

    assignedCoordinator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    cancellationReason: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

// endTime must be after startTime (simple "HH:mm" string comparison works lexically)
eventSchema.pre('validate', function (next) {
  if (this.startTime && this.endTime && this.endTime <= this.startTime) {
    this.invalidate('endTime', 'End time must be after start time');
  }
  next();
});

eventSchema.index({ hall: 1, eventDate: 1, status: 1 });

module.exports = mongoose.model('Event', eventSchema);
