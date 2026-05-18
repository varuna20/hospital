require('dotenv').config();
const mongoose = require('mongoose');

async function fixIds() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');
  const db = mongoose.connection.db;

  const collections = await db.collections();

  for (const collection of collections) {
    console.log(`Processing collection: ${collection.collectionName}`);
    const docs = await collection.find({}).toArray();
    let updatedCount = 0;

    for (const doc of docs) {
      let needsInsert = false;
      let needsUpdate = false;
      const newDoc = { ...doc };

      // Helper to traverse and fix 24-char hex strings
      function traverse(obj) {
        let changed = false;
        for (const key in obj) {
          if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
          const value = obj[key];
          
          if (typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value)) {
            obj[key] = new mongoose.Types.ObjectId(value);
            changed = true;
          } else if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
              if (typeof value[i] === 'string' && /^[0-9a-fA-F]{24}$/.test(value[i])) {
                value[i] = new mongoose.Types.ObjectId(value[i]);
                changed = true;
              } else if (value[i] && typeof value[i] === 'object' && !(value[i] instanceof Date) && !(value[i] instanceof mongoose.Types.ObjectId)) {
                if (traverse(value[i])) changed = true;
              }
            }
          } else if (value && typeof value === 'object' && !(value instanceof Date) && !(value instanceof mongoose.Types.ObjectId)) {
            if (traverse(value)) changed = true;
          }
        }
        return changed;
      }

      const changed = traverse(newDoc);

      // If the _id itself was a string, we MUST delete and insert
      if (typeof doc._id === 'string' && /^[0-9a-fA-F]{24}$/.test(doc._id)) {
        await collection.deleteOne({ _id: doc._id });
        await collection.insertOne(newDoc);
        updatedCount++;
      } else if (changed) {
        // Other fields changed, but _id was already ObjectId (or something else)
        await collection.replaceOne({ _id: doc._id }, newDoc);
        updatedCount++;
      }
    }
    console.log(`  Fixed ${updatedCount} documents in ${collection.collectionName}`);
  }

  console.log('Finished fixing all IDs.');
  process.exit(0);
}

fixIds().catch(err => {
  console.error(err);
  process.exit(1);
});
