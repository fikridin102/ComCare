const multer = require('multer');
const path = require('path');

// Configure storage for announcements
const announcementStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/announcements');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

// Configure storage for profile pictures
const profileStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/profiles');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Not an image! Please upload an image.'), false);
    }
};

// Create multer upload instances
const uploadAnnouncement = multer({
    storage: announcementStorage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

const uploadProfile = multer({
    storage: profileStorage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024 // 2MB limit
    }
});

module.exports = {
    uploadAnnouncement,
    uploadProfile
}; 