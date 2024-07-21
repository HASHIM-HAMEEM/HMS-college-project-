// mongoose-connect.js
const mongoose = require('mongoose');
require('dotenv').config();

const connectToDatabase = async () => {
  try {
    await mongoose.connect(`mongodb://localhost:27017/${process.env.DB_NAME}`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB using Mongoose');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

module.exports = connectToDatabase;