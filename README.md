# WhatsApp Flow Endpoint

This is a Node.js endpoint for Meta WhatsApp Flow that saves form submissions to Google Sheets.

## Setup

1. Create a Google Service Account and download the JSON key.
2. Share your Google Sheet with the service account email (Editor access).
3. Rename your JSON key to `service-account.json` and place it in the repo.
4. Replace `YOUR_SPREADSHEET_ID` in `index.js` with your sheet ID.

## Run Locally

```bash
npm install
node index.js