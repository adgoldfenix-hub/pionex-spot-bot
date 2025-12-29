require("dotenv").config();

const express = require("express");
const crypto = require("crypto");
const axios = require("axios");

const app = express();
app.use(express.json());

const API_KEY = process.env.PIONEX_API_KEY;
const API_SECRET = process.env.PIONEX_API_SECRET;
const BASE_URL = "https://api.pionex.com";

if (!API_KEY || !API_SECRET) {
  console.warn("Attention : PIONEX_API_KEY et/ou PIONEX_API_SECRET manquantes");
}

console.log("Démarrage serveur - Clés présentes :", !!API_KEY && !!API_SECRET);

function sign(message) {
  if (!API_SECRET) {
    throw new Error("API_SECRET manquante - Impossible de signer");
  }
  return crypto.createHmac("sha256", API_SECRET).update(message).digest("hex");
}

app.post("/webhook", async (req, res) => {
  console.log("Signal reçu :", JSON.stringify(req.body, null, 2));

  let { symbol, side, type, quantity, price } = req.body;

  if (!symbol || !side || !quantity) {
    return res.status(400).json({ error: "Manque symbol, side, type ou quantity" });
  }

  // ARRONDISSAGE à 2 décimales (ex: 0.02345 → "0.02")
  quantity = parseFloat(quantity).toFixed(2);

  // Conversion en string pour l'envoi (Pionex préfère souvent string pour éviter float issues)
  const quantityStr = quantity.toString();

  const timestamp = Date.now().toString();
  const queryString = `timestamp=${timestamp}`;

  const body = {
    symbol: symbol.toUpperCase(),
    side: side.toUpperCase(),
    type: type.toUpperCase(),
    timestamp: timestamp,
    size: quantityStr   // quantité arrondie à 2 décimales
  };

  if (price) body.price = price.toString();

  const bodyStr = JSON.stringify(body);
  const path = "/api/v1/trade/order";
  const messageToSign = `POST${path}?${queryString}${bodyStr}`;
  let signature;
  try {
    signature = sign(messageToSign);
  } catch (err) {
    console.error("Erreur signature :", err.message);
    return res.status(500).json({ error: "Erreur signature - Vérifiez les clés" });
  }

  console.log("Body envoyé (avec quantité arrondie) :", body);
  console.log("Signature :", signature);

  const headers = {
    "PIONEX-KEY": API_KEY,
    "PIONEX-SIGNATURE": signature,
    "Content-Type": "application/json",
  };

  const url = `${BASE_URL}${path}?${queryString}`;

  try {
    const response = await axios.post(url, body, { headers, timeout: 30000 });
    console.log("Succès :", JSON.stringify(response.data, null, 2));
    res.json({ status: "ok", data: response.data });
  } catch (err) {
    console.error("Erreur API :", err.response?.data || err.message);
    if (err.response?.data) console.error("Détails :", JSON.stringify(err.response.data, null, 2));
    res.status(500).json({ error: err.message });
  }
});

app.get("/health", (req, res) => res.send("OK"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur spot Pionex sur port ${PORT}`);
});