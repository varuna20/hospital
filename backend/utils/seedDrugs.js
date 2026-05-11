/**
 * Default drug library - common Sri Lankan hospital drugs
 * Run with: node utils/seedDrugs.js
 * Or called from initDefaults.js automatically
 */
const Drug = require('../models/Drug');

const DEFAULT_DRUGS = [
  // Analgesics / Antipyretics
  { name:'Paracetamol', genericName:'Acetaminophen', category:'Analgesic/Antipyretic', defaultDosage:'500mg', defaultFrequency:'3 times daily', defaultDuration:'5 days', defaultRoute:'Oral', defaultInstructions:'Take after food', strengths:['250mg','500mg','1000mg'], forms:['Tablet','Syrup'], isGlobal:true },
  { name:'Ibuprofen', genericName:'Ibuprofen', category:'NSAID/Analgesic', defaultDosage:'400mg', defaultFrequency:'3 times daily', defaultDuration:'5 days', defaultRoute:'Oral', defaultInstructions:'Take after food with plenty of water', strengths:['200mg','400mg','600mg'], forms:['Tablet','Capsule'], isGlobal:true },
  { name:'Aspirin', genericName:'Acetylsalicylic acid', category:'Analgesic/Antiplatelet', defaultDosage:'75mg', defaultFrequency:'Once daily', defaultDuration:'Ongoing', defaultRoute:'Oral', defaultInstructions:'Take after food', strengths:['75mg','300mg'], forms:['Tablet'], isGlobal:true },
  { name:'Diclofenac', genericName:'Diclofenac Sodium', category:'NSAID', defaultDosage:'50mg', defaultFrequency:'Twice daily', defaultDuration:'5 days', defaultRoute:'Oral', defaultInstructions:'Take after food', strengths:['25mg','50mg','75mg'], forms:['Tablet','Gel'], isGlobal:true },
  { name:'Tramadol', genericName:'Tramadol HCl', category:'Opioid Analgesic', defaultDosage:'50mg', defaultFrequency:'Every 8 hours', defaultDuration:'3 days', defaultRoute:'Oral', defaultInstructions:'Take as needed for pain', strengths:['50mg','100mg'], forms:['Tablet','Capsule'], isGlobal:true },

  // Antibiotics
  { name:'Amoxicillin', genericName:'Amoxicillin', category:'Antibiotic', defaultDosage:'500mg', defaultFrequency:'3 times daily', defaultDuration:'7 days', defaultRoute:'Oral', defaultInstructions:'Complete full course', strengths:['250mg','500mg'], forms:['Capsule','Syrup'], isGlobal:true },
  { name:'Amoxicillin + Clavulanate', genericName:'Co-amoxiclav', category:'Antibiotic', defaultDosage:'625mg', defaultFrequency:'Twice daily', defaultDuration:'7 days', defaultRoute:'Oral', defaultInstructions:'Take after food', strengths:['375mg','625mg'], forms:['Tablet'], isGlobal:true },
  { name:'Azithromycin', genericName:'Azithromycin', category:'Antibiotic', defaultDosage:'500mg', defaultFrequency:'Once daily', defaultDuration:'3 days', defaultRoute:'Oral', defaultInstructions:'Take 1 hour before or 2 hours after food', strengths:['250mg','500mg'], forms:['Tablet'], isGlobal:true },
  { name:'Ciprofloxacin', genericName:'Ciprofloxacin', category:'Antibiotic', defaultDosage:'500mg', defaultFrequency:'Twice daily', defaultDuration:'7 days', defaultRoute:'Oral', defaultInstructions:'Take with plenty of water, avoid dairy', strengths:['250mg','500mg','750mg'], forms:['Tablet'], isGlobal:true },
  { name:'Metronidazole', genericName:'Metronidazole', category:'Antibiotic/Antiprotozoal', defaultDosage:'400mg', defaultFrequency:'3 times daily', defaultDuration:'7 days', defaultRoute:'Oral', defaultInstructions:'Take after food, avoid alcohol', strengths:['200mg','400mg'], forms:['Tablet'], isGlobal:true },
  { name:'Doxycycline', genericName:'Doxycycline', category:'Antibiotic', defaultDosage:'100mg', defaultFrequency:'Twice daily', defaultDuration:'7 days', defaultRoute:'Oral', defaultInstructions:'Take with full glass of water, avoid lying down for 30 min', strengths:['50mg','100mg'], forms:['Capsule'], isGlobal:true },
  { name:'Cephalexin', genericName:'Cefalexin', category:'Antibiotic', defaultDosage:'500mg', defaultFrequency:'4 times daily', defaultDuration:'7 days', defaultRoute:'Oral', defaultInstructions:'Can be taken with or without food', strengths:['250mg','500mg'], forms:['Capsule'], isGlobal:true },
  { name:'Clarithromycin', genericName:'Clarithromycin', category:'Antibiotic', defaultDosage:'500mg', defaultFrequency:'Twice daily', defaultDuration:'7 days', defaultRoute:'Oral', defaultInstructions:'Can be taken with or without food', strengths:['250mg','500mg'], forms:['Tablet'], isGlobal:true },
  { name:'Trimethoprim + Sulfamethoxazole', genericName:'Co-trimoxazole', category:'Antibiotic', defaultDosage:'960mg', defaultFrequency:'Twice daily', defaultDuration:'7 days', defaultRoute:'Oral', defaultInstructions:'Take with plenty of water', strengths:['480mg','960mg'], forms:['Tablet'], isGlobal:true },

  // Antihypertensives
  { name:'Amlodipine', genericName:'Amlodipine', category:'Antihypertensive (CCB)', defaultDosage:'5mg', defaultFrequency:'Once daily', defaultDuration:'Ongoing', defaultRoute:'Oral', defaultInstructions:'Take at same time each day', strengths:['2.5mg','5mg','10mg'], forms:['Tablet'], isGlobal:true },
  { name:'Atenolol', genericName:'Atenolol', category:'Antihypertensive (Beta blocker)', defaultDosage:'50mg', defaultFrequency:'Once daily', defaultDuration:'Ongoing', defaultRoute:'Oral', defaultInstructions:'Take at same time each day', strengths:['25mg','50mg','100mg'], forms:['Tablet'], isGlobal:true },
  { name:'Lisinopril', genericName:'Lisinopril', category:'Antihypertensive (ACE inhibitor)', defaultDosage:'5mg', defaultFrequency:'Once daily', defaultDuration:'Ongoing', defaultRoute:'Oral', defaultInstructions:'Take at same time each day', strengths:['2.5mg','5mg','10mg','20mg'], forms:['Tablet'], isGlobal:true },
  { name:'Losartan', genericName:'Losartan Potassium', category:'Antihypertensive (ARB)', defaultDosage:'50mg', defaultFrequency:'Once daily', defaultDuration:'Ongoing', defaultRoute:'Oral', defaultInstructions:'Can be taken with or without food', strengths:['25mg','50mg','100mg'], forms:['Tablet'], isGlobal:true },
  { name:'Metoprolol', genericName:'Metoprolol Succinate', category:'Antihypertensive (Beta blocker)', defaultDosage:'50mg', defaultFrequency:'Once daily', defaultDuration:'Ongoing', defaultRoute:'Oral', defaultInstructions:'Take with or after food', strengths:['25mg','50mg','100mg'], forms:['Tablet'], isGlobal:true },
  { name:'Hydrochlorothiazide', genericName:'Hydrochlorothiazide', category:'Antihypertensive (Diuretic)', defaultDosage:'25mg', defaultFrequency:'Once daily', defaultDuration:'Ongoing', defaultRoute:'Oral', defaultInstructions:'Take in the morning', strengths:['12.5mg','25mg'], forms:['Tablet'], isGlobal:true },

  // Diabetes
  { name:'Metformin', genericName:'Metformin HCl', category:'Antidiabetic (Biguanide)', defaultDosage:'500mg', defaultFrequency:'Twice daily', defaultDuration:'Ongoing', defaultRoute:'Oral', defaultInstructions:'Take with meals', strengths:['500mg','850mg','1000mg'], forms:['Tablet'], isGlobal:true },
  { name:'Glibenclamide', genericName:'Glibenclamide', category:'Antidiabetic (Sulfonylurea)', defaultDosage:'5mg', defaultFrequency:'Once daily', defaultDuration:'Ongoing', defaultRoute:'Oral', defaultInstructions:'Take before meals', strengths:['2.5mg','5mg'], forms:['Tablet'], isGlobal:true },
  { name:'Glimepiride', genericName:'Glimepiride', category:'Antidiabetic (Sulfonylurea)', defaultDosage:'1mg', defaultFrequency:'Once daily', defaultDuration:'Ongoing', defaultRoute:'Oral', defaultInstructions:'Take with breakfast', strengths:['1mg','2mg','4mg'], forms:['Tablet'], isGlobal:true },

  // Gastrointestinal
  { name:'Omeprazole', genericName:'Omeprazole', category:'Proton Pump Inhibitor', defaultDosage:'20mg', defaultFrequency:'Once daily', defaultDuration:'14 days', defaultRoute:'Oral', defaultInstructions:'Take 30 minutes before meals', strengths:['10mg','20mg','40mg'], forms:['Capsule','Tablet'], isGlobal:true },
  { name:'Pantoprazole', genericName:'Pantoprazole', category:'Proton Pump Inhibitor', defaultDosage:'40mg', defaultFrequency:'Once daily', defaultDuration:'14 days', defaultRoute:'Oral', defaultInstructions:'Take 30 minutes before meals', strengths:['20mg','40mg'], forms:['Tablet'], isGlobal:true },
  { name:'Ranitidine', genericName:'Ranitidine', category:'H2 Blocker', defaultDosage:'150mg', defaultFrequency:'Twice daily', defaultDuration:'4 weeks', defaultRoute:'Oral', defaultInstructions:'Take before meals', strengths:['75mg','150mg','300mg'], forms:['Tablet'], isGlobal:true },
  { name:'Domperidone', genericName:'Domperidone', category:'Antiemetic/Prokinetic', defaultDosage:'10mg', defaultFrequency:'3 times daily', defaultDuration:'7 days', defaultRoute:'Oral', defaultInstructions:'Take 30 minutes before meals', strengths:['10mg'], forms:['Tablet'], isGlobal:true },
  { name:'Ondansetron', genericName:'Ondansetron', category:'Antiemetic', defaultDosage:'8mg', defaultFrequency:'Every 8 hours', defaultDuration:'3 days', defaultRoute:'Oral', defaultInstructions:'Take 30 minutes before meals', strengths:['4mg','8mg'], forms:['Tablet'], isGlobal:true },
  { name:'Metoclopramide', genericName:'Metoclopramide', category:'Antiemetic/Prokinetic', defaultDosage:'10mg', defaultFrequency:'3 times daily', defaultDuration:'5 days', defaultRoute:'Oral', defaultInstructions:'Take 30 minutes before meals', strengths:['10mg'], forms:['Tablet'], isGlobal:true },
  { name:'Hyoscine Butylbromide', genericName:'Hyoscine Butylbromide', category:'Antispasmodic', defaultDosage:'10mg', defaultFrequency:'3 times daily', defaultDuration:'5 days', defaultRoute:'Oral', defaultInstructions:'Take as needed for cramping', strengths:['10mg'], forms:['Tablet'], isGlobal:true },

  // Respiratory
  { name:'Salbutamol', genericName:'Albuterol', category:'Bronchodilator', defaultDosage:'2 puffs', defaultFrequency:'Every 4-6 hours', defaultDuration:'As needed', defaultRoute:'Inhaled', defaultInstructions:'Shake inhaler before use', strengths:['100mcg/puff'], forms:['Inhaler'], isGlobal:true },
  { name:'Cetirizine', genericName:'Cetirizine HCl', category:'Antihistamine', defaultDosage:'10mg', defaultFrequency:'Once daily', defaultDuration:'7 days', defaultRoute:'Oral', defaultInstructions:'Take at bedtime', strengths:['5mg','10mg'], forms:['Tablet'], isGlobal:true },
  { name:'Loratadine', genericName:'Loratadine', category:'Antihistamine', defaultDosage:'10mg', defaultFrequency:'Once daily', defaultDuration:'7 days', defaultRoute:'Oral', defaultInstructions:'Can be taken with or without food', strengths:['10mg'], forms:['Tablet'], isGlobal:true },
  { name:'Chlorphenamine', genericName:'Chlorpheniramine', category:'Antihistamine', defaultDosage:'4mg', defaultFrequency:'Every 4-6 hours', defaultDuration:'5 days', defaultRoute:'Oral', defaultInstructions:'May cause drowsiness', strengths:['4mg'], forms:['Tablet'], isGlobal:true },

  // Vitamins & Supplements
  { name:'Vitamin C', genericName:'Ascorbic Acid', category:'Vitamin/Supplement', defaultDosage:'500mg', defaultFrequency:'Once daily', defaultDuration:'30 days', defaultRoute:'Oral', defaultInstructions:'Can be taken with or without food', strengths:['250mg','500mg'], forms:['Tablet'], isGlobal:true },
  { name:'Vitamin B Complex', genericName:'B1+B2+B6+B12', category:'Vitamin/Supplement', defaultDosage:'1 tablet', defaultFrequency:'Once daily', defaultDuration:'30 days', defaultRoute:'Oral', defaultInstructions:'Take after meals', strengths:['Standard'], forms:['Tablet'], isGlobal:true },
  { name:'Folic Acid', genericName:'Folic Acid', category:'Vitamin/Supplement', defaultDosage:'5mg', defaultFrequency:'Once daily', defaultDuration:'90 days', defaultRoute:'Oral', defaultInstructions:'Take at same time each day', strengths:['400mcg','5mg'], forms:['Tablet'], isGlobal:true },
  { name:'Iron + Folic Acid', genericName:'Ferrous Sulphate + Folic Acid', category:'Vitamin/Supplement', defaultDosage:'200mg', defaultFrequency:'Once daily', defaultDuration:'90 days', defaultRoute:'Oral', defaultInstructions:'Take on empty stomach or with food if stomach upset', strengths:['200mg+5mg'], forms:['Tablet'], isGlobal:true },
  { name:'Calcium + Vitamin D3', genericName:'Calcium Carbonate + Cholecalciferol', category:'Vitamin/Supplement', defaultDosage:'500mg', defaultFrequency:'Twice daily', defaultDuration:'90 days', defaultRoute:'Oral', defaultInstructions:'Take with meals', strengths:['500mg+250IU'], forms:['Tablet'], isGlobal:true },

  // Cholesterol
  { name:'Atorvastatin', genericName:'Atorvastatin', category:'Statin/Cholesterol', defaultDosage:'20mg', defaultFrequency:'Once daily at night', defaultDuration:'Ongoing', defaultRoute:'Oral', defaultInstructions:'Take at bedtime', strengths:['10mg','20mg','40mg','80mg'], forms:['Tablet'], isGlobal:true },
  { name:'Simvastatin', genericName:'Simvastatin', category:'Statin/Cholesterol', defaultDosage:'20mg', defaultFrequency:'Once daily at night', defaultDuration:'Ongoing', defaultRoute:'Oral', defaultInstructions:'Take at bedtime', strengths:['10mg','20mg','40mg'], forms:['Tablet'], isGlobal:true },

  // Thyroid
  { name:'Levothyroxine', genericName:'Levothyroxine Sodium', category:'Thyroid', defaultDosage:'50mcg', defaultFrequency:'Once daily', defaultDuration:'Ongoing', defaultRoute:'Oral', defaultInstructions:'Take 30 minutes before breakfast on empty stomach', strengths:['25mcg','50mcg','100mcg'], forms:['Tablet'], isGlobal:true },

  // Topical
  { name:'Betamethasone Cream', genericName:'Betamethasone', category:'Corticosteroid (Topical)', defaultDosage:'Thin layer', defaultFrequency:'Twice daily', defaultDuration:'7 days', defaultRoute:'Topical', defaultInstructions:'Apply to affected area only', strengths:['0.1%'], forms:['Cream','Ointment'], isGlobal:true },
  { name:'Clotrimazole Cream', genericName:'Clotrimazole', category:'Antifungal (Topical)', defaultDosage:'Thin layer', defaultFrequency:'Twice daily', defaultDuration:'14 days', defaultRoute:'Topical', defaultInstructions:'Apply to clean dry skin', strengths:['1%'], forms:['Cream'], isGlobal:true },
  { name:'Mupirocin Ointment', genericName:'Mupirocin', category:'Antibiotic (Topical)', defaultDosage:'Small amount', defaultFrequency:'3 times daily', defaultDuration:'10 days', defaultRoute:'Topical', defaultInstructions:'Apply to affected area', strengths:['2%'], forms:['Ointment'], isGlobal:true },
];

async function seedDefaultDrugs() {
  const count = await Drug.countDocuments({ isGlobal: true });
  if (count > 0) {
    console.log(`ℹ️  Drug library already has ${count} global drugs`);
    return;
  }
  await Drug.insertMany(DEFAULT_DRUGS);
  console.log(`✅ Seeded ${DEFAULT_DRUGS.length} default drugs`);
}

module.exports = { seedDefaultDrugs };
