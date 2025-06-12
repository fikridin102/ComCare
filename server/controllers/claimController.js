const Claim = require('../models/claim');
const Payment = require('../models/payment');
const Dependant = require('../models/dependant');
const User = require('../models/user');

// Show claimable khairat names
exports.getClaimPage = async (req, res) => {
  try {
    const memberId = req.session.user._id || req.session.user.id;
    // Find paid khairat payments for this member
    const payments = await Payment.find({ memberId, paymentType: 'khairat', status: 'Paid' });
    // Flatten all selectedNames from all payments
    const claimable = [];
    for (const payment of payments) {
      for (const sel of payment.selectedNames) {
        // Check if already claimed
        const alreadyClaimed = await Claim.findOne({ 'claimedFor.id': sel.id, paymentId: payment._id });
        if (!alreadyClaimed) {
          // Start with the base data from selectedNames
          const claimItem = {
            id: sel.id,
            name: sel.name, // Ensure name is included
            type: sel.type,
            paymentId: payment._id,
            amount: 30
          };

          // Handle dependant details
          if (sel.type === 'dependant' && sel.id) {
            const dependant = await Dependant.findById(sel.id);
            if (dependant) {
              claimItem.ic = dependant.ic;
              claimItem.relationship = dependant.relationship;
              // Use dependant name if not already set
              if (!claimItem.name) {
                claimItem.name = dependant.name;
              }
            }
          } else if (sel.type === 'member') {
            claimItem.ic = req.session.user.ic || '-';
            claimItem.relationship = 'Self';
            if (!claimItem.name) {
              claimItem.name = req.session.user.fullname || req.session.user.name;
            }
          }
          claimable.push(claimItem);
        }
      }
    }

    // Fetch all claims for this user
    const allClaims = await Claim.find({ memberId }).sort({ claimDate: -1 });
    // Group claims by claimedFor.id
    const claimHistory = {};
    allClaims.forEach(claim => {
      const id = claim.claimedFor.id;
      if (!claimHistory[id]) {
        claimHistory[id] = {
          name: claim.claimedFor.name,
          type: claim.claimedFor.type,
          totalAmount: 0,
          claims: []
        };
      }
      claimHistory[id].totalAmount += claim.amount;
      claimHistory[id].claims.push({
        amount: claim.amount,
        status: claim.status,
        claimDate: claim.claimDate,
        paymentId: claim.paymentId,
        _id: claim._id
      });
    });

    res.render('memberKhairatClaim', {
      claimable,
      claimHistory,
      messages: {
        error: req.flash('error'),
        success: req.flash('success')
      },
      user: req.session.user,
      csrfToken: req.csrfToken()
    });
  } catch (error) {
    console.error('Error loading claim page:', error);
    req.flash('error', 'Error loading claim page');
    res.redirect('/memberIndex');
  }
};

// Submit a khairat claim
exports.submitClaim = async (req, res) => {
  try {
    const memberId = req.session.user._id || req.session.user.id;
    const { claimedForId, claimedForName, claimedForType, paymentId, amount } = req.body;
    // Check if already claimed
    const existing = await Claim.findOne({ 'claimedFor.id': claimedForId, paymentId });
    if (existing) {
      req.flash('error', 'Already claimed for this person.');
      return res.redirect('/memberclaim');
    }
    // Create claim with proper claimedFor structure
    const claim = new Claim({
      memberId,
      claimedFor: {
        id: claimedForId,
        name: claimedForName,
        type: claimedForType
      },
      paymentId,
      amount,
      status: 'Pending'
    });
    await claim.save();
    req.flash('success', 'Claim submitted!');
    res.redirect('/memberclaim');
  } catch (error) {
    console.error('Error submitting claim:', error);
    req.flash('error', 'Error submitting claim');
    res.redirect('/memberclaim');
  }
};

// Admin: Get all claims with pagination
exports.getAdminClaims = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const claims = await Claim.find()
      .sort({ claimDate: -1 })
      .skip(skip)
      .limit(limit)
      .populate('memberId', 'fullname ic')
      .populate('paymentId', 'paymentDate');

    const totalClaims = await Claim.countDocuments();
    const totalPages = Math.ceil(totalClaims / limit);

    res.render('adminClaim', {
      claims,
      currentPage: page,
      totalPages,
      messages: {
        error: req.flash('error'),
        success: req.flash('success')
      },
      user: req.session.user,
      csrfToken: req.csrfToken()
    });
  } catch (error) {
    console.error('Error loading admin claims:', error);
    req.flash('error', 'Error loading claims');
    res.redirect('/admin/dashboard');
  }
};

// Admin: Get claim details
exports.getClaimDetails = async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id)
      .populate('memberId', 'fullname icNum phoneNum email')
      .populate('paymentId', 'paymentDate paymentType');

    if (!claim) {
      req.flash('error', 'Claim not found');
      return res.redirect('/adminclaim');
    }

    res.render('adminClaimDetails', {
      claim,
      messages: {
        error: req.flash('error'),
        success: req.flash('success')
      },
      user: req.session.user,
      csrfToken: req.csrfToken()
    });
  } catch (error) {
    console.error('Error loading claim details:', error);
    req.flash('error', 'Error loading claim details');
    res.redirect('/adminclaim');
  }
};

// Admin: Approve claim
exports.approveClaim = async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id);
    
    if (!claim) {
      req.flash('error', 'Claim not found');
      return res.redirect('/adminclaim');
    }

    if (claim.status !== 'Pending') {
      req.flash('error', 'Claim is not in pending status');
      return res.redirect('/adminclaim');
    }

    claim.status = 'Approved';
    claim.approvedBy = req.session.user._id;
    claim.approvedAt = new Date();
    await claim.save();

    req.flash('success', 'Claim approved successfully');
    res.redirect('/adminclaim');
  } catch (error) {
    console.error('Error approving claim:', error);
    req.flash('error', 'Error approving claim');
    res.redirect('/adminclaim');
  }
};

// Admin: Reject claim
exports.rejectClaim = async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    const claim = await Claim.findById(req.params.id);
    
    if (!claim) {
      req.flash('error', 'Claim not found');
      return res.redirect('/adminclaim');
    }

    if (claim.status !== 'Pending') {
      req.flash('error', 'Claim is not in pending status');
      return res.redirect('/adminclaim');
    }

    claim.status = 'Rejected';
    claim.rejectionReason = rejectionReason;
    claim.rejectedBy = req.session.user._id;
    claim.rejectedAt = new Date();
    await claim.save();

    req.flash('success', 'Claim rejected successfully');
    res.redirect('/adminclaim');
  } catch (error) {
    console.error('Error rejecting claim:', error);
    req.flash('error', 'Error rejecting claim');
    res.redirect('/adminclaim');
  }
}; 