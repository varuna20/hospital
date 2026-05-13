const express = require('express');
const router  = express.Router();
const twilio  = require('twilio');
const { processMessage } = require('../utils/chatbot');

/**
 * WEBHOOK: /api/whatsapp/webhook
 * Handled incoming messages from Twilio
 */
// GET: /api/whatsapp/webhook (For testing in browser)
router.get('/webhook', (req, res) => {
  res.send('WhatsApp Webhook is ALIVE! Please use POST for actual messages.');
});

router.post('/webhook', async (req, res) => {
  const { Body, From, To } = req.body;

  console.log(`[WhatsApp-Bot] 📩 Received from ${From} to ${To}: "${Body}"`);

  try {
    // Process the message and get response text
    const responseText = await processMessage(From, To, Body);

    // Create Twilio Response
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(responseText);

    const xml = twiml.toString();
    console.log(`[WhatsApp-Bot] 📤 Replying with: ${xml.slice(0, 50)}...`);

    res.type('text/xml').send(xml);
  } catch (err) {
    console.error('❌ Chatbot Error:', err.message);
    // Silent fail for webhook, or return generic message
    res.status(200).send('Error');
  }
});

module.exports = router;
