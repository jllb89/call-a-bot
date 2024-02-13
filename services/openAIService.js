const axios = require('axios');
require('dotenv').config();
const { fetchConversationHistory, saveConversationHistory } = require('./firestoreService');

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

module.exports = { askOpenAI };
