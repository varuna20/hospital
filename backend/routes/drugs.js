/**
 * DRUG LIBRARY ROUTES
 * ====================
 * GET  /api/drugs              - Search/list drugs (doctor + staff)
 * POST /api/drugs              - Add drug manually (admin)
 * PUT  /api/drugs/:id          - Update drug (admin)
 * DELETE /api/drugs/:id        - Delete drug (admin)
 * POST /api/drugs/import-csv   - Bulk import from CSV (admin)
 * GET  /api/drugs/categories   - List all categories
 */
const express = require('express');
const router  = express.Router();
const Drug    = require('../models/Drug');
const { protect, authorize } = require('../middleware/auth');
const multer  = require('multer');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function getHospId(req) {
  if (req.user.role === 'superadmin') return req.query.hospitalId || req.body.hospitalId;
  const hid = req.user.hospitalId;
  return hid?._id ? hid._id.toString() : hid?.toString();
}

// ── Search / List ─────────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const { q, category, page = 1, limit = 50 } = req.query;
    const hid = getHospId(req);
    const filter = {
      isActive: true,
      $or: [{ hospitalId: hid }, { isGlobal: true }]
    };
    if (category) filter.category = category;
    if (q && q.length >= 1) {
      filter.$and = [
        { $or: [{ hospitalId: hid }, { isGlobal: true }] },
        { $or: [
          { name:        { $regex: q, $options: 'i' } },
          { genericName: { $regex: q, $options: 'i' } },
          { category:    { $regex: q, $options: 'i' } },
          { brand:       { $regex: q, $options: 'i' } },
        ]}
      ];
      delete filter.$or;
    }
    const drugs = await Drug.find(filter)
      .sort({ isGlobal: -1, name: 1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));
    const total = await Drug.countDocuments(filter);
    res.json({ success: true, drugs, total });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Categories ────────────────────────────────────────────────────
router.get('/categories', protect, async (req, res) => {
  try {
    const hid = getHospId(req);
    const cats = await Drug.distinct('category', {
      isActive: true,
      $or: [{ hospitalId: hid }, { isGlobal: true }]
    });
    res.json({ success: true, categories: cats.filter(Boolean).sort() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Add drug manually ─────────────────────────────────────────────
router.post('/', protect, authorize('admin', 'doctor', 'superadmin'), async (req, res) => {
  try {
    const hid = getHospId(req);
    const drug = await Drug.create({ ...req.body, hospitalId: hid });

    // Audit log
    const { logAudit } = require('../utils/audit');
    await logAudit(req, {
      action: 'ADD_DRUG',
      targetType: 'Drug',
      targetId: drug._id,
      targetName: drug.name,
      newValues: drug.toObject()
    });

    res.status(201).json({ success: true, drug });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Update ────────────────────────────────────────────────────────
router.put('/:id', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const drugBefore = await Drug.findById(req.params.id);
    const drug = await Drug.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!drug) return res.status(404).json({ success: false, message: 'Not found' });

    // Audit log
    const { logAudit } = require('../utils/audit');
    await logAudit(req, {
      action: 'UPDATE_DRUG',
      targetType: 'Drug',
      targetId: drug._id,
      targetName: drug.name,
      oldValues: drugBefore.toObject(),
      newValues: drug.toObject()
    });

    res.json({ success: true, drug });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Delete ────────────────────────────────────────────────────────
router.delete('/:id', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const drug = await Drug.findByIdAndUpdate(req.params.id, { isActive: false });
    
    // Audit log
    const { logAudit } = require('../utils/audit');
    await logAudit(req, {
      action: 'DELETE_DRUG',
      targetType: 'Drug',
      targetId: drug._id,
      targetName: drug.name
    });

    res.json({ success: true, message: 'Drug removed from library' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── CSV Import ────────────────────────────────────────────────────
router.post('/import-csv', protect, authorize('admin', 'superadmin'), upload.single('csv'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No CSV file uploaded' });
    const hid = getHospId(req);
    const text = req.file.buffer.toString('utf-8');
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return res.status(400).json({ success: false, message: 'CSV must have a header and at least one data row' });

    // Parse header
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z]/g, ''));
    const fieldMap = {
      name: ['name', 'drugname', 'drug'],
      genericName: ['genericname', 'generic'],
      brand: ['brand', 'brandname'],
      category: ['category', 'type', 'class'],
      defaultDosage: ['defaultdosage', 'dosage', 'dose', 'strength'],
      defaultFrequency: ['defaultfrequency', 'frequency', 'freq'],
      defaultDuration: ['defaultduration', 'duration'],
      defaultRoute: ['defaultroute', 'route'],
      defaultInstructions: ['defaultinstructions', 'instructions', 'instruction'],
      strengths: ['strengths', 'availablestrengths'],
      forms: ['forms', 'availableforms', 'dosageform'],
      description: ['description', 'notes'],
    };

    // Map headers to field names
    const colMap = {};
    headers.forEach((h, i) => {
      for (const [field, aliases] of Object.entries(fieldMap)) {
        if (aliases.includes(h)) { colMap[field] = i; break; }
      }
    });

    if (!('name' in colMap)) {
      return res.status(400).json({ success: false, message: 'CSV must have a "name" column' });
    }

    const get = (row, field) => {
      const idx = colMap[field];
      return idx !== undefined ? (row[idx] || '').trim().replace(/^"|"$/g,'') : '';
    };

    let imported = 0, skipped = 0;
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',');
      const name = get(row, 'name');
      if (!name) { skipped++; continue; }
      // Upsert by name + hospitalId
      await Drug.findOneAndUpdate(
        { name: { $regex: new RegExp(`^${name}$`, 'i') }, hospitalId: hid },
        {
          $set: {
            name, hospitalId: hid,
            genericName: get(row, 'genericName') || undefined,
            brand:       get(row, 'brand') || undefined,
            category:    get(row, 'category') || undefined,
            defaultDosage:       get(row, 'defaultDosage') || undefined,
            defaultFrequency:    get(row, 'defaultFrequency') || undefined,
            defaultDuration:     get(row, 'defaultDuration') || undefined,
            defaultRoute:        get(row, 'defaultRoute') || 'Oral',
            defaultInstructions: get(row, 'defaultInstructions') || undefined,
            strengths: get(row, 'strengths') ? get(row, 'strengths').split(';').map(s=>s.trim()) : undefined,
            forms:     get(row, 'forms') ? get(row, 'forms').split(';').map(s=>s.trim()) : undefined,
            description: get(row, 'description') || undefined,
            isActive: true,
          }
        },
        { upsert: true, setDefaultsOnInsert: true }
      );
      imported++;
    }

    // Audit log for bulk import
    const { logAudit } = require('../utils/audit');
    await logAudit(req, {
      action: 'IMPORT_DRUGS_CSV',
      targetType: 'DrugLibrary',
      targetName: `CSV Import: ${imported} drugs`,
      metadata: { imported, skipped }
    });

    res.json({ success: true, message: `Imported ${imported} drugs, skipped ${skipped} empty rows` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
