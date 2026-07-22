const mongoose = require('mongoose');

const SRI_LANKAN_PHONE = /^0\d{9}$/;

const noteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    authorName: String,
    at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const documentSchema = new mongoose.Schema(
  {
    originalName: String,
    path: String,
    mimeType: String,
    label: { type: String, default: 'ID' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const communicationSchema = new mongoose.Schema(
  {
    channel: { type: String, enum: ['email', 'sms'], default: 'email' },
    subject: String,
    message: String,
    simulated: { type: Boolean, default: true },
    at: { type: Date, default: Date.now },
    sentBy: String,
  },
  { _id: true }
);

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

    // Loyalty / VIP
    loyaltyTier: {
      type: String,
      enum: ['Regular', 'VIP', 'Corporate'],
      default: 'Regular',
    },

    // Preferences
    preferences: {
      preferredRoomType: {
        type: String,
        enum: ['', 'Standard', 'Deluxe', 'Suite', 'Presidential'],
        default: '',
      },
      pillowType: String,
      dietaryNeeds: String,
      specialNeeds: String,
      other: String,
    },

    // Blacklist
    isBlacklisted: { type: Boolean, default: false },
    blacklistReason: { type: String, default: '' },

    // Emergency contact
    emergencyContact: {
      name: String,
      phone: String,
      relation: String,
    },

    // Corporate
    company: {
      name: String,
      billingEmail: String,
      taxId: String,
    },

    // Soft delete / archive
    isArchived: { type: Boolean, default: false },
    archivedAt: Date,

    // Consent
    marketingOptIn: { type: Boolean, default: false },
    dataProcessingConsent: { type: Boolean, default: true },

    // Dates
    dateOfBirth: Date,
    anniversary: Date,

    // Photo
    photo: {
      originalName: String,
      path: String,
      mimeType: String,
      uploadedAt: Date,
    },

    notes: [noteSchema],
    documents: [documentSchema],
    communications: [communicationSchema],
  },
  { timestamps: true }
);

guestSchema.index({ firstName: 1, lastName: 1 });
guestSchema.index({ loyaltyTier: 1, isBlacklisted: 1, isArchived: 1 });

module.exports = mongoose.model('Guest', guestSchema);
