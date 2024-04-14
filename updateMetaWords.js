const db = require('./config/firebaseConfig');
const metaWords = require('./data/meta.json');

async function updateMetaWords() {
  try {
    for (const product of metaWords.products) {
      await db.collection('products').doc(product.productId).update({
        metaWords: product.metaWords,
      });
      console.log(`Updated meta words for product: ${product.productId}`);
    }
    console.log('All meta words updated successfully');
  } catch (error) {
    console.error('Error updating meta words:', error);
  }
}

updateMetaWords();