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

module.exports = { fetchConversationHistory, saveConversationHistory };