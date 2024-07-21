const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
    
    },
    password: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true,
      
    },
    status: {
        type: String,

        default: 'active'
    }
}, {
   
});

const Admin = mongoose.model('admins', UserSchema);

module.exports = Admin;
