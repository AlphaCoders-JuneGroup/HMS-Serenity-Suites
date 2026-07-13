/**
 * seedRooms.js — Seeds sample hotel rooms for booking demos.
 * Run: node seedRooms.js
 */
require('dotenv').config();
const Room = require('./models/Room');
const connectDB = require('./config/db');

const rooms = [
  {
    roomNumber: '101',
    type: 'Standard',
    price: 15000,
    capacity: 2,
    floor: 1,
    status: 'Available',
    amenities: ['WiFi', 'AC', 'TV'],
    description: 'Comfortable standard room with city view',
  },
  {
    roomNumber: '102',
    type: 'Standard',
    price: 15000,
    capacity: 2,
    floor: 1,
    status: 'Available',
    amenities: ['WiFi', 'AC', 'TV'],
  },
  {
    roomNumber: '201',
    type: 'Deluxe',
    price: 25000,
    capacity: 3,
    floor: 2,
    status: 'Available',
    amenities: ['WiFi', 'AC', 'TV', 'Mini Bar'],
  },
  {
    roomNumber: '202',
    type: 'Deluxe',
    price: 25000,
    capacity: 3,
    floor: 2,
    status: 'Available',
    amenities: ['WiFi', 'AC', 'TV', 'Mini Bar', 'Balcony'],
  },
  {
    roomNumber: '301',
    type: 'Suite',
    price: 45000,
    capacity: 4,
    floor: 3,
    status: 'Available',
    amenities: ['WiFi', 'AC', 'TV', 'Mini Bar', 'Jacuzzi'],
  },
  {
    roomNumber: '401',
    type: 'Presidential',
    price: 85000,
    capacity: 4,
    floor: 4,
    status: 'Available',
    amenities: ['WiFi', 'AC', 'TV', 'Mini Bar', 'Jacuzzi', 'Butler'],
  },
];

const seed = async () => {
  await connectDB();
  console.log('\n🌱 Seeding rooms...\n');

  let created = 0;
  let skipped = 0;

  for (const room of rooms) {
    const existing = await Room.findOne({ roomNumber: room.roomNumber });
    if (existing) {
      console.log(`  ⏭️  Skipped  — Room ${room.roomNumber}`);
      skipped++;
    } else {
      await Room.create(room);
      console.log(`  ✅ Created  — Room ${room.roomNumber} [${room.type}]`);
      created++;
    }
  }

  console.log(`\n✨ Done! ${created} created, ${skipped} skipped.\n`);
  process.exit(0);
};

seed().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
