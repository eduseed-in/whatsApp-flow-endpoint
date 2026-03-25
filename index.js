import express from "express";
import bodyParser from "body-parser";
import crypto from "crypto";

const app = express();
app.use(bodyParser.json());

// Get your private key from env variable
// If stored as a single line, add proper PEM headers
const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY env variable is missing!");

// Convert single-line key to proper PEM format if needed
const privateKeyPEM = PRIVATE_KEY.includes("-----BEGIN")
  ? PRIVATE_KEY
  : `-----BEGIN PRIVATE KEY-----\n${PRIVATE_KEY.match(/.{1,64}/g).join("\n")}\n-----END PRIVATE KEY-----`;

app.post("/webhook", async (req, res) => {
  try {
    const { encrypted_flow_data, encrypted_aes_key, initial_vector } = req.body;

    if (!encrypted_flow_data || !encrypted_aes_key || !initial_vector) {
      return res.status(400).json({ error: "Missing encrypted data" });
    }

    // 1️⃣ Decrypt the AES key using your private RSA key
    const aesKey = crypto.privateDecrypt(
      {
        key: privateKeyPEM,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(encrypted_aes_key, "base64")
    );

    // 2️⃣ Decrypt the flow data using AES-256-CBC
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      aesKey,
      Buffer.from(initial_vector, "base64")
    );

    let decrypted = decipher.update(encrypted_flow_data, "base64", "utf8");
    decrypted += decipher.final("utf8");

    // 3️⃣ Meta expects Base64 encoded response
    const responseBase64 = Buffer.from(decrypted, "utf8").toString("base64");

    res.json({ encrypted_response: responseBase64 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));