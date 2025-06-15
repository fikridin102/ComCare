const Event = require('../models/event');

// Get all events (admin view)
exports.getEventList = async (req, res) => {
    try {
        let events = await Event.find().sort({ date: 1 });
        if (events.length === 0) {
            const sampleEvent = new Event({
                eventId: 'E001',
                name: 'Annual Gala',
                venue: 'Grand Hall',
                date: new Date('2025-06-15'),
                time: '19:00',
                budget: 5000,
                remarks: 'Formal attire required'
            });
            await sampleEvent.save();
            events = await Event.find().sort({ date: 1 });
        }
        res.render("adminEvent", {
            events: events || [],
            eventsJson: JSON.stringify(events || []),
            user: req.session.user
        });
    } catch (err) {
        console.error("Error fetching events:", err);
        req.flash("error", "Error retrieving events");
        res.redirect("/admindashboard");
    }
};

// Add new event (admin)
exports.addEvent = async (req, res) => {
    try {
        const { name, venue, date, time, budget, remarks } = req.body;
        // Validate required fields
        if (!name || !venue || !date || !time || !budget) {
            req.flash("error", "Please fill in all required fields");
            return res.redirect("/adminevent");
        }
        // Generate unique eventId
        const latestEvent = await Event.findOne().sort({ eventId: -1 });
        let newEventId = "E001";
        if (latestEvent && latestEvent.eventId) {
            const lastNumber = parseInt(latestEvent.eventId.replace("E", "")) || 0;
            newEventId = "E" + String(lastNumber + 1).padStart(3, "0");
        }
        // Create new event
        const newEvent = new Event({
            eventId: newEventId,
            name,
            venue,
            date: new Date(date),
            time,
            budget: Number(budget),
            remarks: remarks || ''
        });
        await newEvent.save();
        req.flash("success", "Event added successfully!");
        res.redirect("/adminevent");
    } catch (error) {
        console.error("Error adding event:", error);
        if (error.code === 11000) {
            req.flash("error", "Event ID already exists");
        } else {
            req.flash("error", "Error adding event. Please try again.");
        }
        res.redirect("/adminevent");
    }
};

// Edit event (admin)
exports.editEvent = async (req, res) => {
    try {
        const eventId = req.params.id;
        const { name, venue, date, time, budget, remarks } = req.body;

        console.log(`[editEvent] Received eventId: ${eventId}`);
        console.log(`[editEvent] Received req.body:`, req.body);

        const updated = await Event.findByIdAndUpdate(
            eventId,
            { name, venue, date, time, budget, remarks },
            { new: true }
        );

        console.log(`[editEvent] Result of findByIdAndUpdate:`, updated);

        if (!updated) {
            req.flash("error", "Event not found");
            return res.redirect("/adminevent");
        }
        req.flash("success", "Event updated successfully!");
        res.redirect("/adminevent");
    } catch (error) {
        console.error("Error updating event:", error);
        req.flash("error", "Error updating event. Please try again.");
        res.redirect("/adminevent");
    }
};

// Delete event (admin)
exports.deleteEvent = async (req, res) => {
    try {
        const eventId = req.params.id;
        const deleted = await Event.findByIdAndDelete(eventId);
        if (!deleted) {
            req.flash("error", "Event not found");
            return res.redirect("/adminevent");
        }
        req.flash("success", "Event deleted successfully!");
        res.redirect("/adminevent");
    } catch (error) {
        console.error("Error deleting event:", error);
        req.flash("error", "Error deleting event. Please try again.");
        res.redirect("/adminevent");
    }
}; 