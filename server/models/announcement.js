const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
    announcementId: {
        type: String,
        required: true,
        unique: true
    },
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    image: {
        type: String,  // Store the image path
        required: false
    },
    date: {
        type: Date,
        default: Date.now
    }
});

// Static method to generate announcementId
announcementSchema.statics.generateAnnouncementId = async function() {
    const latestAnnouncement = await this.findOne({}, {}, { sort: { 'announcementId': -1 } });
    let newId = 'AN001'; // Default if no announcements exist
    
    if (latestAnnouncement && latestAnnouncement.announcementId) {
        const lastNumber = parseInt(latestAnnouncement.announcementId.slice(2));
        const nextNumber = lastNumber + 1;
        newId = 'AN' + String(nextNumber).padStart(3, '0');
    }
    
    return newId;
};

module.exports = mongoose.model('Announcement', announcementSchema); 