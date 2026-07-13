const mongoose = require('mongoose');

const SRI_LANKAN_PHONE = /^0\d{9}$/;

const guestSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      validate: {
        validator(value) {
          return SRI_LANKAN_PHONE.test(String(value || ''));
        },
        message: 'Please enter a valid phone number.',
      },
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
    },
    idType: {
      type: String,
      enum: ['Passport', 'National ID', 'Driving License'],
    },
    idNumber: String,
    nationality: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Guest', guestSchema);
