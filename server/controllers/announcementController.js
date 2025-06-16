const Announcement = require('../models/announcement');
const fs = require('fs');

exports.getAdminAnnouncement = async (req, res) => {
    try {
        const announcements = await Announcement.find().sort({ date: -1 });
        
        res.render('adminAnnouncement', {
            announcements,
            messages: {
                error: req.flash('error'),
                success: req.flash('success')
            },
            csrfToken: req.csrfToken(),
            user: req.session.user
        });
    } catch (error) {
        console.error('Error fetching announcements:', error);
        req.flash('error', 'Error fetching announcements');
        res.redirect('/admindashboard');
    }
};

exports.postAdminAnnouncement = async (req, res) => {
    try {
        console.log("Received announcement data:", req.body);
        const { title, content } = req.body;
        
        // Validate required fields
        if (!title || !content) {
            req.flash("error", "Please fill in all required fields");
            return res.redirect("/adminannouncement");
        }

        // Generate announcementId
        const announcementId = await Announcement.generateAnnouncementId();

        // Create new announcement
        const newAnnouncement = new Announcement({
            announcementId,
            title: title.trim(),
            content: content.trim(),
            image: req.file ? `/uploads/announcements/${req.file.filename}` : null,
            date: new Date()
        });

        console.log("Creating new announcement:", newAnnouncement);
        
        // Save the announcement
        const savedAnnouncement = await newAnnouncement.save();
        console.log("Announcement saved successfully:", savedAnnouncement);
        
        req.flash("success", "Announcement added successfully!");
        res.redirect("/adminannouncement");
    } catch (error) {
        console.error("Error adding announcement:", error);
        // If there's an error and a file was uploaded, delete it
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting file:', err);
            });
        }
        req.flash("error", "Error adding announcement. Please try again.");
        res.redirect("/adminannouncement");
    }
};

exports.editAnnouncement = async (req, res) => {
    try {
        console.log("Received announcement data (edit):", req.body);
        const { title, content } = req.body;
        const imagePath = req.file ? '/uploads/announcements/' + req.file.filename : undefined;

        const updateData = {
            title,
            content
        };

        if (imagePath) {
            updateData.image = imagePath;
        }

        await Announcement.findByIdAndUpdate(req.params.id, updateData);

        req.flash('success', 'Announcement updated successfully');
        res.redirect('/adminannouncement');
    } catch (error) {
        console.error('Error updating announcement:', error);
        req.flash('error', 'Error updating announcement');
        res.redirect('/adminannouncement');
    }
};

exports.deleteAnnouncement = async (req, res) => {
    try {
        await Announcement.findByIdAndDelete(req.params.id);

        req.flash('success', 'Announcement deleted successfully');
        res.redirect('/adminannouncement');
    } catch (error) {
        console.error('Error deleting announcement:', error);
        req.flash('error', 'Error deleting announcement');
        res.redirect('/adminannouncement');
    }
};

// Public API
exports.getLatestAnnouncement = async (req, res) => {
    try {
        const latestAnnouncement = await Announcement.findOne().sort({ date: -1 });
        res.json(latestAnnouncement);
    } catch (error) {
        console.error('Error fetching latest announcement:', error);
        res.status(500).json({ error: 'Error fetching latest announcement' });
    }
};

exports.getAllAnnouncements = async (req, res) => {
    try {
        const announcements = await Announcement.find().sort({ date: -1 });
        res.json(announcements);
    } catch (error) {
        console.error('Error fetching announcements:', error);
        res.status(500).json({ error: 'Error fetching announcements' });
    }
};

exports.createAnnouncement = async (req, res) => {
    try {
        const { title, content } = req.body;
        
        // Validate required fields
        if (!title || !content) {
            return res.status(400).json({ error: "Please fill in all required fields" });
        }

        // Generate announcementId
        const announcementId = await Announcement.generateAnnouncementId();

        // Create new announcement
        const newAnnouncement = new Announcement({
            announcementId,
            title: title.trim(),
            content: content.trim(),
            image: req.file ? `/uploads/announcements/${req.file.filename}` : null,
            date: new Date()
        });

        const savedAnnouncement = await newAnnouncement.save();
        res.status(201).json(savedAnnouncement);
    } catch (error) {
        console.error("Error creating announcement:", error);
        // If there's an error and a file was uploaded, delete it
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting file:', err);
            });
        }
        res.status(500).json({ error: "Error creating announcement" });
    }
};
