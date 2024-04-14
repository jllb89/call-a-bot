const axios = require('axios');
require('dotenv').config();
const { fetchConversationHistory, saveConversationHistory } = require('./firestoreService');

async function askOpenAI(question, phoneNumber = null) {
  console.log(`phoneNumber in askOpenAI: ${phoneNumber}`);
    const messages = await fetchConversationHistory(phoneNumber);
/*     console.log(`fetchConversationHistory called with phoneNumber: ${phoneNumber}`);
 */    messages.push({ role: "user", content: question });

    // Limit the number of messages to the most recent 10, for example
    const recentMessages = messages.slice(-10);

    const requestBody = {
        model: 'gpt-4',
        messages: [
            { role: "system", 
            content: "You are the virtual assistant for Call a Vet, a veterinary services startup. Your role is to understand pet health concerns, match symptoms with potential conditions, and recommend appropriate products from our offerings. Encourage detailed descriptions from customers to better match our services to their needs. Focus on guiding customers towards our products that can assist with their concerns, based on the information they provide. Always use the term 'animal de compañía' instead of 'mascota'."},
            ...recentMessages
        ],
        temperature: 0.5,
        max_tokens: 600,
        top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
    };
  const requestHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
  };

/*   console.log('Sending request to OpenAI with body:', JSON.stringify(requestBody, null, 2));
 */  /* console.log('Using headers:', JSON.stringify(requestHeaders, null, 2)); */

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      requestBody,
      { headers: requestHeaders }
    );

    console.log('Received response from OpenAI:', JSON.stringify(response.data, null, 2));
    const lastMessage = response.data.choices[0].message.content.trim();

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

module.exports = { askOpenAI };
