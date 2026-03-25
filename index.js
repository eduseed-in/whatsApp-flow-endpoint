require("dotenv").config();
const express = require("express");
const crypto = require("crypto");
const { GoogleSpreadsheet } = require("google-spreadsheet");

const app = express();
app.use(express.json({ limit: "1mb" }));

// --- Initialize Google Sheet ---
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);

// --- Load service account credentials from env ---
const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_JSON);

async function accessSheet() {
  await doc.useServiceAccountAuth(serviceAccount);
  await doc.loadInfo();
  return doc.sheetsByIndex[0]; // first sheet
}

// Health check (Meta uses this)
app.get('/', (req, res) => {
  res.json({ status: 'endpoint working' });
});

// --- POST endpoint for WhatsApp webhook ---
app.post("/", async (req, res) => {
  try {
    const { encrypted_flow_data, encrypted_aes_key, initial_vector } = req.body;

    if (!encrypted_flow_data || !encrypted_aes_key || !initial_vector) {
      return res.status(400).send("Missing encrypted data");
    }

    // --- Step 1: decrypt AES key using Meta private key ---
    const privateKey = process.env.META_PRIVATE_KEY.replace(/\\n/g, "\n");
    const aesKey = crypto.privateDecrypt(
      { key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
      Buffer.from(encrypted_aes_key, "base64")
    );

    // --- Step 2: decrypt the flow data ---
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      aesKey,
      Buffer.from(initial_vector, "base64")
    );
    let decrypted = decipher.update(encrypted_flow_data, "base64", "utf8");
    decrypted += decipher.final("utf8");

    const flowData = JSON.parse(decrypted);
    console.log("Decrypted flow data:", flowData);

    // --- Step 3: save to Google Sheet ---
    const sheet = await accessSheet();

    // Flatten flowData into a row
    const row = { timestamp: new Date().toISOString() };
    Object.keys(flowData).forEach((key) => {
      row[key] = JSON.stringify(flowData[key]);
    });

    await sheet.addRow(row);

    // --- Step 4: respond with Base64 encoded message ---
    const response = { status: "ok" };
    const base64Response = Buffer.from(JSON.stringify(response)).toString("base64");
    res.send(base64Response);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal server error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));