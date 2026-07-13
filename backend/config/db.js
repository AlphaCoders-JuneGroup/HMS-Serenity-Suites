const dns = require('dns');
const mongoose = require('mongoose');

dns.setDefaultResultOrder('ipv4first');

const DB_NAME = 'serenity_suites';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.name}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    if (error.message.includes('querySrv')) {
      console.error(
        'Tip: Use a direct mongodb:// connection string instead of mongodb+srv:// if SRV DNS lookup fails.'
      );
    }
    process.exit(1);
  }
};

module.exports = connectDB;
