const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const RestaurantTable = require('./models/RestaurantTable');

const tables = [
  {
    tableNumber: 'T1',
    capacity: 2,
    location: 'Window',
    image: '/uploads/table-images/t1-window.jpg',
  },
  {
    tableNumber: 'T2',
    capacity: 4,
    location: 'Main Hall',
    image: '/uploads/table-images/t2-hall.jpg',
  },
  {
    tableNumber: 'T3',
    capacity: 4,
    location: 'Main Hall',
    image: '/uploads/table-images/t3-hall.jpg',
  },
  {
    tableNumber: 'T4',
    capacity: 6,
    location: 'Patio',
    image: '/uploads/table-images/t4-patio.jpg',
  },
  {
    tableNumber: 'T5',
    capacity: 8,
    location: 'Private',
    image: '/uploads/table-images/t5-private.jpg',
  },
];

async function seed() {
  await connectDB();
  for (const t of tables) {
    const existing = await RestaurantTable.findOne({ tableNumber: t.tableNumber });
    if (existing) {
      existing.capacity = t.capacity;
      existing.location = t.location;
      existing.image = t.image;
      await existing.save();
      console.log('Updated', t.tableNumber);
      continue;
    }
    await RestaurantTable.create(t);
    console.log('Created', t.tableNumber);
  }
  await mongoose.disconnect();
  console.log('Tables seeded.');
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
