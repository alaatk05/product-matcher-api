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

  const prompt = `You are a product identification expert. Search the web thoroughly for this product and extract every possible identifier and name variation.

Product to search:
- Name: ${name || ""}
- Brand: ${brand || ""}
- Model/SKU: ${sku || ""}
- EAN/Barcode: ${barcode || ""}

Search for this product on manufacturer websites, retailer sites (Amazon, B&H, Noon, Sharaf DG, etc.), and barcode databases. Look for:
1. The exact official product name as listed by the manufacturer
2. All EAN, UPC, GTIN barcodes for this product (different regions may have different barcodes)
3. All model numbers, part numbers, SKUs used by the manufacturer and retailers
4. Any bundle or kit variations (e.g. same product sold with accessories)
5. Regional name variations (e.g. US vs EU vs Middle East naming)
6. Color/variant specific names and codes
7. Any previous or alternate product names

Return ONLY this JSON object, no markdown, no explanation:
{
  "official_name": "exact official product name from manufacturer",
  "ean": "primary EAN/UPC barcode",
  "model_number": "primary official model number",
  "alternate_names": ["every other name this product is known by, including regional variants"],
  "alternate_model_numbers": ["all other model numbers, part numbers, SKUs"],
  "alternate_eans": ["all other EAN/UPC/GTIN codes for this product"],
  "brand": "confirmed brand name",
  "category": "product category",
  "key_specs": "brief key specifications that distinguish this exact variant (color, storage, region, year)"
}`;

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
