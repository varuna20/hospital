/**
 * EMERGENCY RECOVERY ROUTES
 * ==========================
 * Protected by ADMIN_RESET_KEY env var — NOT by JWT.
 * Use these when a bad restore has corrupted the database
 * and normal login is impossible.
 *
 * POST /api/emergency/repair-db      - Fix corrupted ObjectId fields from bad restore
 * POST /api/emergency/reset-superadmin - Force-reset the superadmin password
 *
 * All endpoints require header:  X-Admin-Key: <ADMIN_RESET_KEY>
 */
const express  = require('express');
const router   = express.Router();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const { EJSON, ObjectId } = require('bson');

// ── Key guard ─────────────────────────────────────────────────────────────────
const keyGuard = (req, res, next) => {
  const key = req.headers['x-admin-key'] || req.body?.adminKey;
  const expected = process.env.ADMIN_RESET_KEY || 'hospital-emergency-2025';
  if (!key || key !== expected)
    return res.status(403).json({ success: false, message: 'Invalid or missing X-Admin-Key header' });
  next();
};

// ── Detect if a value looks like a serialised EJSON ObjectId ─────────────────
const isCorruptedOid = (v) =>
  v && typeof v === 'object' && !Array.isArray(v) &&
  Object.keys(v).length === 1 && (v.$oid || v['$oid']);

const isCorruptedDate = (v) =>
  v && typeof v === 'object' && !Array.isArray(v) &&
  Object.keys(v).length === 1 && (v.$date !== undefined);

// Recursively repair a document's fields
const repairDoc = (doc) => {
  if (!doc || typeof doc !== 'object') return doc;
  if (Array.isArray(doc)) return doc.map(repairDoc);

  const out = {};
  for (const [k, v] of Object.entries(doc)) {
    if (isCorruptedOid(v)) {
      try { out[k] = new ObjectId(v.$oid); }
      catch { out[k] = v; }
    } else if (isCorruptedDate(v)) {
      out[k] = new Date(v.$date);
    } else if (typeof v === 'object' && v !== null) {
      out[k] = repairDoc(v);
    } else {
      out[k] = v;
    }
  }
  return out;
};

// ── POST /api/emergency/repair-db ─────────────────────────────────────────────
router.post('/repair-db', keyGuard, async (req, res) => {
  // Return immediately so the client doesn't time out
  res.json({ success: true, message: 'Database repair started — check server logs for progress' });

  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    let totalFixed = 0;

    for (const { name } of collections) {
      if (name.startsWith('system.')) continue;
      const col = db.collection(name);

      console.log(`🔧 Scanning collection: ${name}`);
      const cursor = col.find({});
      let batchOps = [];
      let colFixed  = 0;

      let doc;
      while ((doc = await cursor.next()) !== null) {
        const repaired = repairDoc(doc);

        // Only update if something actually changed
        if (JSON.stringify(doc) !== JSON.stringify(repaired)) {
          // The _id in repaired is now a real ObjectId — use the original raw _id for the filter
          const rawId = doc._id;
          batchOps.push({
            replaceOne: {
              filter: { _id: rawId },
              replacement: repaired
            }
          });
          colFixed++;
        }

        if (batchOps.length >= 50) {
          await col.bulkWrite(batchOps, { ordered: false });
          totalFixed += batchOps.length;
          batchOps = [];
        }
      }

      if (batchOps.length > 0) {
        await col.bulkWrite(batchOps, { ordered: false });
        totalFixed += batchOps.length;
      }

      if (colFixed > 0) console.log(`  ✅ ${name}: fixed ${colFixed} documents`);
      else console.log(`  ✓ ${name}: clean`);
    }

    console.log(`\n🎉 DB repair complete — ${totalFixed} documents repaired across ${collections.length} collections`);
  } catch (err) {
    console.error('❌ DB repair error:', err.message);
  }
});

// ── POST /api/emergency/reset-superadmin ─────────────────────────────────────
router.post('/reset-superadmin', keyGuard, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'email and password are required in request body' });

    const db  = mongoose.connection.db;
    const col = db.collection('users');

    const hashed = await bcrypt.hash(password, 12);

    // Try to update existing superadmin
    const result = await col.updateOne(
      { role: 'superadmin' },
      { $set: { email: email.toLowerCase().trim(), password: hashed, isActive: true } }
    );

    if (result.matchedCount === 0) {
      // No superadmin found — create one
      await col.insertOne({
        _id: new ObjectId(),
        name: 'Super Admin',
        email: email.toLowerCase().trim(),
        password: hashed,
        role: 'superadmin',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return res.json({ success: true, message: `New superadmin created: ${email}` });
    }

    res.json({ success: true, message: `Superadmin password reset for: ${email}` });
  } catch (err) {
    console.error('Reset error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
