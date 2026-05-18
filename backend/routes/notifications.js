const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

// Get all notifications for current user/hospital
router.get('/', protect, async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    const query = { hospitalId };
    
    // Admins and staff see notifications for their hospital roles
    if (req.user.role !== 'superadmin') {
      query.role = req.user.role;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(50);
    
    res.json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Mark all as read
router.put('/read-all', protect, async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    await Notification.updateMany(
      { hospitalId, role: req.user.role, isRead: false },
      { isRead: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Mark individual as read
router.put('/:id/read', protect, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Clear all notifications
router.delete('/clear-all', protect, async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    await Notification.deleteMany({ hospitalId, role: req.user.role });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
