const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../../DbModels/ModelStudentdetails');
const Translog = require('../../DbModels/ModelTransaction');
const Wallet = require('../../DbModels/ModelWallet');

// Environment secret key for JWT
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";  // Use environment variable in production

// POST transaction route
router.post('/dtTransaction', async (req, res) => {
  const { studentId, meal, amount } = req.body;

  // Input validation
  if (!studentId || !meal || !amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ msg: 'Please provide valid studentId, meal, and a positive amount' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Check if the wallet exists and has sufficient balance
    const existingWallet = await Wallet.findOne({ studentId }).session(session);
    if (!existingWallet) {
      throw new Error('Wallet not found');
    }
    if (existingWallet.amount < amount) {
      throw new Error('Insufficient balance');
    }

    // Update wallet
    const updatedWallet = await Wallet.findOneAndUpdate(
      { studentId },
      {
        $inc: { amount: -amount },
        $set: { 
          date: new Date(),
          remark: meal
        }
      },
      { new: true, session }
    );

    // Create log entry
    const log = new Translog({
      student_id: studentId,
      dt_ct: 'dt',
      transaction_id: `${studentId}-UHFTA-${new mongoose.Types.ObjectId()}`,
      amount,
      date: new Date(),
      remarks: meal
    });
    await log.save({ session });

    await session.commitTransaction();
    res.status(200).json({ message: 'Transaction successful', wallet: updatedWallet, log });
  } catch (err) {
    await session.abortTransaction();
    console.error(err.message);
    res.status(400).json({ msg: err.message });
  } finally {
    session.endSession();
  }
});

module.exports = router;