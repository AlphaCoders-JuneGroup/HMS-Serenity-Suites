const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema(
  {
    openedAt: { type: Date, required: true, default: Date.now },
    closedAt: { type: Date, default: null },
    openedBy: { type: String, default: '' },
    closedBy: { type: String, default: '' },
    openingCash: { type: Number, default: 0 },
    closingCash: { type: Number, default: 0 },
    expectedCash: { type: Number, default: 0 },
    cardTotal: { type: Number, default: 0 },
    roomChargeTotal: { type: Number, default: 0 },
    orderCount: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    status: {
      type: String,
      enum: ['Open', 'Closed'],
      default: 'Open',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RestaurantShift', shiftSchema);
