const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../../DbModels/ModelStudentdetails');
const Translog = require('../../DbModels/ModelTransaction');

// Environment secret key for JWT
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";  // Use environment variable in production


// Middleware to verify JWT
const verifyToken = (req, res, next) => {
  const token = req.header('x-auth-token');

  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};




// GET all students
router.get('/', async (req, res) => {
  try {
    const students = await User.find().select('-s_password');
    res.json(students);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});


// POST login route
router.post('/login', async (req, res) => {
  const { s_email, s_password } = req.body;

  // Check if user didn't send any data
  if (!s_email || !s_password) {
    return res.status(400).json({ msg: 'Please provide both email and password' });
  }

  try {
    // Check if the user exists
    const user = await User.findOne({ s_email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid email or password' });
    }

    // Check if the password matches
    if (user.s_password !== s_password) {
      return res.status(400).json({ msg: 'Invalid email or password' });
    }

    // Create and sign the JWT
    const payload = {
      user: {
        id: user._id,
        rollno: user.s_rollno
      }
    };

    // JWT expires in one week
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    // Send the token back to the client
    res.json({ token });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});


// GET student details using JWT
router.get('/getdetails', verifyToken, async (req, res) => {
  try {
    const student = await User.findById(req.user.id).select('-s_password');
    
    if (!student) {
      return res.status(404).json({ msg: 'Student not found' });
    }

    res.json(student);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});



router.get('/getlog', verifyToken, async (req, res) => {
  try {
    // // First, find the student using the ID from the JWT
    // const student = await User.findById(req.user.id);
    
    // if (!student) {
    //   return res.status(404).json({ msg: 'Student not found' });
    // }
  
    // Use the student's roll number to fetch the transaction log
    const logs = await Translog.find({ student_id: req.user.rollno })
      .select('dt_ct transiction_id date remarks') // Include fields you want to return
      .sort({ date: -1 }); // Sort by date in descending order (most recent first)
   
    if (logs.length === 0) {
      return res.status(404).json({ msg: 'No transaction data found' });
    }

    res.json(logs);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});
module.exports = router;