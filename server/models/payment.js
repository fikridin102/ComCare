const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    paymentDate: {
        type: Date,
        default: Date.now
    },
    dueDate: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Paid', 'Overdue'],
        default: 'Pending'
    },
    warningCount: {
        type: Number,
        default: 0
    },
    lastWarningDate: {
        type: Date
    },
    paymentMethod: {
        type: String,
        required: true
    },
    referenceNumber: {
        type: String,
        required: true
    },
    paymentType: {
        type: String,
        enum: ['khairat', 'maintenance'],
        required: true
    },
    paymentIntentId: {
        type: String
    },
    dependantsCount: {
        type: Number,
        required: true
    },
    selectedNames: [{
        name: String,
        type: {
            type: String,
            enum: ['member', 'dependant']
        },
        id: mongoose.Schema.Types.ObjectId
    }]
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema); 