// index.js
const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON requests
app.use(bodyParser.json());

// Google Sheets setup
const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_JSON);
const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// Helper function to append a row
async function appendRow(data) {
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A1',
      valueInputOption: 'RAW',
      resource: { values: [data] }
    });
  } catch (error) {
    console.error('Error appending row:', error);
    throw error;
  }
}

// WhatsApp webhook endpoint
app.post('/webhook', async (req, res) => {
  try {
    // Example payload from WhatsApp flow
    const { child_name, child_age, grade, interest, callback_time } = req.body;

    // Save data to Google Sheets
    const timestamp = new Date().toISOString();
    const row = [
      timestamp,
      child_name || '',
      child_age || '',
      grade || '',
      Array.isArray(interest) ? interest.join(', ') : interest || '',
      callback_time || ''
    ];

    await appendRow(row);

    // Respond to WhatsApp
    res.json({ status: 'success', message: 'Enquiry saved' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to save enquiry' });
  }
});

// Health check endpoint for Meta
app.get('/webhook', (req, res) => {
  // Meta sends a GET request to verify webhook
  res.json({ status: 'endpoint working' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});