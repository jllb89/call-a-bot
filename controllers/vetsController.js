require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const twilio = require('twilio');
const axios = require('axios');
const twilioClient = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const { fetchTransaction } = require('../services/firestoreService');

// Function to generate a preparation message for the vet using OpenAI
async function generateMessageForVet(productName, vetName) {
    // Define the request body for the OpenAI API
    const requestBody = {
        model: 'gpt-4',
        messages: [
            { role: "system", content: `You are a virtual assistant for a veterinary service. Generate a message for a vet ${vetName} about an upcoming consultation. Send the message in spanish and sign it in the end like this: Atentamente, Su Asistente Call a Vet.` },
            { role: "user", content: `Un cliente está interesado en ${productName}. Por favor, prepárese para una posible consulta dentro de los próximos 15 minutos.` }
        ],
        temperature: 0.5,
        max_tokens: 150,
        top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
    };

    // Set the request headers
    const requestHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    };

    // Send the request to OpenAI and return the generated message
    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', requestBody, { headers: requestHeaders });
        const lastMessage = response.data.choices[0].message.content.trim();
        return lastMessage;
    } catch (error) {
        console.error('Error calling OpenAI:', error.response ? error.response.data : error.message);
        return "Sorry, I'm having trouble generating a message for the vet.";
    }
}

// Function to send the preparation message to the vet
async function sendVetPreparationMessage(vetPhoneNumber, productName, vetName) {
    console.log(`vetPhoneNumber in sendVetPreparationMessage: ${vetPhoneNumber}`);

    try {
        console.log(`Generating message for vet about product: ${productName}`);
        const message = await generateMessageForVet(productName, vetName);
        console.log(`Vet message: ${message}`);
        console.log(`Sending message to vet at ${vetPhoneNumber}`);
        const response = await twilioClient.messages.create({
            body: message,
            from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER,
            to: 'whatsapp:' + vetPhoneNumber
        });
        console.log(`Preparation message sent to vet (${vetPhoneNumber}): ${response.sid}`);
    } catch (error) {
        console.error(`Failed to send preparation message to vet (${vetPhoneNumber}):`, error);
    }
}

// Function to send the payment link to the vet
async function sendVetPaymentLink(vetPhoneNumber, sessionId) {
    console.log(`vetPhoneNumber in sendVetPaymentLink: ${vetPhoneNumber}`);

    try {
        const transaction = await fetchTransaction(sessionId);
        const roomID = transaction.roomID; // Get the roomID from the transaction
        console.log(`Room ID in sendVetPaymentLink: ${roomID}`); // Log the roomID

        // Append the vet query parameter to the URL
        const vetURL = `https://call-a-bot.onrender.com/redirect?room=${roomID}&vet=true`;

        const message = `Hola Dr.,\n\nEl cliente ha completado el pago. Puede iniciar la consulta por videollamada a través de este enlace: ${vetURL}\n\nAtentamente,\nSu Asistente Call a Vet`;
        console.log(`Vet payment link message: ${message}`);
        console.log(`Sending payment link message to vet at ${vetPhoneNumber}`);
        const response = await twilioClient.messages.create({
            body: message,
            from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER,
            to: 'whatsapp:' + vetPhoneNumber
        });
        console.log(`Payment link message sent to vet (${vetPhoneNumber}): ${response.sid}`);
    } catch (error) {
        console.error(`Failed to send payment link message to vet (${vetPhoneNumber}):`, error);
    }
}

// Export the functions for use in other modules
module.exports = {
    sendVetPreparationMessage,
    sendVetPaymentLink
};