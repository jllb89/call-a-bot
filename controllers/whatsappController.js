const { askOpenAI } = require('../services/openAIService');
const twilio = require('twilio');

async function handleWhatsAppMessage(req, res) {
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
}

module.exports = { handleWhatsAppMessage };