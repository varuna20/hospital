/**
 * DRUG MODEL
 * ==========
 * Shared drug library — accessible by all doctors and staff in a hospital.
 * Can be seeded from CSV or added manually.
 */
const mongoose = require('mongoose');

const drugSchema = new mongoose.Schema({
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    index: true
  },
  isGlobal: { type: Boolean, default: false }, // true = visible to all hospitals

  // Drug identity
  name:        { type: String, required: true, trim: true, index: true },
  genericName: { type: String, trim: true },
  brand:       String,
  category:    String, // Antibiotic, Analgesic, Antihypertensive, etc.

  // Default prescription details
  defaultDosage:      String,  // "500mg", "10mg"
  defaultFrequency:   String,  // "Twice daily"
  defaultDuration:    String,  // "5 days"
  defaultRoute:       { type: String, default: 'Oral' },
  defaultInstructions: String, // "Take after food"

  // Available strengths
  strengths: [String],  // ["250mg", "500mg", "1000mg"]
  forms:     [String],  // ["Tablet", "Capsule", "Syrup"]

  // Info
  description:     String,
  sideEffects:     String,
  contraindications: String,
  notes:           String,

  isActive: { type: Boolean, default: true }
}, { timestamps: true });

drugSchema.index({ name: 'text', genericName: 'text', category: 'text' });
drugSchema.index({ hospitalId: 1, name: 1 });

module.exports = mongoose.model('Drug', drugSchema);
