// walletModel.js
const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  student_id: { type: String, required: true, unique: true },
  amount: { type: Number, required: true, default: 0 },
  remark: { type: String },
  date: { type: Date, default: Date.now }
});

const Wallet = mongoose.model('Wallet', walletSchema, 'wallet_table');

module.exports = Wallet;
