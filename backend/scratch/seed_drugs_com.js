const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const Drug = require('../models/Drug');

const drugsToUpdate = [
  {
    name: 'Acetaminophen',
    genericName: 'acetaminophen',
    category: 'Miscellaneous analgesics',
    defaultDosage: '500mg',
    defaultFrequency: 'Every 4-6 hours',
    defaultDuration: '3 days',
    defaultInstructions: 'Do not exceed 4g per day. Take after food.',
    strengths: ['325mg', '500mg', '650mg'],
    forms: ['Tablet', 'Capsule', 'Syrup'],
    description: 'Relieves pain and reduces fever.'
  },
  {
    name: 'Adderall',
    genericName: 'amphetamine and dextroamphetamine',
    category: 'CNS stimulants',
    defaultDosage: '10mg',
    defaultFrequency: 'Once daily',
    defaultDuration: 'Ongoing',
    defaultInstructions: 'Take in the morning. May cause insomnia if taken late.',
    strengths: ['5mg', '10mg', '20mg', '30mg'],
    forms: ['Tablet', 'Capsule ER'],
    description: 'Used for ADHD and narcolepsy.'
  },
  {
    name: 'Amoxicillin',
    genericName: 'amoxicillin',
    category: 'Aminopenicillins (Antibiotic)',
    defaultDosage: '500mg',
    defaultFrequency: 'Every 8 hours',
    defaultDuration: '7 days',
    defaultInstructions: 'Complete the full course. Can be taken with or without food.',
    strengths: ['250mg', '500mg', '875mg'],
    forms: ['Capsule', 'Tablet', 'Suspension'],
    description: 'Penicillin-type antibiotic for bacterial infections.'
  },
  {
    name: 'Atorvastatin',
    genericName: 'atorvastatin',
    category: 'Statins',
    defaultDosage: '20mg',
    defaultFrequency: 'Once daily',
    defaultDuration: 'Ongoing',
    defaultInstructions: 'Take at the same time each day. Avoid grapefruit juice.',
    strengths: ['10mg', '20mg', '40mg', '80mg'],
    forms: ['Tablet'],
    description: 'Lowers cholesterol and triglycerides.'
  },
  {
    name: 'Azithromycin',
    genericName: 'azithromycin',
    category: 'Macrolides (Antibiotic)',
    defaultDosage: '500mg',
    defaultFrequency: 'Once daily',
    defaultDuration: '3 days',
    defaultInstructions: 'Take 1 hour before or 2 hours after food.',
    strengths: ['250mg', '500mg'],
    forms: ['Tablet', 'Suspension'],
    description: 'Used for respiratory and skin infections.'
  },
  {
    name: 'Gabapentin',
    genericName: 'gabapentin',
    category: 'Gabapentinoids (Anticonvulsant)',
    defaultDosage: '300mg',
    defaultFrequency: 'Three times daily',
    defaultDuration: 'Ongoing',
    defaultInstructions: 'Do not stop abruptly. May cause drowsiness.',
    strengths: ['100mg', '300mg', '400mg', '600mg', '800mg'],
    forms: ['Capsule', 'Tablet', 'Solution'],
    description: 'Used for seizures and nerve pain.'
  },
  {
    name: 'Ibuprofen',
    genericName: 'ibuprofen',
    category: 'NSAIDs',
    defaultDosage: '400mg',
    defaultFrequency: 'Every 6 hours',
    defaultDuration: '5 days',
    defaultInstructions: 'Take with food or milk to prevent stomach upset.',
    strengths: ['200mg', '400mg', '600mg', '800mg'],
    forms: ['Tablet', 'Capsule', 'Suspension'],
    description: 'Reduces inflammation, pain, and fever.'
  },
  {
    name: 'Metformin',
    genericName: 'metformin',
    category: 'Non-sulfonylureas (Antidiabetic)',
    defaultDosage: '500mg',
    defaultFrequency: 'Twice daily',
    defaultDuration: 'Ongoing',
    defaultInstructions: 'Take with meals to reduce GI side effects.',
    strengths: ['500mg', '850mg', '1000mg'],
    forms: ['Tablet', 'Tablet ER'],
    description: 'First-line medication for Type 2 Diabetes.'
  },
  {
    name: 'Metoprolol',
    genericName: 'metoprolol',
    category: 'Cardioselective beta blockers',
    defaultDosage: '50mg',
    defaultFrequency: 'Twice daily',
    defaultDuration: 'Ongoing',
    defaultInstructions: 'Check heart rate before taking. Do not skip doses.',
    strengths: ['25mg', '50mg', '100mg', '200mg'],
    forms: ['Tablet', 'Tablet ER'],
    description: 'Used for hypertension and angina.'
  },
  {
    name: 'Naproxen',
    genericName: 'naproxen',
    category: 'NSAIDs',
    defaultDosage: '250mg',
    defaultFrequency: 'Twice daily',
    defaultDuration: '7 days',
    defaultInstructions: 'Take with a full glass of water and food.',
    strengths: ['250mg', '375mg', '500mg'],
    forms: ['Tablet', 'Suspension'],
    description: 'Relieves pain, swelling, and joint stiffness.'
  },
  {
    name: 'Omeprazole',
    genericName: 'omeprazole',
    category: 'Proton pump inhibitors',
    defaultDosage: '20mg',
    defaultFrequency: 'Once daily',
    defaultDuration: '14 days',
    defaultInstructions: 'Take 30-60 minutes before breakfast.',
    strengths: ['10mg', '20mg', '40mg'],
    forms: ['Capsule DR', 'Tablet DR'],
    description: 'Treats heartburn and GERD.'
  },
  {
    name: 'Tramadol',
    genericName: 'tramadol',
    category: 'Opioids',
    defaultDosage: '50mg',
    defaultFrequency: 'Every 4-6 hours',
    defaultDuration: '3 days',
    defaultInstructions: 'May cause dizziness or constipation. Avoid alcohol.',
    strengths: ['50mg', '100mg'],
    forms: ['Tablet', 'Capsule', 'Tablet ER'],
    description: 'Centrally acting analgesic for moderate pain.'
  },
  {
    name: 'Trazodone',
    genericName: 'trazodone',
    category: 'Phenylpiperazine antidepressants',
    defaultDosage: '50mg',
    defaultFrequency: 'Once daily (bedtime)',
    defaultDuration: 'Ongoing',
    defaultInstructions: 'Take after a light snack to avoid dizziness.',
    strengths: ['50mg', '100mg', '150mg', '300mg'],
    forms: ['Tablet'],
    description: 'Used for depression and insomnia.'
  },
  {
    name: 'Viagra',
    genericName: 'sildenafil',
    category: 'Impotence agents',
    defaultDosage: '50mg',
    defaultFrequency: 'As needed',
    defaultDuration: 'Single dose',
    defaultInstructions: 'Take 30-60 mins before activity. Max 1 dose per day.',
    strengths: ['25mg', '50mg', '100mg'],
    forms: ['Tablet'],
    description: 'Treats erectile dysfunction.'
  },
  {
    name: 'Wellbutrin',
    genericName: 'bupropion',
    category: 'Miscellaneous antidepressants',
    defaultDosage: '150mg',
    defaultFrequency: 'Once daily',
    defaultDuration: 'Ongoing',
    defaultInstructions: 'Swallow whole. Do not crush or chew.',
    strengths: ['75mg', '100mg', '150mg', '300mg'],
    forms: ['Tablet', 'Tablet SR', 'Tablet XL'],
    description: 'Used for depression and smoking cessation.'
  }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    for (const drugData of drugsToUpdate) {
      await Drug.findOneAndUpdate(
        { name: drugData.name, isGlobal: true },
        { ...drugData, isGlobal: true },
        { upsert: true, new: true }
      );
      console.log(`Updated/Created: ${drugData.name}`);
    }

    console.log('Drug library update complete!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding drugs:', err);
    process.exit(1);
  }
}

seed();
