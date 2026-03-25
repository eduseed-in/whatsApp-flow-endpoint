require("dotenv").config();
const express = require("express");
const crypto = require("crypto");
const { GoogleSpreadsheet } = require("google-spreadsheet");

const app = express();
app.use(express.json());

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const PRIVATE_KEY = process.env.PRIVATE_KEY.replace(/\\n/g, "\n");
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = "Leads"; // change if your sheet tab is named differently

// ─── GOOGLE SHEETS ────────────────────────────────────────────────────────────
// Load service account credentials from the JSON file pointed to by GOOGLE_APPLICATION_CREDENTIALS
// The JSON file contains client_email and private_key from your Google Cloud service account
const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);

const appendToSheet = async (row) => {
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, {
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
  });
  await doc.loadInfo();
  const sheet = doc.sheetsByTitle[SHEET_NAME];
  await sheet.addRow(row);
};

// ─── MAIN ENDPOINT ────────────────────────────────────────────────────────────
app.post("/flow", async (req, res) => {
  // 1. Decrypt incoming request
  let decryptedBody, aesKeyBuffer, initialVectorBuffer;
  try {
    ({ decryptedBody, aesKeyBuffer, initialVectorBuffer } = decryptRequest(req.body, PRIVATE_KEY));
  } catch (err) {
    console.error("Decryption error:", err);
    return res.status(400).send("Decryption failed");
  }

  const { screen, data, action } = decryptedBody;
  console.log(`[Flow] action=${action} screen=${screen}`, data);

  // 2. Ping — Meta health check
  if (action === "ping") {
    return res.send(encryptResponse({ data: { status: "active" } }, aesKeyBuffer, initialVectorBuffer));
  }

  // 3. Complete — user finished the flow, save to Google Sheets
  if (action === "complete") {
    const bookedDemo = data.demo_interest === "yes";

    const row = {
      Timestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      "WhatsApp Number": data.whatsapp_number ?? "",
      "Child Age": data.child_age ?? "",
      Grade: data.grade ?? "",
      Interests: Array.isArray(data.interest) ? data.interest.join(", ") : (data.interest ?? ""),
      "Callback Time": data.callback_time ?? "",
      "Demo Booked": bookedDemo ? "Yes" : "No",
      "Demo Day": bookedDemo ? (data.demo_day ?? "") : "",
      "Demo Time": bookedDemo ? (data.demo_time ?? "") : "",
    };

    try {
      await appendToSheet(row);
      console.log("[Sheets] Row saved:", row);
    } catch (err) {
      console.error("[Sheets] Failed to save row:", err);
    }

    return res.send(encryptResponse({ data: { status: "success" } }, aesKeyBuffer, initialVectorBuffer));
  }

  // 4. Data exchange — handle screen routing
  if (action === "data_exchange") {

    // AGE screen: route to sorry screen if child is 4 or below
    if (screen === "AGE") {
      const nextScreen = data.child_age === "age1" ? "THANKYOU" : "GRADE";
      return res.send(encryptResponse({ screen: nextScreen, data: {} }, aesKeyBuffer, initialVectorBuffer));
    }

    // DEMO_OPTION screen: skip demo booking if user says no
    if (screen === "DEMO_OPTION") {
      const nextScreen = data.demo_interest === "yes" ? "DEMO_DAY" : "THANKYOU";
      return res.send(encryptResponse({ screen: nextScreen, data: {} }, aesKeyBuffer, initialVectorBuffer));
    }

    // All other screens — just acknowledge
    return res.send(encryptResponse({ data: {} }, aesKeyBuffer, initialVectorBuffer));
  }

  return res.status(400).send("Unknown action");
});

// ─── DECRYPT REQUEST ──────────────────────────────────────────────────────────
const decryptRequest = (body, privatePem) => {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body;

  const decryptedAesKey = crypto.privateDecrypt(
    {
      key: crypto.createPrivateKey(privatePem),
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(encrypted_aes_key, "base64")
  );

  const flowDataBuffer = Buffer.from(encrypted_flow_data, "base64");
  const initialVectorBuffer = Buffer.from(initial_vector, "base64");

  const TAG_LENGTH = 16;
  const encryptedBody = flowDataBuffer.subarray(0, -TAG_LENGTH);
  const authTag = flowDataBuffer.subarray(-TAG_LENGTH);

  const decipher = crypto.createDecipheriv("aes-128-gcm", decryptedAesKey, initialVectorBuffer);
  decipher.setAuthTag(authTag);

  const decryptedJSON = Buffer.concat([
    decipher.update(encryptedBody),
    decipher.final(),
  ]).toString("utf-8");

  return {
    decryptedBody: JSON.parse(decryptedJSON),
    aesKeyBuffer: decryptedAesKey,
    initialVectorBuffer,
  };
};

// ─── ENCRYPT RESPONSE ─────────────────────────────────────────────────────────
const encryptResponse = (response, aesKeyBuffer, initialVectorBuffer) => {
  const flippedIv = Buffer.from(initialVectorBuffer.map((b) => ~b));
  const cipher = crypto.createCipheriv("aes-128-gcm", aesKeyBuffer, flippedIv);
  return Buffer.concat([
    cipher.update(JSON.stringify(response), "utf-8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
};

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(3000, () => console.log("EduSeed Flow endpoint running on port 3000"));