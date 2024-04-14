const { askOpenAI } = require('../services/openAIService');
const { fetchProductById, fetchAvailableVetForProduct, fetchAllProductsWithMetaWords } = require('../services/firestoreService');
const { createPaymentLink } = require('../services/stripeService');
const twilio = require('twilio');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Twilio client initialization
const client = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Chat state to track user interactions
let chatState = {};

// Main function to handle incoming WhatsApp messages
async function handleWhatsAppMessage(req, res) {
    const incomingMsg = req.body.Body.toLowerCase();
    const phoneNumber = req.body.From.replace('whatsapp:', '');
    console.log(`Incoming message: ${incomingMsg}, from number: ${phoneNumber}`);

    let matchedProduct = null;
    const products = await fetchAllProductsWithMetaWords();
    matchedProduct = products.find(product => product.metaWords.some(word => incomingMsg.includes(word.toLowerCase())));

    if (matchedProduct && (!chatState[phoneNumber] || !chatState[phoneNumber].waitingForInfo)) {
        const productDetails = await fetchProductById(matchedProduct.id);
        const vet = await fetchAvailableVetForProduct({ id: matchedProduct.id });
        const paymentLink = await createPaymentLink(matchedProduct.id, phoneNumber);

        chatState[phoneNumber] = { waitingForInfo: true, productDetails, vet, vetPhoneNumber: vet.vetPhoneNumber, paymentLink };

        const query = `The customer is interested in ${productDetails.productName}. Ask the customer to provide more details about the problem by asking concise questions that may help creating a prediagnosis for the vet prior to the call. Finish the answer by explaining that Call a Vet is a service that offers remote veterinarian orientation. Avoid greetings and do not offer booking a consultation.`;
        const openAIResponse = await askOpenAI(query, phoneNumber);

        // Send message and setup status callback for delivery confirmation
        const messageOptions = {
            body: openAIResponse,
            from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER,
            to: 'whatsapp:' + phoneNumber,
            statusCallback: 'https://call-a-bot-7e963ac3bfd1.herokuapp.com/message-status'  // Endpoint to receive status updates
        };
        
        // Send the message via Twilio and handle delivery status
        client.messages.create(messageOptions)
            .then(message => {
                console.log(`Message SID ${message.sid} sent to ${phoneNumber}`);
                res.writeHead(200, { 'Content-Type': 'text/xml' });
                res.end('<Response></Response>'); // Empty TwiML response
            })
            .catch(error => {
                console.error('Failed to send message:', error);
                res.status(500).send('Failed to send message');
            });

        // Implement /message-status route to handle callbacks from Twilio for vet message preparation
    } else if (chatState[phoneNumber] && chatState[phoneNumber].waitingForInfo) {
        // Construct the final reply once the user has provided more details
        const finalReply = `Gracias por proporcionar más detalles sobre el problema. Call a Vet es un servicio que brinda asistencia remota a través de especialistas en diversas áreas veterinarias. Podemos sugerir una consulta con uno de nuestros veterinarios calificados, ${chatState[phoneNumber].vet.vetName}, quien se especializa en ${chatState[phoneNumber].productDetails.productName}. Para conectarse con el veterinario y comenzar la consulta, puede completar el pago a través de este enlace: ${chatState[phoneNumber].paymentLink.paymentLinkUrl}. Habiendo completado el pago, se le redireccionará automáticamente a la llamada. Gracias por confiar en Call a Vet.`;
        chatState[phoneNumber].waitingForInfo = false;

        // Optionally deactivate the payment link
        setTimeout(async () => {
            try {
                await stripe.paymentLinks.update(chatState[phoneNumber].paymentLink.paymentLinkUrl.split('/').pop(), { active: false });
                console.log('Payment link deactivated successfully');
            } catch (error) {
                console.error('Failed to deactivate payment link:', error);
            }
        }, 900000); // 15 minutes to deactivate the link

        // Send the final reply to the user
        const twiml = new twilio.twiml.MessagingResponse();
        twiml.message(finalReply);
        res.writeHead(200, { 'Content-Type': 'text/xml' });
        res.end(twiml.toString());
    } else {
        // Handle general inquiries that don't match any products
        const generalReply = await askOpenAI(incomingMsg, phoneNumber);
        const twiml = new twilio.twiml.MessagingResponse();
        twiml.message(generalReply);
        res.writeHead(200, { 'Content-Type': 'text/xml' });
        res.end(twiml.toString());
    }
}

// Export the handleWhatsAppMessage function for use in other modules
module.exports = { handleWhatsAppMessage };
module.exports.chatState = chatState;