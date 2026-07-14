const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    roomNumber: {
      type: String,
      required: [true, 'Room number is required'],
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      required: [true, 'Room type is required'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: 0,
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
    },
    amenities: [String],
    status: {
      type: String,
      enum: ['Available', 'Booked', 'Occupied', 'Cleaning', 'Maintenance', 'Reserved'],
      default: 'Available',
    },
    floor: {
      type: Number,
      required: true,
    },
    description: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Room', roomSchema);
