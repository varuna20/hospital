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
 * @param {string} options.action       - e.g. "UPDATE_DOCTOR_SESSION"
 * @param {string} [options.description] - Human-readable summary, e.g. "Changed session time from 09:00 to 10:00"
 * @param {string} [options.targetType]  - e.g. "Doctor"
 * @param {*}      [options.targetId]
 * @param {string} [options.targetName]
 * @param {*}      [options.oldValues]
 * @param {*}      [options.newValues]
 * @param {*}      [options.metadata]
 */
async function logAudit(req, { action, description, targetType, targetId, targetName, oldValues, newValues, metadata }) {
  try {
    const hospitalId = req.user.hospitalId?._id || req.user.hospitalId;
    if (!hospitalId) return;

    // Auto-generate a description if one is not provided
    let resolvedDescription = description;
    if (!resolvedDescription) {
      if (oldValues && newValues) {
        const changed = Object.keys(newValues)
          .filter(k => JSON.stringify(oldValues[k]) !== JSON.stringify(newValues[k]))
          .map(k => `${k}: "${oldValues[k]}" → "${newValues[k]}"`)
          .join(', ');
        resolvedDescription = changed
          ? `${action.replace(/_/g, ' ')} — ${changed}`
          : action.replace(/_/g, ' ');
      } else {
        resolvedDescription = action.replace(/_/g, ' ');
      }
    }

    await AuditLog.create({
      hospitalId,
      userId:      req.user._id,
      userName:    req.user.name,
      userRole:    req.user.role,
      action,
      description: resolvedDescription,
      targetType,
      targetId,
      targetName,
      oldValues,
      newValues,
      ipAddress:   req.ip,
      userAgent:   req.headers['user-agent'],
      metadata
    });
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}

module.exports = { logAudit };
