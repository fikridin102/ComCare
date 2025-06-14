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
        required: function() { return this.isHeir; }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Middleware to ensure only one heir per member
dependantSchema.pre('save', async function(next) {
    if (this.isHeir) {
        // Find any existing heir for this member
        const existingHeir = await this.constructor.findOne({
            memberId: this.memberId,
            isHeir: true,
            _id: { $ne: this._id } // Exclude current document if it exists
        });

        if (existingHeir) {
            // If this is a new heir, throw an error
            if (this.isNew) {
                throw new Error('A member can only have one heir');
            }
            // If this is an update to an existing dependant, remove heir status from the other dependant
            existingHeir.isHeir = false;
            existingHeir.heirEmail = undefined;
            await existingHeir.save();
        }
    }
    next();
});

module.exports = mongoose.model('Dependant', dependantSchema);