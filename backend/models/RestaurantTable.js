const mongoose = require('mongoose');

const restaurantTableSchema = new mongoose.Schema(
  {
    tableNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    capacity: { type: Number, default: 4, min: 1 },
    status: {
      type: String,
      enum: ['Available', 'Occupied', 'Reserved', 'Cleaning'],
      default: 'Available',
    },
    location: { type: String, default: 'Main Hall', trim: true },
    image: { type: String, default: '', trim: true },
    currentOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RestaurantOrder',
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RestaurantTable', restaurantTableSchema);
