/**
 * seedUsers.js — Seeds all hotel staff users with their respective roles.
 * Run: node seedUsers.js
 *
 * Users created (password for all: password123):
 *  Admin              → admin@serenity.com
 *  Manager            → manager@serenity.com
 *  Receptionist       → reception@serenity.com
 *  Housekeeping Mgr   → housekeeping@serenity.com
 *  Restaurant Staff   → restaurant@serenity.com
 *  Event Coordinator  → events@serenity.com
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const connectDB = require('./config/db');

const users = [
  {
    name: 'James Anderson',
    email: 'admin@serenity.com',
    password: 'password123',
    role: 'Admin',
    phone: '0771234567',
    isActive: true,
  },
  {
    name: 'Sarah Mitchell',
    email: 'manager@serenity.com',
    password: 'password123',
    role: 'Manager',
    phone: '0772345678',
    isActive: true,
  },
  {
    name: 'Daniel Carter',
    email: 'reception@serenity.com',
    password: 'password123',
    role: 'Receptionist',
    phone: '0773456789',
    isActive: true,
  },
  {
    name: 'Emily Thompson',
    email: 'housekeeping@serenity.com',
    password: 'password123',
    role: 'Housekeeping Manager',
    phone: '0774567890',
    isActive: true,
  },
  {
    name: 'Michael Roberts',
    email: 'restaurant@serenity.com',
    password: 'password123',
    role: 'Restaurant Staff',
    phone: '0775678901',
    isActive: true,
  },
  {
    name: 'Olivia Bennett',
    email: 'events@serenity.com',
    password: 'password123',
    role: 'Event Coordinator',
    phone: '0776789012',
    isActive: true,
  },

];


const seed = async () => {
  await connectDB();
  console.log('\n🌱 Seeding hotel staff users...\n');

  let created = 0;
  let skipped = 0;

  for (const userData of users) {
    const existing = await User.findOne({ email: userData.email });
    if (existing) {
      console.log(`  ⏭️  Skipped  — ${userData.email} (already exists)`);
      skipped++;
    } else {
      await User.create(userData);
      console.log(`  ✅ Created  — ${userData.email} [${userData.role}]`);
      created++;
    }
  }

  console.log(`\n✨ Done! ${created} user(s) created, ${skipped} skipped.\n`);
  console.log('─────────────────────────────────────────────────────');
  console.log('  Role               | Email                          | Password');
  console.log('─────────────────────────────────────────────────────');
  users.forEach((u) => {
    console.log(`  ${u.role.padEnd(20)}| ${u.email.padEnd(31)} | ${u.password}`);
  });
  console.log('─────────────────────────────────────────────────────');
  console.log('  ⚠️  Change all passwords after first login!\n');

  process.exit(0);
};

seed().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
