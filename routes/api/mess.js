const express = require('express');
const router = express.Router();
const User = require('../../DbModels/ModelStudentdetails');
const Transaction= require('../../DbModels/ModelTransaction');
const Wallet = require('../../DbModels/ModelWallet');
var uuid = require("uuid");
// Environment secret key for JWT
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";  // Use environment variable in production

// POST transaction route
router.post('/dtTransaction', async (req, res) => {
  try {
    const { studentId, meal, amount } = req.body;
console.log(req.body)
    // Basic validation
    if (!studentId || !meal || !amount) {
      return res.status(400).json({ msg: 'Please provide studentId, meal, and amount' });
    }

    // Find and update wallet in one operation
    const wallet = await Wallet.findOneAndUpdate(
      { student_id: studentId },
      {
        $inc: { amount: -amount },
        date: new Date(),
        remark: meal
      },
      { new: true }
    );

    // Check if wallet exists
    if (!wallet) {
      return res.status(404).json({ msg: 'Wallet not found' });
    }
    const Tid = uuid.v4();

    // Create transaction log
    const log = await Transaction.create({
      student_id: studentId,
      dt_ct: 'dt',
      transiction_id: `${studentId}-UHFTA-${Tid}`,
      amount: amount,
      date: new Date(),
      remarks: meal
    });

    // Send success response
    return res.status(200).json({
      message: 'Transaction successful',
      wallet,
      log
    });

  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

module.exports = router;

