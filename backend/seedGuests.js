const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Guest = require('./models/Guest');

const guests = [
  {
    firstName: 'Kasun',
    lastName: 'Perera',
    email: 'kasun.perera@example.com',
    phone: '0771112233',
    nationality: 'Sri Lankan',
    loyaltyTier: 'VIP',
    idType: 'National ID',
    idNumber: '199012345678',
    address: { city: 'Colombo', country: 'Sri Lanka' },
    preferences: { preferredRoomType: 'Deluxe', dietaryNeeds: 'Vegetarian' },
    marketingOptIn: true,
    dateOfBirth: new Date('1990-07-14'),
  },
  {
    firstName: 'Nimali',
    lastName: 'Fernando',
    email: 'nimali.f@example.com',
    phone: '0772223344',
    nationality: 'Sri Lankan',
    loyaltyTier: 'Regular',
    idType: 'Passport',
    idNumber: 'N1234567',
    address: { city: 'Kandy', country: 'Sri Lanka' },
    emergencyContact: { name: 'Sunil Fernando', phone: '0779998877', relation: 'Spouse' },
  },
  {
    firstName: 'James',
    lastName: 'Wilson',
    email: 'james.wilson@corp.com',
    phone: '0773334455',
    nationality: 'British',
    loyaltyTier: 'Corporate',
    idType: 'Passport',
    idNumber: 'GB998877',
    address: { city: 'London', country: 'UK' },
    company: { name: 'Wilson Tech Ltd', billingEmail: 'billing@wilsontech.com' },
    preferences: { preferredRoomType: 'Suite', pillowType: 'Soft' },
  },
  {
    firstName: 'Ayesha',
    lastName: 'Khan',
    email: 'ayesha.khan@example.com',
    phone: '0774445566',
    nationality: 'Pakistani',
    loyaltyTier: 'Regular',
    idType: 'Passport',
    idNumber: 'PK556677',
    anniversary: new Date('2018-07-14'),
  },
];

async function seed() {
  await connectDB();
  for (const g of guests) {
    const existing = await Guest.findOne({ email: g.email });
    if (existing) {
      console.log(`Skip existing: ${g.email}`);
      continue;
    }
    await Guest.create(g);
    console.log(`Created: ${g.firstName} ${g.lastName}`);
  }
  await mongoose.disconnect();
  console.log('Guest seed done.');
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
