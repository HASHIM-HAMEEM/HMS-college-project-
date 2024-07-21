// studentdetails.js
const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  s_name: { type: String, required: true },
  s_status: { type: String, default: 'active' },
  s_email: { type: String, required: true },
  s_address: { type: String, required: true },
  s_phone: { type: String, required: true },
  s_dob: { type: String, required: true },
  s_roomNo: { type: String, required: true },
  s_parantage: { type: String, required: true },
  s_photo: { type: String, required: true },
  s_password: { type: String, required: true },
  s_approved: { type: String, default: 'approved' },
  s_pincode: { type: String, required: true },
  s_rollno: { type: String, required: true, unique: true },
  s_dateadm: { type: String, required: true }
});

const Student = mongoose.model('studentdetails', studentSchema);

module.exports = Student;