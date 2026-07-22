const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Menu item name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    category: {
      type: String,
      enum: ['Food', 'Beverage', 'Dessert', 'Special', 'Combo'],
      required: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: 0,
    },
    happyHourPrice: {
      type: Number,
      min: 0,
      default: null,
    },
    happyHourStart: { type: Number, min: 0, max: 23, default: 17 },
    happyHourEnd: { type: Number, min: 0, max: 23, default: 19 },
    available: {
      type: Boolean,
      default: true,
    },
    stock: {
      type: Number,
      default: null, // null = unlimited
      min: 0,
    },
    preparationTime: {
      type: Number,
      default: 15,
      min: 0,
    },
    isCombo: { type: Boolean, default: false },
    comboItemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' }],
    allergens: { type: String, default: '' },
    image: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MenuItem', menuItemSchema);
