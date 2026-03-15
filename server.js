const express = require("express");
const cors    = require("cors");
const fetch   = require("node-fetch");

const app  = express();
const PORT = process.env.PORT || 3000;
const GHL_API_KEY = process.env.GHL_API_KEY || "";

app.use(cors());
app.use(express.json());

const HDRS = {
  "Authorization": `Bearer ${GHL_API_KEY}`,
  "Version":       "2021-07-28",
  "Content-Type":  "application/json",
};

// ── Health check
app.get("/", (req, res) => {
  res.json({ status: "DFL Proxy running ✅", time: new Date().toISOString() });
});

// ── GET location
app.get("/api/location/:locationId", async (req, res) => {
  try {
    const r = await fetch(
      `https://services.leadconnectorhq.com/locations/${req.params.locationId}`,
      { headers: HDRS }
    );
    res.status(r.status).json(await r.json());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DISCOVERY endpoint — tries every possible GHL custom objects format
// and returns whichever one works with actual records
app.get("/api/discover/:locationId", async (req, res) => {
  const lid = req.params.locationId;
  const results = [];

  // Format 1 — list all custom object schemas
  try {
    const r = await fetch(
      `https://services.leadconnectorhq.com/objects/?locationId=${lid}`,
      { headers: HDRS }
    );
    const d = await r.json();
    results.push({ endpoint: "objects/?locationId", status: r.status, data: d });
  } catch (e) {
    results.push({ endpoint: "objects/?locationId", error: e.message });
  }

  // Format 2 — custom-objects list
  try {
    const r = await fetch(
      `https://services.leadconnectorhq.com/custom-objects/?locationId=${lid}`,
      { headers: HDRS }
    );
    const d = await r.json();
    results.push({ endpoint: "custom-objects/?locationId", status: r.status, data: d });
  } catch (e) {
    results.push({ endpoint: "custom-objects/?locationId", error: e.message });
  }

  // Format 3 — contacts/custom-fields
  try {
    const r = await fetch(
      `https://services.leadconnectorhq.com/contacts/custom-fields?locationId=${lid}`,
      { headers: HDRS }
    );
    const d = await r.json();
    results.push({ endpoint: "contacts/custom-fields", status: r.status, keys: Object.keys(d) });
  } catch (e) {
    results.push({ endpoint: "contacts/custom-fields", error: e.message });
  }

  res.json({ results });
});

// ── GET records — tries multiple key formats automatically
app.get("/api/records/:locationId", async (req, res) => {
  const lid = req.params.locationId;
  const keyHint = req.query.key || "";

  // Build list of keys to try
  const keysToTry = [];
  if (keyHint) keysToTry.push(keyHint);

  // Common GHL custom object key formats
  keysToTry.push(
    "monthly_business_scorecard",
    "monthly_business_scorecards",
    "custom_objects.monthly_business_scorecard",
    "custom_objects.monthly_business_scorecards",
    "business_scorecard",
    "scorecard",
    "monthly_scorecard"
  );

  const attempts = [];

  for (const key of keysToTry) {
    // Try format 1: /objects/{key}/records
    try {
      const url1 = `https://services.leadconnectorhq.com/objects/${key}/records?locationId=${lid}&limit=50`;
      const r1 = await fetch(url1, { headers: HDRS });
      const d1 = await r1.json();
      attempts.push({ key, format: "objects/{key}/records", status: r1.status, data: d1 });

      // If we got records, return immediately
      const recs = d1.records || d1.data || d1.objects || [];
      if (r1.ok && Array.isArray(recs) && recs.length > 0) {
        return res.json({
          success: true,
          key,
          format: "objects/{key}/records",
          records: recs,
          attempts,
        });
      }
    } catch (e) {
      attempts.push({ key, format: "objects/{key}/records", error: e.message });
    }

    // Try format 2: /custom-objects/{key}/records  
    try {
      const url2 = `https://services.leadconnectorhq.com/custom-objects/${key}/records?locationId=${lid}&limit=50`;
      const r2 = await fetch(url2, { headers: HDRS });
      const d2 = await r2.json();
      attempts.push({ key, format: "custom-objects/{key}/records", status: r2.status });

      const recs = d2.records || d2.data || d2.objects || [];
      if (r2.ok && Array.isArray(recs) && recs.length > 0) {
        return res.json({
          success: true,
          key,
          format: "custom-objects/{key}/records",
          records: recs,
          attempts,
        });
      }
    } catch (e) {
      attempts.push({ key, format: "custom-objects/{key}/records", error: e.message });
    }
  }

  // Nothing worked — return all attempts for debugging
  res.json({ success: false, records: [], attempts });
});

// ── Original objects endpoint (keep for compatibility)
app.get("/api/objects", async (req, res) => {
  const { locationId } = req.query;
  try {
    const r = await fetch(
      `https://services.leadconnectorhq.com/objects/?locationId=${locationId}`,
      { headers: HDRS }
    );
    res.status(r.status).json(await r.json());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/objects/:objectKey/records", async (req, res) => {
  const { locationId } = req.query;
  const { objectKey }  = req.params;
  try {
    const r = await fetch(
      `https://services.leadconnectorhq.com/objects/${objectKey}/records?locationId=${locationId}&limit=50`,
      { headers: HDRS }
    );
    res.status(r.status).json(await r.json());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`✅ DFL Proxy running on port ${PORT}`));
