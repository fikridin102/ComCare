const Dependant = require('../models/dependant');
const User = require('../models/user');
const { sendEmail, notifyHeir } = require('../utils/emailer');

// Get all dependants for admin view
exports.getAdminDependants = async (req, res) => {
    try {
        console.log('=== Starting getAdminDependants ===');
        
        // Find all dependants
        const dependants = await Dependant.find().lean();
        
        // Find all members
        const members = await User.find({ userType: "member" }).lean();
        
        // Transform dates to ISO strings for proper JSON serialization
        const transformedDependants = dependants.map(d => ({
            ...d,
            _id: d._id.toString(),
            birthday: d.birthday ? new Date(d.birthday).toISOString() : null,
            memberId: d.memberId ? d.memberId.toString() : null
        }));
        
        // Transform members data
        const transformedMembers = members.map(m => ({
            _id: m._id.toString(),
            fullname: m.fullname || '',
            username: m.username || ''
        }));
        
        console.log('Found dependants:', JSON.stringify(transformedDependants, null, 2));
        console.log('Found members:', JSON.stringify(transformedMembers, null, 2));
        
        // Prepare view data
        const viewData = {
            dependants: transformedDependants,
            members: transformedMembers,
            user: {
                ...req.session.user,
                _id: req.session.user._id || req.session.user.id,
                fullname: req.session.user.fullname || '',
                username: req.session.user.username || ''
            },
            csrfToken: req.csrfToken(),
            messages: {
                success: req.flash('success'),
                error: req.flash('error'),
                info: req.flash('info')
            }
        };
        
        // Render the page
        res.render("adminDependant", viewData);
        console.log('=== Finished getAdminDependants ===');
    } catch (err) {
        console.error("Error fetching dependants:", err);
        req.flash("error", "Error retrieving dependants");
        res.redirect("/adminIndex");
    }
};


// Get all dependants (admin view)
exports.getAllDependants = async (req, res) => {
    try {
        const dependants = await Dependant.find()
            .populate('memberId', 'username fullname')
            .sort({ createdAt: -1 });
            
        const formattedDependants = dependants.map(dependant => ({
            _id: dependant._id,
            name: dependant.name,
            ic: dependant.ic,
            birthday: dependant.birthday,
            age: dependant.age,
            gender: dependant.gender,
            relationship: dependant.relationship,
            memberId: dependant.memberId._id,
            memberName: dependant.memberId.fullname || dependant.memberId.username
        }));

        res.render("adminDependant", {
            dependants: formattedDependants,
            user: req.session.user,
            csrfToken: req.csrfToken(),
            messages: {
                success: req.flash('success'),
                error: req.flash('error')
            }
        });
    } catch (err) {
        console.error("Error fetching dependants:", err);
        req.flash("error", "Error retrieving dependants list");
        res.redirect("/admindashboard");
    }
};

// Add dependant (admin)
exports.addDependant = async (req, res) => {
    try {
        const {
            name,
            ic,
            birthday,
            age,
            gender,
            relationship,
            isHeir,
            heirEmail
        } = req.body;

        const memberId = req.session.user._id;
        const member = await User.findById(memberId);
        if (!member) {
            req.flash('error', 'Member not found');
            return res.redirect('/dependants');
        }

        // If this is a new heir, check if member already has an heir
        if (isHeir === 'true' || isHeir === true) {
            const existingHeir = await Dependant.findOne({
                memberId: memberId,
                isHeir: true
            });

            if (existingHeir) {
                req.flash('error', 'You already have an heir. Please remove the existing heir first or update their status.');
                return res.redirect('/dependants');
            }
        }

        const dependant = new Dependant({
            name,
            ic,
            birthday,
            age,
            gender,
            relationship,
            memberId,
            memberName: member.fullname,
            isHeir: isHeir === 'true' || isHeir === true,
            heirEmail: isHeir === 'true' || isHeir === true ? heirEmail : undefined
        });

        await dependant.save();

        // Send notification to member
        const subject = 'New Dependant Added';
        const html = `
            <p>Dear ${member.fullname},</p>
            <p>A new dependant has been added to your account:</p>
            <ul>
                <li>Name: ${name}</li>
                <li>Relationship: ${relationship}</li>
                <li>Is Heir: ${isHeir === 'true' || isHeir === true ? 'Yes' : 'No'}</li>
            </ul>
            <p>Best regards,<br>The ComCare Team</p>
        `;
        await sendEmail(member.email, subject, html);

        // If this is a new heir, send welcome email to heir
        if (isHeir === 'true' || isHeir === true && heirEmail) {
            const heirSubject = 'You Have Been Designated as an Heir';
            const heirHtml = `
                <p>Dear ${name},</p>
                <p>You have been designated as an heir for ${member.fullname}'s ComCare account.</p>
                <p>You will receive notifications about important activities related to this account.</p>
                <p>Best regards,<br>The ComCare Team</p>
            `;
            await sendEmail(heirEmail, heirSubject, heirHtml);
        }

        req.flash('success', 'Dependant added successfully');
        res.redirect('/dependants');
    } catch (error) {
        console.error('Error adding dependant:', error);
        if (error.message === 'A member can only have one heir') {
            req.flash('error', 'You already have an heir. Please remove the existing heir first or update their status.');
        } else {
            req.flash('error', 'Error adding dependant');
        }
        res.redirect('/dependants');
    }
};

// Delete dependant (admin)
exports.deleteDependant = async (req, res) => {
    try {
        const dependantId = req.params.id;
        const dependant = await Dependant.findById(dependantId);
        
        if (!dependant) {
            req.flash("error", "Dependant not found");
            return res.redirect("/admindependant");
        }

        const member = await User.findById(dependant.memberId);
        if (member) {
            // Send notification to member
            const subject = 'Dependant Removed';
            const html = `
                <p>Dear ${member.fullname},</p>
                <p>The following dependant has been removed from your account:</p>
                <ul>
                    <li>Name: ${dependant.name}</li>
                    <li>Relationship: ${dependant.relationship}</li>
                    <li>Was Heir: ${dependant.isHeir ? 'Yes' : 'No'}</li>
                </ul>
                <p>Best regards,<br>The ComCare Team</p>
            `;
            await sendEmail(member.email, subject, html);

            // If this was an heir, notify them
            if (dependant.isHeir && dependant.heirEmail) {
                const heirSubject = 'Heir Status Removed';
                const heirHtml = `
                    <p>Dear ${dependant.name},</p>
                    <p>Your status as an heir for ${member.fullname}'s ComCare account has been removed.</p>
                    <p>You will no longer receive notifications about this account.</p>
                    <p>Best regards,<br>The ComCare Team</p>
                `;
                await sendEmail(dependant.heirEmail, heirSubject, heirHtml);
            }
        }

        await Dependant.findByIdAndDelete(dependantId);
        req.flash("success", "Dependant deleted successfully");
        res.redirect("/admindependant");
    } catch (error) {
        console.error("Error deleting dependant:", error);
        req.flash("error", "Error deleting dependant");
        res.redirect("/admindependant");
    }
};

// Update dependant (admin)
exports.updateDependant = async (req, res) => {
    try {
        const {
            name,
            ic,
            birthday,
            age,
            gender,
            relationship,
            isHeir,
            heirEmail
        } = req.body;

        const dependant = await Dependant.findById(req.params.id);
        if (!dependant) {
            req.flash('error', 'Dependant not found');
            return res.redirect('/dependants');
        }

        const member = await User.findById(dependant.memberId);
        if (!member) {
            req.flash('error', 'Member not found');
            return res.redirect('/dependants');
        }

        // If changing to heir, check if member already has an heir
        if ((isHeir === 'true' || isHeir === true) && !dependant.isHeir) {
            const existingHeir = await Dependant.findOne({
                memberId: dependant.memberId,
                isHeir: true,
                _id: { $ne: dependant._id }
            });

            if (existingHeir) {
                req.flash('error', 'Member already has an heir. Please remove the existing heir first.');
                return res.redirect('/dependants');
            }
        }

        // Track changes for notification
        const changes = [];
        if (dependant.name !== name) changes.push(`Name changed to: ${name}`);
        if (dependant.relationship !== relationship) changes.push(`Relationship changed to: ${relationship}`);
        if (dependant.isHeir !== (isHeir === 'true' || isHeir === true)) {
            changes.push(`Heir status changed to: ${isHeir === 'true' || isHeir === true ? 'Yes' : 'No'}`);
        }

        // Update dependant
        dependant.name = name;
        dependant.ic = ic;
        dependant.birthday = birthday;
        dependant.age = age;
        dependant.gender = gender;
        dependant.relationship = relationship;
        dependant.isHeir = isHeir === 'true' || isHeir === true;
        dependant.heirEmail = isHeir === 'true' || isHeir === true ? heirEmail : undefined;

        await dependant.save();

        // Send notifications if there were changes
        if (changes.length > 0) {
            // Notify member
            const subject = 'Dependant Information Updated';
            const html = `
                <p>Dear ${member.fullname},</p>
                <p>The following changes have been made to your dependant's information:</p>
                <ul>
                    ${changes.map(change => `<li>${change}</li>`).join('')}
                </ul>
                <p>Best regards,<br>The ComCare Team</p>
            `;
            await sendEmail(member.email, subject, html);

            // If heir status changed, notify the heir
            if (dependant.isHeir && dependant.heirEmail) {
                const heirSubject = 'Heir Status Updated';
                const heirHtml = `
                    <p>Dear ${name},</p>
                    <p>Your status as an heir for ${member.fullname}'s ComCare account has been updated.</p>
                    <p>You will continue to receive notifications about important activities related to this account.</p>
                    <p>Best regards,<br>The ComCare Team</p>
                `;
                await sendEmail(dependant.heirEmail, heirSubject, heirHtml);
            }
        }

        req.flash('success', 'Dependant updated successfully');
        res.redirect('/dependants');
    } catch (error) {
        console.error('Error updating dependant:', error);
        req.flash('error', 'Error updating dependant');
        res.redirect('/dependants');
    }
};

// Member view: get dependants for a member
exports.getMemberDependants = async (req, res) => {
    try {
        const memberId = req.session.user._id || req.session.user.id;
        const dependants = await Dependant.find({ memberId });
        res.render("memberDependant", {
            dependants,
            user: req.session.user,
            csrfToken: req.csrfToken(),
            messages: {
                error: req.flash('error'),
                success: req.flash('success')
            }
        });
    } catch (err) {
        console.error("Error fetching member dependants:", err);
        req.flash("error", "Error retrieving dependants");
        res.redirect("/memberIndex");
    }
};

// Member: add dependant
exports.addMemberDependant = async (req, res) => {
    try {
        const memberId = req.session.user._id || req.session.user.id;
        const { name, ic, birthday, gender, relationship } = req.body;
        if (!name || !ic || !birthday || !gender || !relationship) {
            req.flash("error", "All fields are required");
            return res.redirect("/memberdependant");
        }
        const birthDate = new Date(birthday);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        const dependant = new Dependant({
            name, ic, birthday, age, gender, relationship, memberId
        });
        await dependant.save();
        req.flash("success", "Dependant added successfully!");
        res.redirect("/memberdependant");
    } catch (error) {
        console.error("Error adding dependant:", error);
        req.flash("error", "Server error. Please try again later.");
        res.redirect("/memberdependant");
    }
};

// Member: update dependant
exports.updateMemberDependant = async (req, res) => {
    try {
        const dependantId = req.params.id;
        const { name, ic, birthday, gender, relationship } = req.body;
        if (!name || !ic || !birthday || !gender || !relationship) {
            req.flash("error", "All fields are required");
            return res.redirect("/memberdependant");
        }
        const birthDate = new Date(birthday);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        const updatedDependant = await Dependant.findByIdAndUpdate(
            dependantId,
            { name, ic, birthday, age, gender, relationship },
            { new: true }
        );
        if (!updatedDependant) {
            req.flash("error", "Dependant not found");
            return res.redirect("/memberdependant");
        }
        req.flash("success", "Dependant updated successfully!");
        res.redirect("/memberdependant");
    } catch (error) {
        console.error("Error updating dependant:", error);
        req.flash("error", "Server error. Please try again later.");
        res.redirect("/memberdependant");
    }
};

// Member: delete dependant
exports.deleteMemberDependant = async (req, res) => {
    try {
        const dependantId = req.params.id;
        const deletedDependant = await Dependant.findByIdAndDelete(dependantId);
        if (!deletedDependant) {
            req.flash("error", "Dependant not found");
            return res.redirect("/memberdependant");
        }
        req.flash("success", "Dependant deleted successfully!");
        res.redirect("/memberdependant");
    } catch (error) {
        console.error("Error deleting dependant:", error);
        req.flash("error", "Server error. Please try again later.");
        res.redirect("/memberdependant");
    }
}; 