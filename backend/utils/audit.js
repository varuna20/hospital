/**
 * AUDIT LOGGER UTILITY
 * =====================
 * Helper to create audit logs in the database.
 */
const AuditLog = require('../models/AuditLog');

/**
 * Log a change to the audit trail
 * @param {Object} req - Express request object (to get user/ip)
 * @param {Object} options - Log details
 */
async function logAudit(req, { action, targetType, targetId, targetName, oldValues, newValues, metadata }) {
  try {
    const hospitalId = req.user.hospitalId?._id || req.user.hospitalId;
    if (!hospitalId) return;

    await AuditLog.create({
      hospitalId,
      userId:     req.user._id,
      userName:   req.user.name,
      userRole:   req.user.role,
      action,
      targetType,
      targetId,
      targetName,
      oldValues,
      newValues,
      ipAddress:  req.ip,
      userAgent:  req.headers['user-agent'],
      metadata
    });
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}

module.exports = { logAudit };
