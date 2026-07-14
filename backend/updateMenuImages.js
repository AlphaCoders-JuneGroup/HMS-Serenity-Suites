/**
 * Point menu items at backend-served images.
 * Run: node updateMenuImages.js
 */
require('dotenv').config();
const MenuItem = require('./models/MenuItem');
const connectDB = require('./config/db');

const map = {
  Cappuccino: '/uploads/menu-images/cappuccino.jpg',
  'Fresh Lime Juice': '/uploads/menu-images/fresh-lime-juice.jpg',
  'Chocolate Brownie': '/uploads/menu-images/chocolate-brownie.jpg',
  'Ceylon Breakfast': '/uploads/menu-images/ceylon-breakfast.jpg',
  'Chicken Fried Rice': '/uploads/menu-images/chicken-fried-rice.jpg',
  'Club Sandwich': '/uploads/menu-images/club-sandwich.jpg',
  'Chef Special Curry': '/uploads/menu-images/chef-special-curry.jpg',
};

async function run() {
  await connectDB();
  for (const [name, image] of Object.entries(map)) {
    const result = await MenuItem.findOneAndUpdate({ name }, { image }, { new: true });
    console.log(result ? `Updated ${name} → ${image}` : `Missing ${name}`);
  }
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
