const dns = require('dns');
if (process.env.NODE_ENV !== 'production') {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
}

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const roomRoutes = require('./routes/roomRoutes');
const roomTypeRoutes = require('./routes/roomTypeRoutes');
const guestRoutes = require('./routes/guestRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const restaurantRoutes = require('./routes/restaurantRoutes');
const eventRoutes = require('./routes/eventRoutes');
const billingRoutes = require('./routes/billingRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

connectDB().then(async () => {
  try {
    const RoomType = require('./models/RoomType');
    const count = await RoomType.countDocuments();
    if (count === 0) {
      const defaultRoomTypes = [
        {
          name: 'Standard',
          description: 'Comfortable standard room with city view',
          basePrice: 15000,
          capacity: 2,
          amenities: ['WiFi', 'AC', 'TV'],
        },
        {
          name: 'Deluxe',
          description: 'Spacious room with modern amenities and scenic balcony',
          basePrice: 25000,
          capacity: 3,
          amenities: ['WiFi', 'AC', 'TV', 'Mini Bar', 'Balcony'],
        },
        {
          name: 'Suite',
          description: 'Luxurious suite featuring a separate living room and jacuzzi',
          basePrice: 45000,
          capacity: 4,
          amenities: ['WiFi', 'AC', 'TV', 'Mini Bar', 'Jacuzzi'],
        },
        {
          name: 'Presidential',
          description: 'The ultimate luxury experience with premium amenities and dedicated butler service',
          basePrice: 85000,
          capacity: 4,
          amenities: ['WiFi', 'AC', 'TV', 'Mini Bar', 'Jacuzzi', 'Butler'],
        },
      ];
      await RoomType.insertMany(defaultRoomTypes);
      console.log('🌱 Seeded default Room Types successfully!');
    }
  } catch (err) {
    console.error('❌ Failed to seed Room Types on startup:', err.message);
  }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(require('path').join(__dirname, 'uploads')));
app.use(
  '/menu',
  express.static(require('path').join(__dirname, '..', 'frontend', 'public', 'menu'))
);
app.use(
  '/table',
  express.static(require('path').join(__dirname, '..', 'frontend', 'public', 'table'))
);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'HMS Serenity Suites API is running',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/room-types', roomTypeRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/restaurant', restaurantRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/billing', billingRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
