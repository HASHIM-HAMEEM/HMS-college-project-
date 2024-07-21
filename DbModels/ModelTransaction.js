
// transactionModel.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  student_id: { type: String, required: true },
  dt_ct: { type: String, required: true, enum: ['dt', 'ct'] },
  transiction_id: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  remarks: { type: String }
});

const Transaction = mongoose.model('Transaction', transactionSchema, 'transaction_log');

module.exports = Transaction;