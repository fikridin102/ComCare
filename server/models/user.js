const { type } = require("express/lib/response");
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    customId: {
        type: String,
        required: true,
        unique: true,
    },

    fullname:{
        type: String,
        required: true,
    },
    username: { 
        type: String, 
        required: true, 
        unique: true 
    },
    email: { 
        type: String, 
        required: true, 
        unique: true 
    },
    icNum: { 
        type: String, 
        required: true, 
        unique: true 
    },
    birthDate: { 
        type: Date, 
        required: true 
    },
    age: { 
        type: Number, 
        required: true 
    },
    address: { 
        type: String, 
        required: true 
    },
    phoneNum: { 
        type: String, 
        required: true 
    },
    password: { 
        type: String, 
        required: true 
    },
    userType: { 
        type: String, 
        required: true 
    },
    status: { 
        type: String, 
        required: true 
    },
    isActive: {
        type: Boolean,
        default: true
    },
    profilePicture: {
        type: String,
        default: '/assets/images/user.png'
    },
    resetPasswordToken: {
        type: String
    },
    resetPasswordExpires: {
        type: Date
    }
}, { timestamps: true });

const User = mongoose.model("User", UserSchema);
module.exports = User; // ✅ Now using CommonJS
