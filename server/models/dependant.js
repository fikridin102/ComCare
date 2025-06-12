const mongoose = require('mongoose');

const dependantSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    ic: {
        type: String,
        required: true,
        unique: true
    },
    birthday: {
        type: Date,
        required: true
    },
    age: {
        type: Number,
        required: true
    },
    gender: {
        type: String,
        required: true,
        enum: ['Male', 'Female']
    },
    relationship: {
        type: String,
        required: true
    },
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    memberName: {
        type: String,
        required: true
    },
    isHeir: {
        type: Boolean,
        default: false
    },
    heirEmail: {
        type: String,
        match: [/^[\w-]+(?:\.[\w-]+)*@(?:[\w-]+\.)+[a-zA-Z]{2,7}$/, 'Please fill a valid email address'],
        required: function() { return this.isHeir; } // Required only if isHeir is true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Dependant', dependantSchema);