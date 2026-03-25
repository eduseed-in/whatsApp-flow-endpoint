// index.js
import express from 'express';
import bodyParser from 'body-parser';
import { google } from 'googleapis';

const app = express();
app.use(bodyParser.json());

// --- Load service account from environment variable ---
if (!process.env.SERVICE_ACCOUNT_JSON) {
  console.error('ERROR: SERVICE_ACCOUNT_JSON is not defined!');
  process.exit(1);
}
if (!process.env.SPREADSHEET_ID) {
  console.error('ERROR: SPREADSHEET_ID is not defined!');
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_JSON);
  console.log('Service account loaded successfully');
} catch (err) {
  console.error('ERROR parsing SERVICE_ACCOUNT_JSON:', err);
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// --- Health check endpoint for Meta ---
app.get('/', (req, res) => {
  res.status(200).send({ status: 'endpoint working' });
});

// --- Webhook endpoint for WhatsApp ---
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;

    // Example: save timestamp + user message
    const timestamp = new Date().toISOString();
    const userMessage = JSON.stringify(body);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A:B', // Adjust your sheet and columns
      valueInputOption: 'RAW',
      requestBody: {
        values: [[timestamp, userMessage]]
      }
    });

    console.log('Enquiry saved at', timestamp);
    res.status(200).send({ status: 'success' });
  } catch (err) {
    console.error('Error saving to Google Sheets:', err);
    res.status(500).send({ status: 'error', message: err.message });
  }
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});