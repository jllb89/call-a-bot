const db = require('../config/firebaseConfig');

async function fetchConversationHistory(phoneNumber) {
  const docRef = db.collection('chats').doc(phoneNumber);
  const doc = await docRef.get();
  if (doc.exists) {
    return doc.data().messages;
  } else {
    return [];
  }
}

async function saveConversationHistory(phoneNumber, messages) {
  const docRef = db.collection('chats').doc(phoneNumber);
  await docRef.set({ messages });
}

async function fetchProductById(productId) {
  console.log(`Fetching product by ID: ${productId}`);
  const productRef = db.collection('products').doc(productId);
  const doc = await productRef.get();
  if (doc.exists) {
    console.log(`Product found: ${JSON.stringify(doc.data())}`);
    return doc.data();
  } else {
    return null;
  }
}

async function fetchAvailableVetForProduct(productRef) {
  const vetsSnapshot = await db.collection('vets').where('isAvailable', '==', true).get();
  let availableVet = null;
  const productId = productRef.id;
  console.log('Looking for vets with product ID:', productId);
  for (const doc of vetsSnapshot.docs) {
    const vet = doc.data();
    console.log(`Checking vet: ${vet.vetName}, with products: ${vet.vetProducts}`);
    if (vet.vetProducts && vet.vetProducts.some(ref => ref.id === productId) && vet.isAvailable) {
      console.log(`Match found with vet: ${vet.vetName}, phone number: ${doc.id}`);
      availableVet = {
        vetName: vet.vetName,
        vetResume: vet.vetResume,
        vetPhoneNumber: doc.id
      };
      break;
    }
  }
  if (!availableVet) {
/*     console.log('No available vet found for product ID:', productId);
 */  }
  return availableVet;
}

async function fetchAllProductsWithMetaWords() {
  const productsRef = db.collection('products');
  const snapshot = await productsRef.get();
  const products = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.metaWords) {
      products.push({ id: doc.id, metaWords: data.metaWords });
    }
  });
  return products;
}

// Function to create a transaction record in Firestore
async function createTransaction(sessionId, productId, customerPhoneNumber, userToken, vetToken, roomID, userRedirectURL, vetRedirectURL) {
  const transactionRef = db.collection('transactions').doc(sessionId);
  console.log(`Creating transaction with sessionId: ${sessionId}`);
  try {
    await transactionRef.set({
      sessionId: sessionId,
      productId: productId,
      paid: false,
      paymentDate: null,
      creationDate: new Date(),
      customerRef: customerPhoneNumber,
      userToken: userToken,
      vetToken: vetToken,
      roomID: roomID,
      userRedirectURL: userRedirectURL,
      vetRedirectURL: vetRedirectURL
    });
    console.log('Transaction created successfully');
  } catch (err) {
    console.error('Failed to create transaction:', err);
  }
}

// Function to update the paid status of a transaction in Firestore and add user email
async function updateTransactionPaidStatus(sessionId, paidStatus, paymentIntentId, userEmail, userName) {
  const transactionRef = db.collection('transactions').doc(sessionId);
  console.log(`Updating transaction with sessionId: ${sessionId}`);

  const transactionDoc = await transactionRef.get();
  if (transactionDoc.exists) {
    await transactionRef.update({
      paid: paidStatus,
      paymentDate: paidStatus ? new Date() : null,
      paymentIntentId: paymentIntentId,
      userEmail: userEmail,
      userName: userName
    });
    console.log('Transaction status updated successfully');
  } else {
    console.error(`Transaction document with ID ${sessionId} does not exist.`);
  }
}

// Function to fetch a transaction record from Firestore
async function fetchTransaction(sessionId) {
  const transactionRef = db.collection('transactions').doc(sessionId);
  console.log(`Fetching transaction with sessionId: ${sessionId}`);
  try {
      const doc = await transactionRef.get();
      if (doc.exists) {
          console.log('Transaction fetched successfully');
          return doc.data();
      } else {
          console.log('No transaction found with the given sessionId');
          return null;
      }
  } catch (err) {
      console.error('Failed to fetch transaction:', err);
      return null;
  }
}

async function fetchTransactionByRoomID(roomID) {
  console.log("Attempting to fetch transaction with roomID:", roomID); 
  if (roomID == null) {
    console.error('Invalid room ID:', roomID);
    return null;
  }
  const transactionsRef = db.collection('transactions');
  try {
    const snapshot = await transactionsRef.where('roomID', '==', roomID).get();
    if (!snapshot.empty) {
      return snapshot.docs[0].data();
    } else {
      console.log('No transaction found with the given roomID:', roomID);
      return null;
    }
  } catch (err) {
    console.error('Failed to fetch transaction:', err);
    return null;
  }
}


async function createCustomer(phoneNumber, userName, userEmail) {
  const customerRef = db.collection('customers').doc(phoneNumber);
  await customerRef.set({
    userName: userName,
    userEmail: userEmail
  });
}

module.exports = {
  fetchConversationHistory,
  saveConversationHistory,
  fetchProductById,
  fetchAvailableVetForProduct,
  fetchAllProductsWithMetaWords,
  createTransaction,
  updateTransactionPaidStatus,
  fetchTransaction,
  createCustomer,
  fetchTransactionByRoomID
};