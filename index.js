// index.js
const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const app = express();

app.use(bodyParser.json());

// Google Sheets Setup
const SPREADSHEET_ID = '17wS6k3ffrxBb1fABUx_q7eULKha8kXbzEpg374cqUcA';
const SHEET_NAME = 'Sheet1';

// Load Service Account credentials
const serviceAccount = require('./service-account.json');

const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'endpoint working' });
});

// WhatsApp Flow POST endpoint
app.post('/', async (req, res) => {
  try {
    const body = req.body;

    const parentName = body.contacts?.[0]?.profile?.name || '';
    const phone = body.contacts?.[0]?.wa_id || '';
    const childAge = body.flow_data?.child_age || '';
    const grade = body.flow_data?.grade || '';
    const interests = Array.isArray(body.flow_data?.interest)
      ? body.flow_data.interest.join(', ')
      : body.flow_data?.interest || '';
    const callbackTime = body.flow_data?.callback_time || '';
    const bookDemo = body.flow_data?.book_demo || '';
    const demoDay = body.flow_data?.demo_day || '';
    const demoTime = body.flow_data?.demo_time || '';

    const timestamp = new Date().toISOString();

    // Append data to Google Sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: 'RAW',
      resource: {
        values: [
          [timestamp, parentName, phone, childAge, grade, interests, callbackTime, bookDemo, demoDay, demoTime],
        ],
      },
    });

    res.json({ status: 'received' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));