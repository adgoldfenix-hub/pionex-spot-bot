require("dotenv").config(); // pour dev local seulement

const express = require("express");
const crypto = require("crypto");
const axios = require("axios");

const app = express();
app.use(express.json());

const API_KEY = process.env.PIONEX_API_KEY;
const API_SECRET = process.env.PIONEX_API_SECRET;
const BASE_URL = "https://api.pionex.com";

// Log léger si clés absentes (ne bloque pas le démarrage sur Render)
if (!API_KEY || !API_SECRET) {
  console.warn("Attention : PIONEX_API_KEY et/ou PIONEX_API_SECRET non définies");
}

console.log("Clés chargées (ou pas) OK");

function sign(message) {
  return crypto.createHmac("sha256", API_SECRET).update(message).digest("hex");
}

app.post("/webhook", async (req, res) => {
  console.log("Signal reçu :", JSON.stringify(req.body, null, 2));

  const { symbol, side, type, quantity, price } = req.body;

  if (!symbol || !side || !quantity) {
    return res.status(400).json({ error: "Manque symbol, side, type ou quantity" });
  }

  const timestamp = Date.now().toString();
  const queryString = `timestamp=${timestamp}`;

  const body = {
    symbol: symbol.toUpperCase(),
    side: side.toUpperCase(),
    type: type.toUpperCase(),
    timestamp: timestamp,
    size: quantity.toString()  // quantité en base asset (ZEC, etc.)
  };

  if (price) body.price = price.toString();

  const bodyStr = JSON.stringify(body);
  const path = "/api/v1/trade/order";
  const messageToSign = `POST${path}?${queryString}${bodyStr}`;
  const signature = sign(messageToSign);

  console.log("Body envoyé :", body);
  console.log("Signature :", signature);

  const headers = {
    "PIONEX-KEY": API_KEY,
    "PIONEX-SIGNATURE": signature,
    "Content-Type": "application/json",
  };

  const url = `${BASE_URL}${path}?${queryString}`;

  console.log("URL envoyée :", url);

  try {
    const response = await axios.post(url, body, { headers, timeout: 30000 });
    console.log("Succès :", JSON.stringify(response.data, null, 2));
    res.json({ status: "ok", data: response.data });
  } catch (err) {
    console.error("Erreur :", err.response?.data || err.message);
    if (err.response?.data) console.error("Détails :", JSON.stringify(err.response.data, null, 2));
    res.status(500).json({ error: err.message });
  }
});

app.get("/health", (req, res) => res.send("OK"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur spot Pionex sur port ${PORT}`);
});