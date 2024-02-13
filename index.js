require('dotenv').config();
const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 3000;

// Initialize Firebase Admin SDK
const serviceAccount = require('./config/adminsdk.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json()); // To parse JSON bodies

app.get('/', (req, res) => {
  console.log('Received GET request to /');
  res.send('Welcome to the Call a Vet bot!');
});

// Fetch conversation history from Firestore
async function fetchConversationHistory(phoneNumber) {
  const docRef = db.collection('chats').doc(phoneNumber);
  const doc = await docRef.get();
  if (doc.exists) {
    return doc.data().messages;
  } else {
    return [];
  }
}

// Save conversation history to Firestore
async function saveConversationHistory(phoneNumber, messages) {
  const docRef = db.collection('chats').doc(phoneNumber);
  await docRef.set({ messages });
}

// Modified askOpenAI function to use Firestore for conversation history
async function askOpenAI(question, phoneNumber) {
  const messages = await fetchConversationHistory(phoneNumber);
  messages.push({ role: "user", content: question });

  const requestBody = {
    model: 'gpt-4',
    messages: [
      { role: "system", content: "You are the virtual assistant for Call a Vet, a veterinary services startup. You're knowledgeable about common pet health issues, scheduling appointments, providing general advice, and when to suggest a vet visit. Always be helpful but concise, try to be brief and execute solutions fast, and prompt in assisting with inquiries." },
      ...messages
    ],
    temperature: 0.5,
    max_tokens: 200,
    top_p: 1.0,
    frequency_penalty: 0.0,
    presence_penalty: 0.0,
  };
  const requestHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
  };

  console.log('Sending request to OpenAI with body:', JSON.stringify(requestBody, null, 2));
  console.log('Using headers:', JSON.stringify(requestHeaders, null, 2));

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      requestBody,
      { headers: requestHeaders }
    );

    console.log('Received response from OpenAI:', JSON.stringify(response.data, null, 2));
    const lastMessage = response.data.choices[0].message.content.trim();
    
    // Save the response back to the conversation history
    await saveConversationHistory(phoneNumber, [...messages, { role: "assistant", content: lastMessage }]);

    return lastMessage;
  } catch (error) {
    console.error('Error calling OpenAI:', error.response ? error.response.data : error.message);
    if (error.response) {
      console.error('Failed request data:', JSON.stringify({
        headers: error.response.config.headers,
        data: error.response.config.data,
      }, null, 2));
    }
    return "Sorry, I'm having trouble understanding that.";
  }
}

// Webhook endpoint for Twilio WhatsApp messages
app.post('/whatsapp', async (req, res) => {
  const incomingMsg = req.body.Body;
  const phoneNumber = req.body.From.replace('whatsapp:', ''); // Adjust based on actual format
  console.log(`Incoming message from WhatsApp: ${incomingMsg}, from number: ${phoneNumber}`);

  // Process the incoming message with OpenAI, including the phone number for conversation history
  const replyText = await askOpenAI(incomingMsg, phoneNumber);
  console.log(`Reply from OpenAI: ${replyText}`);

  // Create a TwiML response with the AI's answer
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(replyText);

  // Log the response being sent back to Twilio
  console.log(`Response to Twilio: ${twiml.toString()}`);

  // Set the content type to XML to ensure Twilio can interpret the response
  res.writeHead(200, {'Content-Type': 'text/xml'});
  res.end(twiml.toString());
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});