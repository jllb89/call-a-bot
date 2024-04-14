require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const routes = require('./routes'); // Import the combined routes
const path = require('path');
const { fetchProductByName, fetchTransactionByRoomID } = require('./services/firestoreService');
const OpenTok = require('opentok');
const webhook = require('./webhook'); // Import the webhook router
const { sendVetPreparationMessage } = require('./controllers/vetsController');
const { chatState } = require('./controllers/whatsappController.js');
const app = express();
const port = process.env.PORT || 3000;
const opentok = new OpenTok(process.env.VONAGE_API_KEY, process.env.VONAGE_API_SECRET);

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/', routes); // Use the combined routes
app.use('/webhook', webhook); // Mount the webhook router under /webhook

// Status callback endpoint for Twilio message statuses
app.post('/message-status', (req, res) => {
  try {
    const messageSid = req.body.MessageSid;
    const messageStatus = req.body.MessageStatus;
    const phoneNumber = req.body.To.replace('whatsapp:', '');

    console.log(`Received message status update: ${messageStatus} for message ${messageSid}`);

    if (messageStatus === 'sent') {
        const chatStateForNumber = chatState[phoneNumber];
        if (chatStateForNumber && chatStateForNumber.vet && chatStateForNumber.vet.vetPhoneNumber) {
            console.log(`Triggering vet preparation message for ${chatStateForNumber.vet.vetPhoneNumber}`);
            sendVetPreparationMessage(chatStateForNumber.vet.vetPhoneNumber, chatStateForNumber.productDetails.productName, chatStateForNumber.vet.vetName);
        }
    }

    res.status(200).send('Status received');
  } catch (error) {
    console.error('Error handling message status:', error);
    res.status(500).send('Server error');
  }
});

app.get('/redirect', async (req, res) => {
  const roomID = req.query.room;
  console.log(`Attempting to redirect with room ID: ${roomID}`);

  const transaction = await fetchTransactionByRoomID(roomID);
  if (transaction) {
    console.log(`Transaction found: Redirecting based on role, Vet? ${req.query.vet}`);
    if (req.query.vet) {
      res.redirect(transaction.vetRedirectURL);
    } else {
      res.redirect(transaction.userRedirectURL);
    }
  } else {
    console.error(`Transaction not found for room ID: ${roomID}`);
    res.status(404).send('Transaction not found');
  }
});

// Test route for fetching product details
app.get('/test-product-fetch', async (req, res) => {
  const product = await fetchProductByName(productName);
  if (product) {
    res.json({ success: true, product });
  } else {
    res.json({ success: false, message: "Product not found." });
  }
});

// New route for the chat page
app.get('/chat', (req, res) => {
  const roomID = req.query.room;
  console.log(`Received room ID: ${roomID} for chat page`);
  if (roomID) {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
  } else {
    console.log("Room ID is required but not provided");
    res.status(400).send('Room ID is required');
  }
});

// Route to create a new video session
app.get('/create-session', (req, res) => {
  opentok.createSession({ mediaMode: 'routed' }, (error, session) => {
    if (error) {
      console.log('Error creating session:', error);
      res.status(500).send('Error creating session');
    } else {
      const token = session.generateToken();
      res.json({ sessionId: session.sessionId, token: token });
    }
  });
});

// Route to get session information with role differentiation
app.get('/get-session-info', async (req, res) => {
  const { role, room } = req.query;  // Ensure you are using the correct query parameter key
  console.log("Received query params:", req.query);
  console.log(`Parsed roomID from query: '${room}'`);

  if (!room) {
      console.error('Error: Room ID is undefined or empty.');
      res.status(400).send('Room ID is required.');
      return;
  }

  try {
      const transaction = await fetchTransactionByRoomID(room);
      if (!transaction) {
          console.error(`No transaction found with room ID: ${room}`);
          res.status(404).send('Session not found');
          return;
      }

      const tokenOptions = { role: role === 'vet' ? 'subscriber' : 'publisher' };
      const token = opentok.generateToken(transaction.sessionId, tokenOptions);

      res.json({
          apiKey: process.env.VONAGE_API_KEY,
          sessionId: transaction.sessionId,
          token: token
      });
  } catch (error) {
      console.error('Error retrieving session information:', error);
      res.status(500).send('Server error');
  }
});

app.post('/webhook', express.raw({ type: 'application/json' }), webhook);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});