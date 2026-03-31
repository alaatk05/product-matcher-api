const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.options("*", cors());
app.use(express.json());

const API_KEY = process.env.ANTHROPIC_API_KEY;

app.get("/", (req, res) => {
  res.json({ status: "Product Matcher API is running" });
});

app.post("/enrich", async (req, res) => {
  const { name, brand, sku, barcode } = req.body;

  if (!name && !sku && !barcode) {
    return res.status(400).json({ error: "No product data provided" });
  }

  const prompt = `Search the web for this product and return ONLY a JSON object, no markdown, no explanation.
Product: Name: ${name || ""} | Brand: ${brand || ""} | SKU: ${sku || ""} | EAN: ${barcode || ""}
Return exactly this JSON structure:
{"official_name":"","ean":"","model_number":"","alternate_names":[],"alternate_model_numbers":[],"alternate_eans":[]}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 600,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    const text = (data.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("");

    const clean = text.replace(/```json|```/gi, "").trim();
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");

    if (start === -1) return res.json(null);

    const parsed = JSON.parse(clean.slice(start, end + 1));
    res.json(parsed);
  } catch (err) {
    console.error("Enrich error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
