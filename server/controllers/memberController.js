const Dependant = require("../models/dependant");
const User = require("../models/user");
const Payment = require('../models/payment');
const bcrypt = require('bcrypt');
const { sendEmail, notifyHeir } = require('../utils/emailer');


exports.getMemberList = async (req, res) => {
    try {
        const members = await User.find({ userType: "member" })
            .select('_id customId fullname username email icNum birthDate age phoneNum address status');
        
        console.log("Fetched Members:", members); // Debug log
        
        // Transform the data to ensure all required fields are present
        const transformedMembers = members.map(member => ({
            _id: member._id,
            customId: member.customId,
            fullname: member.fullname,
            username: member.username,
            email: member.email,
            icNum: member.icNum,
            birthDate: member.birthDate,
            age: member.age,
            phoneNum: member.phoneNum,
            address: member.address,
            status: member.status
        }));
        
        console.log("Transformed Members:", transformedMembers); // Debug log
        
        res.render("adminMember", { 
            members: transformedMembers,
            membersJson: JSON.stringify(transformedMembers),
            user: req.session.user
        });
    } catch (err) {
        console.error("Error retrieving members:", err);
        res.status(500).send({ message: "Error retrieving members" });
    }
};

async function generateCustomId() {
    const count = await User.countDocuments();
    const nextId = count + 1;
    return `CC${nextId.toString().padStart(2, '0')}`;
}

//ADD MEMBER 
function calculateAge(birthDate) {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}

exports.addNewMember = async (req, res) => {
    try {
        const {
            fullname,
            username,
            email,
            icNum,
            birthDate,
            age,
            address,
            phoneNum,
            password,
            passwordConfirm
        } = req.body;

        // Validate passwords match
        if (password !== passwordConfirm) {
            req.flash("error", "Passwords do not match");
            return res.redirect("/admindashboard");
        }

        // Check if user already exists
        let user = await User.findOne({ email });
        if (user) {
            req.flash("error", "User already exists");
            return res.redirect("/admindashboard");
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Find the latest user based on customId
        const latestUser = await User.findOne({ customId: { $exists: true } }).sort({ customId: -1 });

        let newCustomId = "CC01"; // Default if no user found

        if (latestUser && latestUser.customId) {
            const lastNumber = parseInt(latestUser.customId.slice(2)) || 0;
            const nextNumber = lastNumber + 1;
            newCustomId = "CC" + String(nextNumber).padStart(2, "0");
        }

        // Create new user with generated customId
        user = new User({
            customId: newCustomId,
            fullname,
            username,
            email,
            icNum,
            birthDate,
            age: calculateAge(birthDate),
            address,
            phoneNum,
            password: hashedPassword,
            userType: "member",
            status: "Inactive"
        });

        await user.save();

        // Send welcome email to new member
        const subject = 'Welcome to ComCare';
        const html = `
            <p>Dear ${fullname},</p>
            <p>Welcome to ComCare! Your account has been created successfully.</p>
            <p>Your account details:</p>
            <ul>
                <li>Member ID: ${newCustomId}</li>
                <li>Username: ${username}</li>
                <li>Email: ${email}</li>
            </ul>
            <p>Please log in to your account to complete your profile and set up your heir information.</p>
            <p>Best regards,<br>The ComCare Team</p>
        `;
        await sendEmail(email, subject, html);

        req.flash("success", "Member registered successfully!");
        res.redirect("/adminmember");
    } catch (error) {
        console.error("Registration error:", error);
        req.flash("error", "Server error. Please try again later.");
        res.redirect("/adminmember");
    }
};


exports.getMemberName = async (req, res) => {
    try {
        const members = await User.find({ userType: "member" }, "_id username fullname");
        const dependantDocs = await Dependant.find();
        
        // Format dependants to include member data
        const formattedDependants = dependantDocs.map(dependant => {
            const dependantObj = dependant.toObject();
            
            // Find the member for this dependant
            const member = members.find(m => m._id.toString() === dependantObj.memberId.toString());
            if (member) {
                dependantObj.memberName = member.fullname || member.username;
            }
            
            return dependantObj;
        });
        
        res.render("adminDependant", { 
            members: members || [],
            membersJson: JSON.stringify(members || []),
            dependants: formattedDependants || [],
            dependantsJson: JSON.stringify(formattedDependants || []),
            user: req.session.user
        });
    } catch (err) {
        console.error("Error fetching members:", err);
        res.status(500).send("Server Error");
    }
};

exports.editMember = async (req, res) => {
    try {
        const memberToEditId = req.params.id;
        const {
            fullname,
            username,
            email,
            icNum,
            birthDate,
            phoneNum,
            address,
            status
        } = req.body;

        const age = new Date().getFullYear() - new Date(birthDate).getFullYear();

        const oldMember = await User.findById(memberToEditId);
        if (!oldMember) {
            req.flash("error", "Member not found");
            return res.redirect("/adminmember");
        }

        const updated = await User.findByIdAndUpdate(
            memberToEditId,
            {
                fullname,
                username,
                email,
                icNum,
                birthDate,
                phoneNum,
                address,
                age,
                status
            },
            { new: true }
        );

        // Track changes for notification
        const changes = [];
        if (oldMember.fullname !== fullname) changes.push(`Name changed to: ${fullname}`);
        if (oldMember.email !== email) changes.push(`Email changed to: ${email}`);
        if (oldMember.phoneNum !== phoneNum) changes.push(`Phone number changed to: ${phoneNum}`);
        if (oldMember.address !== address) changes.push(`Address changed to: ${address}`);
        if (oldMember.status !== status) changes.push(`Status changed to: ${status}`);

        if (changes.length > 0) {
            // Notify member about changes
            const subject = 'Your ComCare Profile Has Been Updated';
            const html = `
                <p>Dear ${fullname},</p>
                <p>Your ComCare profile has been updated with the following changes:</p>
                <ul>
                    ${changes.map(change => `<li>${change}</li>`).join('')}
                </ul>
                <p>If you did not request these changes, please contact us immediately.</p>
                <p>Best regards,<br>The ComCare Team</p>
            `;
            await sendEmail(email, subject, html);

            // Notify heir about changes
            await notifyHeir(memberToEditId, 'Member Profile Updated', 
                `The following changes were made to ${fullname}'s profile: ${changes.join(', ')}`);
        }

        req.flash("success", "Member updated successfully");
        res.redirect("/adminmember");
    } catch (error) {
        console.error("Error updating member:", error);
        req.flash("error", "Error updating member");
        res.redirect("/adminmember");
    }
};


exports.deleteMember = async (req, res) => {
    try {
        const memberId = req.params.id;
        const member = await User.findById(memberId);
        
        if (!member) {
            req.flash("error", "Member not found");
            return res.redirect("/adminmember");
        }

        // Send notification before deletion
        const subject = 'Your ComCare Account Has Been Deleted';
        const html = `
            <p>Dear ${member.fullname},</p>
            <p>Your ComCare account has been deleted from our system.</p>
            <p>If you believe this was done in error, please contact us immediately.</p>
            <p>Best regards,<br>The ComCare Team</p>
        `;
        await sendEmail(member.email, subject, html);

        // Notify heir about account deletion
        await notifyHeir(memberId, 'Member Account Deleted', 
            `${member.fullname}'s ComCare account has been deleted from the system.`);

        await User.findByIdAndDelete(memberId);
        req.flash("success", "Member deleted successfully");
        res.redirect("/adminmember");
    } catch (error) {
        console.error("Error deleting member:", error);
        req.flash("error", "Error deleting member");
        res.redirect("/adminmember");
    }
};

exports.updateMemberStatus = async (req, res) => {
    try {
        const memberId = req.params.id;
        const { status } = req.body;
        
        const member = await User.findById(memberId);
        if (!member) {
            req.flash("error", "Member not found");
            return res.redirect("/adminmember");
        }
        
        const oldStatus = member.status;
        member.status = status;
        await member.save();

        // Send status change notification
        const subject = 'Your ComCare Account Status Has Changed';
        const html = `
            <p>Dear ${member.fullname},</p>
            <p>Your ComCare account status has been changed from "${oldStatus}" to "${status}".</p>
            <p>If you have any questions about this change, please contact us.</p>
            <p>Best regards,<br>The ComCare Team</p>
        `;
        await sendEmail(member.email, subject, html);

        // Notify heir about status change
        await notifyHeir(memberId, 'Member Status Changed', 
            `${member.fullname}'s account status has been changed from "${oldStatus}" to "${status}".`);

        req.flash("success", "Member status updated successfully");
        res.redirect("/adminmember");
    } catch (error) {
        console.error("Error updating member status:", error);
        req.flash("error", "Error updating member status");
        res.redirect("/adminmember");
    }
};

// Get all dependants for the logged-in member
exports.getMemberDependants = async (req, res) => {
    try {
        console.log('=== Starting getMemberDependants ===');
        
        // Check if user is logged in
        if (!req.session.user) {
            console.log('No user in session');
            req.flash("error", "Please login first");
            return res.redirect("/login");
        }

        console.log('Session user:', JSON.stringify(req.session.user, null, 2));

        // Get the current logged-in member's ID from the session
        const memberId = req.session.user._id || req.session.user.id;
        console.log('Member ID:', memberId);
        
        if (!memberId) {
            console.log('No member ID found in session');
            req.flash("error", "Invalid session");
            return res.redirect("/login");
        }
        
        // Find all dependants for this member
        const dependants = await Dependant.find({ memberId }).lean();
        
        // Transform dates to ISO strings for proper JSON serialization
        const transformedDependants = dependants.map(d => ({
            ...d,
            _id: d._id.toString(), // Convert ObjectId to string
            birthday: d.birthday ? new Date(d.birthday).toISOString() : null,
            memberId: d.memberId ? d.memberId.toString() : null // Add null check for memberId
        }));
        
        console.log('Found dependants:', JSON.stringify(transformedDependants, null, 2));
        
        // Add flash messages if no dependants found
        if (!dependants.length) {
            req.flash('info', 'No dependants found. Add your first dependant using the button below.');
        }
        
        // Prepare view data
        const viewData = {
            dependants: transformedDependants,
            user: {
                ...req.session.user,
                _id: req.session.user.id.toString(), // Use id instead of _id
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
        
        // Log the exact data being sent to the view
        console.log('View data:', JSON.stringify(viewData, null, 2));
        
        // Render the page
        console.log('Rendering memberDependant view...');
        res.render("memberDependant", viewData);
        console.log('=== Finished getMemberDependants ===');
    } catch (err) {
        console.error("Error fetching dependants:", err);
        req.flash("error", "Error retrieving dependants");
        res.redirect("/login");
    }
};

// Add a new dependant for the logged-in member
exports.addMemberDependant = async (req, res) => {
    try {
        const memberId = req.session.user._id || req.session.user.id;
        const member = await User.findById(memberId);
        if (!member) {
            req.flash('error', 'Member not found.');
            return res.redirect('/memberdependant');
        }

        const { name, ic, birthday, gender, relationship, isHeir, heirEmail } = req.body;

        // Calculate age from birthday
        const today = new Date();
        const birth = new Date(birthday);
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            age--;
        }

        // Check if IC already exists for another dependant of the same member
        const existingDependant = await Dependant.findOne({ ic, memberId });
        if (existingDependant) {
            req.flash('error', 'Dependant with this IC number already exists for this member.');
            return res.redirect('/memberdependant');
        }

        // Handle heir logic
        let newIsHeir = isHeir === 'on'; // Checkbox value is 'on' when checked
        let newHeirEmail = newIsHeir ? heirEmail : undefined;

        if (newIsHeir) {
            if (!newHeirEmail || !/^[\w-]+(?:\.[\w-]+)*@(?:[\w-]+\.)+[a-zA-Z]{2,7}$/.test(newHeirEmail)) {
                req.flash('error', 'Heir email is required and must be a valid email address.');
                return res.redirect('/memberdependant');
        }
            // Unset previous heir for this member
            await Dependant.updateMany(
                { memberId, isHeir: true },
                { $set: { isHeir: false, heirEmail: undefined } }
            );
        }

        const newDependant = new Dependant({
            name,
            ic,
            birthday,
            age,
            gender,
            relationship,
            memberId,
            memberName: member.fullname,
            isHeir: newIsHeir,
            heirEmail: newHeirEmail
        });

        await newDependant.save();

        req.flash('success', 'Dependant added successfully!');
        res.redirect('/memberdependant');
    } catch (error) {
        console.error('Error adding dependant:', error);
        req.flash('error', 'Error adding dependant. Please try again.');
        res.redirect('/memberdependant');
    }
};

// Update an existing dependant
exports.updateMemberDependant = async (req, res) => {
    try {
        console.log('Update dependant request body:', req.body);
        console.log('Update dependant params:', req.params);
        console.log('Session user:', req.session.user);
        
        const memberId = req.session.user._id || req.session.user.id;
        const dependantId = req.params.id;
        
        if (!dependantId) {
            console.log('No dependant ID provided');
            req.flash("error", "Invalid dependant ID");
            return res.redirect("/memberdependant");
        }

        const {
            name,
            ic,
            birthday,
            gender,
            relationship,
            isHeir,
            heirEmail
        } = req.body;

        // Validate required fields
        if (!name || !ic || !birthday || !gender || !relationship) {
            console.log('Missing required fields:', { name, ic, birthday, gender, relationship });
            req.flash("error", "All fields are required");
            return res.redirect("/memberdependant");
        }

        // Calculate age based on birthday
        const birthDate = new Date(birthday);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        // Handle heir logic
        let newIsHeir = isHeir === 'on'; // Checkbox value is 'on' when checked
        let newHeirEmail = newIsHeir ? heirEmail : undefined;

        if (newIsHeir) {
            if (!newHeirEmail || !/^[\w-]+(?:\.[\w-]+)*@(?:[\w-]+\.)+[a-zA-Z]{2,7}$/.test(newHeirEmail)) {
                req.flash('error', 'Heir email is required and must be a valid email address.');
                return res.redirect('/memberdependant');
            }
            // Unset previous heir for this member, excluding the current dependant
            await Dependant.updateMany(
                { memberId, isHeir: true, _id: { $ne: dependantId } },
                { $set: { isHeir: false, heirEmail: undefined } }
            );
        }

        // Update the dependant
        const updatedDependant = await Dependant.findOneAndUpdate(
            { _id: dependantId, memberId },
            {
                name,
                ic,
                birthday,
                age,
                gender,
                relationship,
                isHeir: newIsHeir,
                heirEmail: newHeirEmail
            },
            { new: true }
        );

        if (!updatedDependant) {
            console.log('Dependant not found with ID:', dependantId);
            req.flash("error", "Dependant not found");
            return res.redirect("/memberdependant");
        }

        console.log('Dependant updated successfully:', updatedDependant);
        req.flash("success", "Dependant updated successfully!");
        res.redirect("/memberdependant");
    } catch (error) {
        console.error("Error updating dependant:", error);
        if (error.code === 11000) {
            req.flash("error", "IC number already exists");
        } else {
            req.flash("error", "Server error. Please try again later.");
        }
        res.redirect("/memberdependant");
    }
};

// Delete a dependant
exports.deleteMemberDependant = async (req, res) => {
    try {
        console.log('Delete dependant request params:', req.params);
        console.log('Session user:', req.session.user);
        
        const memberId = req.session.user._id || req.session.user.id;
        const dependantId = req.params.id;
        
        // Find and delete the dependant
        const deletedDependant = await Dependant.findOneAndDelete({ _id: dependantId, memberId });
        
        if (!deletedDependant) {
            console.log('Dependant not found with ID:', dependantId);
            req.flash("error", "Dependant not found");
            return res.redirect("/memberdependant");
        }
        
        console.log('Dependant deleted successfully:', deletedDependant);
        req.flash("success", "Dependant deleted successfully!");
        res.redirect("/memberdependant");
    } catch (error) {
        console.error("Error deleting dependant:", error);
        req.flash("error", "Server error. Please try again later.");
        res.redirect("/memberdependant");
    }
};

// Update profile
exports.updateProfile = async (req, res) => {
    try {
        // 1. Authenticate user and get ID
        const userId = req.session.user.id; // Get user ID from session
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized: User ID not found in session.' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        // 2. Extract data from request body
        const { username, fullname, email, birthDate, phoneNum, address } = req.body;

        // 3. Track changes and prepare updated fields
        const changes = [];
        const updatedUserFields = {}; // Object to store fields that are actually updated

        // 4. Validate and update each field

        // Username
        if (username !== undefined && username !== user.username) {
            const existingUser = await User.findOne({ username: username, _id: { $ne: userId } });
            if (existingUser) {
                return res.status(400).json({ success: false, message: 'Username is already taken.' });
            }
            updatedUserFields.username = username;
            changes.push(`Username changed from '${user.username}' to '${username}'`);
        }

        // Full Name
        if (fullname !== undefined && fullname !== user.fullname) {
            updatedUserFields.fullname = fullname;
            changes.push(`Full Name changed from '${user.fullname}' to '${fullname}'`);
        }

        // Email
        if (email !== undefined && email !== user.email) {
            const existingUser = await User.findOne({ email: email, _id: { $ne: userId } });
            if (existingUser) {
                return res.status(400).json({ success: false, message: 'Email is already taken.' });
            }
            updatedUserFields.email = email;
            changes.push(`Email changed from '${user.email}' to '${email}'`);
        }

        // Birth Date & Age
        if (birthDate !== undefined && birthDate !== (user.birthDate ? user.birthDate.toISOString().split('T')[0] : '')) {
            const newBirthDate = new Date(birthDate);
            const today = new Date();
            let newAge = today.getFullYear() - newBirthDate.getFullYear();
            const monthDiff = today.getMonth() - newBirthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < newBirthDate.getDate())) {
                newAge--;
            }
            updatedUserFields.birthDate = newBirthDate;
            updatedUserFields.age = newAge;
            changes.push(`Birth Date changed to: ${birthDate} (Age: ${newAge})`);
        }

        // Phone Number
        if (phoneNum !== undefined && phoneNum !== user.phoneNum) {
            updatedUserFields.phoneNum = phoneNum;
            changes.push(`Phone Number changed from '${user.phoneNum}' to '${phoneNum}'`);
        }

        // Address
        if (address !== undefined && address !== user.address) {
            updatedUserFields.address = address;
            changes.push(`Address changed from '${user.address}' to '${address}'`);
        }

        // If no actual changes were detected, return success without saving/notifying
        if (Object.keys(updatedUserFields).length === 0) {
            return res.status(200).json({ success: true, message: 'No changes were detected.', user: req.session.user });
        }

        // 5. Apply updates and save user
        Object.assign(user, updatedUserFields);
        await user.save();

        // 6. Update session data (critical for frontend consistency)
        req.session.user = { ...req.session.user, ...updatedUserFields };

        // 7. Notify heir about profile changes
        if (changes.length > 0) {
            await notifyHeir(
                userId,
                'Member Profile Update Notification',
                `The profile of ${user.fullname} (${user.username}) has been updated with the following changes:\n- ${changes.join('\n- ')}`
            );
        }

        // 8. Send success response with updated user data
        return res.status(200).json({
            success: true,
            message: 'Profile updated successfully!',
            user: req.session.user // Send back the updated session user data
        });

    } catch (error) {
        console.error('Error updating profile:', error); // Log the full error for debugging
        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, message: messages.join('; ') });
        }
        // Handle other unexpected errors
        return res.status(500).json({ success: false, message: 'An unexpected error occurred while updating profile. Please try again.' });
    }
};

// Add dependant
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
        const memberName = req.session.user.fullname;

        const dependant = new Dependant({
            name,
            ic,
            birthday,
            age,
            gender,
            relationship,
            memberId,
            memberName,
            isHeir: isHeir === 'true' || isHeir === true,
            heirEmail: isHeir === 'true' || isHeir === true ? heirEmail : undefined
        });

        await dependant.save();

        // Notify heir about new dependant
        if (!isHeir) {
            await notifyHeir(
                memberId,
                'New Dependant Added',
                `${memberName} has added a new dependant: ${name} (${relationship})`
            );
        }

        req.flash('success', 'Dependant added successfully');
        res.redirect('/dependants');
    } catch (error) {
        console.error('Error adding dependant:', error);
        req.flash('error', 'Error adding dependant');
        res.redirect('/dependants');
    }
};

// Update dependant
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

        // Track changes
        const changes = [];
        if (name !== dependant.name) changes.push(`Name changed to: ${name}`);
        if (relationship !== dependant.relationship) changes.push(`Relationship changed to: ${relationship}`);
        if (isHeir !== dependant.isHeir) changes.push(`Heir status changed to: ${isHeir === 'true' || isHeir === true ? 'Yes' : 'No'}`);

        dependant.name = name;
        dependant.ic = ic;
        dependant.birthday = birthday;
        dependant.age = age;
        dependant.gender = gender;
        dependant.relationship = relationship;
        dependant.isHeir = isHeir === 'true' || isHeir === true;
        dependant.heirEmail = isHeir === 'true' || isHeir === true ? heirEmail : undefined;

        await dependant.save();

        // Notify heir about dependant changes
        if (changes.length > 0) {
            await notifyHeir(
                dependant.memberId,
                'Dependant Information Updated',
                `The following changes were made to dependant ${name}:\n${changes.join('\n')}`
            );
        }

        req.flash('success', 'Dependant updated successfully');
        res.redirect('/dependants');
    } catch (error) {
        console.error('Error updating dependant:', error);
        req.flash('error', 'Error updating dependant');
        res.redirect('/dependants');
    }
};

// Delete dependant
exports.deleteDependant = async (req, res) => {
    try {
        const dependant = await Dependant.findById(req.params.id);
        if (!dependant) {
            req.flash('error', 'Dependant not found');
            return res.redirect('/dependants');
        }

        const memberId = dependant.memberId;
        const dependantName = dependant.name;

        await Dependant.findByIdAndDelete(req.params.id);

        // Notify heir about dependant deletion
        await notifyHeir(
            memberId,
            'Dependant Removed',
            `The dependant ${dependantName} has been removed from the system.`
        );

        req.flash('success', 'Dependant deleted successfully');
        res.redirect('/dependants');
    } catch (error) {
        console.error('Error deleting dependant:', error);
        req.flash('error', 'Error deleting dependant');
        res.redirect('/dependants');
    }
};

// Change password
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        
        // Check if user is logged in
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: 'Please log in to change your password'
            });
        }

        // Get user ID from session
        const userId = req.session.user.id;
        if (!userId) {
            console.error('No user ID found in session');
            return res.status(401).json({
                success: false,
                message: 'Session error. Please log in again.'
            });
        }

        // Input validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'All password fields are required'
            });
        }

        // Validate passwords match
        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'New passwords do not match'
            });
        }

        // Find user
        const user = await User.findById(userId);
        if (!user) {
            console.error('User not found with ID:', userId);
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Check if new password is the same as the current password
        if (newPassword === currentPassword) {
            return res.status(400).json({
                success: false,
                message: 'New password cannot be the same as the current password'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        user.password = hashedPassword;
        await user.save();

        // Send email notification
        const subject = 'Password Changed Successfully';
        const html = `
            <p>Dear ${user.fullname},</p>
            <p>Your password has been changed successfully.</p>
            <p>If you did not make this change, please contact us immediately.</p>
            <p>Best regards,<br>The ComCare Team</p>
        `;
        await sendEmail(user.email, subject, html);

        // Notify heir about password change
        await notifyHeir(userId, 'Password Change Notification', 
            `${user.fullname}'s account password has been changed.`);

        // Return success response
        return res.status(200).json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Error changing password:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while changing password'
        });
    }
};
