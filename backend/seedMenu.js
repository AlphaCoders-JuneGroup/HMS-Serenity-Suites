/**
 * seedMenu.js — Seeds sample restaurant menu items.
 * Run: node seedMenu.js
 */
require('dotenv').config();
const MenuItem = require('./models/MenuItem');
const connectDB = require('./config/db');

const items = [
  { name: 'Ceylon Breakfast', description: 'Eggs, toast, fruit & tea', category: 'Food', price: 2500, preparationTime: 20 },
  { name: 'Chicken Fried Rice', description: 'Wok-fried rice with chicken', category: 'Food', price: 2200, preparationTime: 25 },
  { name: 'Club Sandwich', description: 'Triple-decker with fries', category: 'Food', price: 1800, preparationTime: 15 },
  { name: 'Fresh Lime Juice', description: 'Chilled lime cooler', category: 'Beverage', price: 600, preparationTime: 5 },
  { name: 'Cappuccino', description: 'Espresso with steamed milk', category: 'Beverage', price: 750, preparationTime: 8 },
  { name: 'Chocolate Brownie', description: 'Warm brownie with ice cream', category: 'Dessert', price: 1200, preparationTime: 10 },
  { name: 'Chef Special Curry', description: 'Daily seafood curry with rice', category: 'Special', price: 3200, preparationTime: 30 },
];

const seed = async () => {
  await connectDB();
  console.log('\n🌱 Seeding restaurant menu...\n');
  let created = 0;
  let skipped = 0;

  for (const item of items) {
    const existing = await MenuItem.findOne({ name: item.name });
    if (existing) {
      console.log(`  ⏭️  Skipped — ${item.name}`);
      skipped++;
    } else {
      await MenuItem.create(item);
      console.log(`  ✅ Created — ${item.name}`);
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
