const cron = require('node-cron');
const Payment = require('../models/payment');
const User = require('../models/user');

function getEndOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getEndOfYear(date) {
  return new Date(date.getFullYear(), 11, 31);
}

// Schedule: Run at midnight on the first day of every month
cron.schedule('0 0 1 * *', async () => {
  const users = await User.find({ userType: 'member' });
  const now = new Date();
  const endOfMonth = getEndOfMonth(now);
  const endOfYear = getEndOfYear(now);

  for (const user of users) {
    // --- Maintenance Fee (monthly) ---
    const maintenanceExists = await Payment.findOne({
      memberId: user._id,
      paymentType: 'maintenance',
      dueDate: { $gte: new Date(now.getFullYear(), now.getMonth(), 1), $lte: endOfMonth }
    });
    if (!maintenanceExists) {
      await Payment.create({
        memberId: user._id,
        amount: 400, // Maintenance fee
        dueDate: endOfMonth,
        status: 'Pending',
        paymentMethod: 'Unpaid',
        referenceNumber: 'AUTO-MAINTENANCE-' + Date.now(),
        paymentType: 'maintenance',
        dependantsCount: 0,
        selectedNames: []
      });
    }

    // --- Khairat Fee (yearly, only in January) ---
    if (now.getMonth() === 0) { // January
      const khairatExists = await Payment.findOne({
        memberId: user._id,
        paymentType: 'khairat',
        dueDate: { $gte: new Date(now.getFullYear(), 0, 1), $lte: endOfYear }
      });
      if (!khairatExists) {
        await Payment.create({
          memberId: user._id,
          amount: 30, // Khairat fee
          dueDate: endOfYear,
          status: 'Pending',
          paymentMethod: 'Unpaid',
          referenceNumber: 'AUTO-KHAIRAT-' + Date.now(),
          paymentType: 'khairat',
          dependantsCount: 0,
          selectedNames: []
        });
      }
    }
  }
  console.log('Scheduled payments for all users created (if needed).');
});

// Daily job to update payment statuses
cron.schedule('0 1 * * *', async () => {
  const now = new Date();
  // Set overdue
  await Payment.updateMany(
    { status: { $ne: 'Paid' }, dueDate: { $lt: now } },
    { $set: { status: 'Overdue' } }
  );
  // Set pending
  await Payment.updateMany(
    { status: { $ne: 'Paid' }, dueDate: { $gte: now } },
    { $set: { status: 'Pending' } }
  );
  console.log('Payment statuses updated (Overdue/Pending).');
}); 