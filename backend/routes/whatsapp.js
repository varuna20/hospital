const express = require('express');
const router  = express.Router();
const twilio  = require('twilio');
const { processMessage } = require('../utils/chatbot');

/**
 * WEBHOOK: /api/whatsapp/webhook
 * Handled incoming messages from Twilio
 */
router.post('/webhook', async (req, res) => {
  const { Body, From, To } = req.body;

  console.log(`[WhatsApp-Bot] Message from ${From}: ${Body}`);

  try {
    // Process the message and get response text
    const responseText = await processMessage(From, To, Body);

    // Create Twilio Response
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(responseText);

    res.type('text/xml').send(twiml.toString());
  } catch (err) {
    console.error('❌ Chatbot Error:', err.message);
    // Silent fail for webhook, or return generic message
    res.status(200).send('Error');
  }
});

module.exports = router;
