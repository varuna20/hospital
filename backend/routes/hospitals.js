/**
 * HOSPITALS ROUTES
 * ================
 * Public + admin management for hospital configuration
 * Includes: logo upload, video upload, staff/admin management
 */
const express  = require('express');
const router   = express.Router();
const Hospital = require('../models/Hospital');
const User     = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { sendHospitalSms, templates } = require('../utils/sms');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');

// ── Multer for logo + video ────────────────────────────────────────
function makeUpload(subdir, types, maxSize) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, '../uploads/' + subdir);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, subdir + '_' + req.params.id + '_' + Date.now() + path.extname(file.originalname));
    }
  });
  return multer({
    storage,
    limits: { fileSize: maxSize },
    fileFilter: (req, file, cb) => {
      if (types.test(file.mimetype)) cb(null, true);
      else cb(new Error('Invalid file type'));
    }
  });
}

const logoUpload  = makeUpload('logos',  /image\/(jpeg|png|gif|webp|svg)/, 5  * 1024 * 1024);
const videoUpload = makeUpload('videos', /video\/(mp4|webm|ogg)/,          200 * 1024 * 1024);

// ── Public: list active hospitals ─────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const hospitals = await Hospital.find({ isActive: true })
      .select('name shortName slug logo logoUrl theme city')
      .sort({ name: 1 });
    res.json({ success: true, hospitals });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Public: by slug ────────────────────────────────────────────────
router.get('/slug/:slug', async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ slug: req.params.slug, isActive: true })
      .select('name shortName slug logo logoUrl theme payment queueSettings clinicHours waitingVideo');
    if (!hospital) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, hospital });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Admin: get own hospital full data ─────────────────────────────
router.get('/mine', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const hid = req.user.role === 'superadmin' ? req.query.hospitalId : req.user.hospitalId?._id;
    const hospital = await Hospital.findById(hid);
    if (!hospital) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, hospital });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Alias for Admin Media Page to fix 404
router.put('/:id/settings', protect, authorize('admin', 'superadmin'), async (req, res, next) => {
  // We don't use router.handle because it might restart the middleware chain.
  // Instead, just pass it through or let the next handler (the one below) catch it
  // if we remove the /settings from the path.
  req.url = `/${req.params.id}`;
  next();
});

// ── Admin: update hospital settings ──────────────────────────────
router.put('/:id', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const hid = req.user.hospitalId?._id?.toString() || req.user.hospitalId?.toString();
      if (hid !== req.params.id) return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const Hospital = require('../models/Hospital');
    const AuditLog = require('../models/AuditLog');
    const oldHospital = await Hospital.findById(req.params.id);

    // Deep merge for nested objects like theme, sms, payment
    const updateData = { $set: {} };
    const allowed = [
      'name','shortName','slug','city','phone','email','address','website','country',
      'subscriptionPlan','isActive','clinicHours',
      'logo', 'logoUrl', 'displayLayout', 'slideshow', 'announcement'
    ];
    
    allowed.forEach(k => { if (req.body[k] !== undefined) updateData.$set[k] = req.body[k]; });

    // Nested objects - use dot notation to avoid overwriting sub-fields
    ['theme','payment','sms','billing','waitingVideo','queueSettings','whatsapp'].forEach(ns => {
      if (req.body[ns]) {
        Object.entries(req.body[ns]).forEach(([k,v]) => {
          updateData.$set[`${ns}.${k}`] = v;
        });
      }
    });

    const hospital = await Hospital.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: false });

    // Audit Log
    await AuditLog.create({
      hospitalId: req.params.id,
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'UPDATE_HOSPITAL_SETTINGS',
      targetType: 'Hospital',
      targetId: req.params.id,
      targetName: hospital.name,
      metadata: { 
        updatedFields: Object.keys(updateData.$set)
      }
    }).catch(err => console.error('Audit Log Error:', err));

    res.json({ success: true, hospital });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Update Announcement (Staff & Admin) ────────────────────────────
router.put('/:id/announcement', protect, authorize('admin', 'superadmin', 'staff'), async (req, res) => {
  try {
    const Hospital = require('../models/Hospital');
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });
    
    if (!hospital.queueSettings) hospital.queueSettings = {};
    hospital.queueSettings.announcement = req.body.announcement || '';
    
    // Bypass validation for fast update
    await Hospital.updateOne({ _id: hospital._id }, { $set: { 'queueSettings.announcement': hospital.queueSettings.announcement } });
    
    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${hospital._id}`).emit('announcement_updated');
      io.to(`display_${hospital._id}`).emit('announcement_updated');
    }
    
    res.json({ success: true, announcement: hospital.queueSettings.announcement });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Upload Logo ────────────────────────────────────────────────────
router.post('/:id/logo', protect, authorize('admin', 'superadmin'),
  logoUpload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const logoPath = '/uploads/logos/' + req.file.filename;
    const hospital = await Hospital.findByIdAndUpdate(req.params.id, { logo: logoPath }, { new: true });
    res.json({ success: true, logo: logoPath, hospital });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Upload Waiting Room Video ──────────────────────────────────────
router.post('/:id/video', protect, authorize('admin', 'superadmin'),
  videoUpload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No video uploaded' });
    const videoPath = '/uploads/videos/' + req.file.filename;
    const hospital = await Hospital.findByIdAndUpdate(
      req.params.id,
      { 'waitingVideo.url': videoPath, 'waitingVideo.enabled': true, 'waitingVideo.filename': req.file.filename },
      { new: true }
    );
    res.json({ success: true, videoPath, hospital });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Toggle waiting video on/off ────────────────────────────────────
router.put('/:id/video/toggle', protect, authorize('admin', 'superadmin', 'staff'), async (req, res) => {
  try {
    const { enabled } = req.body;
    const hospital = await Hospital.findByIdAndUpdate(
      req.params.id,
      { 'waitingVideo.enabled': enabled },
      { new: true }
    );
    const io = req.app.get('io');
    if (io) io.to('display_' + req.params.id).emit('video_toggle', { enabled, videoUrl: hospital.waitingVideo?.url });
    res.json({ success: true, enabled, hospital });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Get staff list ─────────────────────────────────────────────────
router.get('/:id/staff', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const staff = await User.find({ hospitalId: req.params.id, role: { $in: ['staff', 'admin'] } })
      .select('-password').sort({ name: 1 });
    res.json({ success: true, staff });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Add staff ─────────────────────────────────────────────────────
router.post('/:id/staff', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { name, email, password, phone, role = 'staff' } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already in use' });
    const user = await User.create({ name, email, password, phone, role, hospitalId: req.params.id });
    res.status(201).json({ success: true, user: { ...user.toObject(), password: undefined } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Toggle user status ─────────────────────────────────────────────
router.put('/users/:userId/toggle', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.isActive = !user.isActive;
    await user.save();
    res.json({ success: true, isActive: user.isActive });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});


// ── Reset user password (admin for staff, superadmin for any) ──────
router.put('/users/:userId/reset-password', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.password = newPassword;
    await user.save();

    // SMS notification for password reset
    try {
      const hospital = await Hospital.findById(user.hospitalId);
      const { SystemSettings } = require('../models/SystemSettings');
      const settings = await SystemSettings.findOne();
      
      const smsEnabled = hospital?.sms?.enabled || settings?.sms?.enabled;
      if (smsEnabled) {
        sendHospitalSms({
          hospitalId: hospital._id,
          to: user.phone,
          templateType: 'password',
          templateData: {
            name: user.name,
            password: newPassword,
            hospitalName: hospital.shortName || hospital.name
          }
        }).catch(() => {});
      }
    } catch (_e) {}

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Slideshow: Upload media (image or video) ───────────────────────
const slideshowUpload = makeUpload('slideshow',
  /image\/(jpeg|png|gif|webp)|video\/(mp4|webm)/,
  100 * 1024 * 1024
);

router.post('/:id/slideshow', protect, authorize('admin','superadmin'),
  slideshowUpload.single('media'), async (req, res) => {
  try {
    const hid = req.user.role === 'superadmin' ? req.params.id : (req.user.hospitalId?._id || req.user.hospitalId);
    if (req.user.role !== 'superadmin' && hid.toString() !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!req.file) return res.status(400).json({ success:false, message:'No file' });
    const isVideo = req.file.mimetype.startsWith('video');
    const url = '/uploads/slideshow/' + req.file.filename;
    const hospital = await Hospital.findByIdAndUpdate(req.params.id,
      { $push: { slideshow: {
        url, filename: req.file.filename,
        type: isVideo ? 'video' : 'image',
        duration: Number(req.body.duration) || 10,
        caption: req.body.caption || '',
        order: Number(req.body.order) || 0,
        isActive: true,
      }}},
      { new: true }
    );
    res.json({ success:true, slideshow: hospital.slideshow });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── Slideshow: Update item (duration, caption, active) ────────────
router.put('/:id/slideshow/:itemId', protect, authorize('admin','superadmin'), async (req, res) => {
  try {
    const hid = req.user.role === 'superadmin' ? req.params.id : (req.user.hospitalId?._id || req.user.hospitalId);
    if (req.user.role !== 'superadmin' && hid.toString() !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const hospital = await Hospital.findOneAndUpdate(
      { _id: req.params.id, 'slideshow._id': req.params.itemId },
      { $set: {
        'slideshow.$.duration': req.body.duration,
        'slideshow.$.caption':  req.body.caption,
        'slideshow.$.isActive': req.body.isActive,
        'slideshow.$.order':    req.body.order,
      }},
      { new: true }
    );
    res.json({ success:true, slideshow: hospital.slideshow });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── Slideshow: Bulk Delete ─────────────────────────────────────────
router.post('/:id/slideshow/bulk-delete', protect, authorize('admin','superadmin'), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ success:false, message:'Invalid IDs' });
    
    const hid = req.user.role === 'superadmin' ? req.params.id : (req.user.hospitalId?._id || req.user.hospitalId);
    if (req.user.role !== 'superadmin' && hid.toString() !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const hospital = await Hospital.findByIdAndUpdate(req.params.id,
      { $pull: { slideshow: { _id: { $in: ids } } } },
      { new: true }
    );
    res.json({ success:true, slideshow: hospital.slideshow });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── Slideshow: Delete item ─────────────────────────────────────────
router.delete('/:id/slideshow/:itemId', protect, authorize('admin','superadmin'), async (req, res) => {
  try {
    const hid = req.user.role === 'superadmin' ? req.params.id : (req.user.hospitalId?._id || req.user.hospitalId);
    if (req.user.role !== 'superadmin' && hid.toString() !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const hospital = await Hospital.findByIdAndUpdate(req.params.id,
      { $pull: { slideshow: { _id: req.params.itemId } } },
      { new: true }
    );
    res.json({ success:true, slideshow: hospital.slideshow });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── Slideshow: Reorder ─────────────────────────────────────────────
router.put('/:id/slideshow', protect, authorize('admin','superadmin'), async (req, res) => {
  try {
    // req.body.order = [{id, order}, ...]
    const ops = (req.body.order || []).map(item =>
      Hospital.findOneAndUpdate(
        { _id: req.params.id, 'slideshow._id': item.id },
        { $set: { 'slideshow.$.order': item.order } }
      )
    );
    await Promise.all(ops);
    const hospital = await Hospital.findById(req.params.id);
    res.json({ success:true, slideshow: hospital.slideshow });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── Audit Logs (Admin/Superadmin only) ───────────────────────────
router.get('/:id/audit', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { action, targetType, limit = 200 } = req.query;
    const AuditLog = require('../models/AuditLog');
    
    const query = { hospitalId: req.params.id };
    if (action) query.action = action;
    if (targetType) query.targetType = targetType;

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit));
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Test SMS ──────────────────────────────────────────────────────
router.post('/test-sms', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { testPhone, hospitalId } = req.body;
    if (!testPhone) return res.status(400).json({ success: false, message: 'Test phone number is required' });

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });

    const result = await sendHospitalSms({
      hospitalId,
      to: testPhone,
      message: `${hospital.shortName || hospital.name}: This is a test SMS message from your gateway configuration.`
    });

    res.json({ success: true, message: 'Test SMS sent successfully!', result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Update Announcement (Staff/Admin) ──────────────────────────────
router.put('/:id/announcement', protect, authorize('staff', 'admin', 'superadmin'), async (req, res) => {
  try {
    const { announcement } = req.body;
    const hid = req.user.role === 'superadmin' ? req.params.id : (req.user.hospitalId?._id || req.user.hospitalId);
    
    if (req.user.role !== 'superadmin' && hid.toString() !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const hospital = await Hospital.findByIdAndUpdate(req.params.id, { announcement }, { new: true });
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });

    // Notify displays via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${req.params.id}`).emit('announcement_updated', { announcement });
      io.to(`display_${req.params.id}`).emit('announcement_updated', { announcement });
    }

    res.json({ success: true, message: 'Announcement updated successfully', announcement: hospital.announcement });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Send Manual SMS (Staff/Admin) ──────────────────────────────────
router.post('/send-manual-sms', protect, authorize('staff', 'admin', 'superadmin'), async (req, res) => {
  try {
    const { to, message, hospitalId: bodyHid } = req.body;
    const hid = req.user.role === 'superadmin' ? bodyHid : req.user.hospitalId?._id;
    
    if (!to || !message) return res.status(400).json({ success: false, message: 'Recipient and message required' });

    const result = await sendHospitalSms({
      hospitalId: hid,
      to,
      message: message // Raw message override
    });

    res.json({ success: true, message: 'SMS sent successfully', result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
