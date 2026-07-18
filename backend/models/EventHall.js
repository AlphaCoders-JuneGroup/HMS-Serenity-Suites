const mongoose = require('mongoose');

const eventHallSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Hall name is required'],
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['Banquet Hall', 'Conference Room', 'Meeting Room', 'Garden / Outdoor', 'Rooftop'],
      default: 'Banquet Hall',
    },
    capacity: {
      type: Number,
      required: [true, 'Capacity is required'],
      min: [1, 'Capacity must be at least 1'],
    },
    ratePerHour: {
      type: Number,
      required: [true, 'Rate per hour is required'],
      min: 0,
    },
    ratePerDay: {
      type: Number,
      min: 0,
      default: 0,
    },
    amenities: {
      type: [String],
      default: [],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    image: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EventHall', eventHallSchema);
