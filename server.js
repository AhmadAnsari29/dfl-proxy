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

app.get("/", (req, res) => {
  res.json({ status: "DFL Proxy running ✅", time: new Date().toISOString() });
});

app.get("/api/location/:locationId", async (req, res) => {
  try {
    const r = await fetch(`https://services.leadconnectorhq.com/locations/${req.params.locationId}`, { headers: HDRS });
    res.status(r.status).json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/discover/:locationId", async (req, res) => {
  const lid = req.params.locationId;
  try {
    const r = await fetch(`https://services.leadconnectorhq.com/objects/?locationId=${lid}`, { headers: HDRS });
    const d = await r.json();
    res.json({ results: [{ endpoint: "objects/?locationId", status: r.status, data: d }] });
  } catch (e) { res.json({ results: [{ error: e.message }] }); }
});

app.get("/api/records/:locationId", async (req, res) => {
  const lid      = req.params.locationId;
  const keyHint  = req.query.key || "custom_objects.monthly_business_scorecards";
  const OBJECT_ID = "69852e100844284f4cd2b338";
  const attempts  = [];

  // Try 5 different methods to find records
  const methods = [
    // POST search with key
    async () => {
      const url = `https://services.leadconnectorhq.com/objects/${keyHint}/records/search`;
      const r = await fetch(url, { method: "POST", headers: HDRS, body: JSON.stringify({ locationId: lid, page: 1, pageLimit: 50 }) });
      const d = await r.json();
      return { label: "POST search key", status: r.status, data: d };
    },
    // POST search with ID
    async () => {
      const url = `https://services.leadconnectorhq.com/objects/${OBJECT_ID}/records/search`;
      const r = await fetch(url, { method: "POST", headers: HDRS, body: JSON.stringify({ locationId: lid, page: 1, pageLimit: 50 }) });
      const d = await r.json();
      return { label: "POST search ID", status: r.status, data: d };
    },
    // GET with key
    async () => {
      const url = `https://services.leadconnectorhq.com/objects/${keyHint}/records?locationId=${lid}&limit=50`;
      const r = await fetch(url, { headers: HDRS });
      const d = await r.json();
      return { label: "GET key", status: r.status, data: d };
    },
    // GET with ID
    async () => {
      const url = `https://services.leadconnectorhq.com/objects/${OBJECT_ID}/records?locationId=${lid}&limit=50`;
      const r = await fetch(url, { headers: HDRS });
      const d = await r.json();
      return { label: "GET ID", status: r.status, data: d };
    },
    // POST with encoded key
    async () => {
      const encoded = encodeURIComponent(keyHint);
      const url = `https://services.leadconnectorhq.com/objects/${encoded}/records/search`;
      const r = await fetch(url, { method: "POST", headers: HDRS, body: JSON.stringify({ locationId: lid, page: 1, pageLimit: 50 }) });
      const d = await r.json();
      return { label: "POST encoded key", status: r.status, data: d };
    },
  ];

  for (const method of methods) {
    try {
      const result = await method();
      attempts.push({ label: result.label, status: result.status, keys: Object.keys(result.data || {}) });
      const recs = result.data?.records || result.data?.data || result.data?.hits || result.data?.objects || [];
      if (result.status === 200) {
        return res.json({ success: true, method: result.label, records: recs, attempts, raw: result.data });
      }
    } catch (e) {
      attempts.push({ error: e.message });
    }
  }

  res.json({ success: false, records: [], attempts });
});

app.get("/api/objects", async (req, res) => {
  try {
    const r = await fetch(`https://services.leadconnectorhq.com/objects/?locationId=${req.query.locationId}`, { headers: HDRS });
    res.status(r.status).json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/objects/:objectKey/records", async (req, res) => {
  try {
    const r = await fetch(`https://services.leadconnectorhq.com/objects/${req.params.objectKey}/records?locationId=${req.query.locationId}&limit=50`, { headers: HDRS });
    res.status(r.status).json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => console.log(`✅ DFL Proxy running on port ${PORT}`));
