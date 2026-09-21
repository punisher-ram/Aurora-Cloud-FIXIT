const BASE = "https://generativelanguage.googleapis.com/v1beta";
export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: { message: "Method not allowed." } });
    }
    try {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
        const key = String(req.headers?.["x-fixit-api-key"] || body.apiKey || process.env.GEMINI_API_KEY || "").trim();
        if (!key)
            return res.status(500).json({ error: { message: "Gemini API key is not configured. Add GEMINI_API_KEY in Vercel, or use My Gemini Key." } });
        const model = String(body.model || "").trim();
        if (!model)
            return res.status(400).json({ error: { message: "No Astra model selected." } });
        const payload = { systemInstruction: body.systemInstruction, contents: body.contents, generationConfig: body.generationConfig };
        Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
        const r = await fetch(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(payload) });
        const text = await r.text();
        let data;
        try {
            data = JSON.parse(text);
        }
        catch {
            data = { error: { message: text || `Gemini returned HTTP ${r.status}.` } };
        }
        return res.status(r.status).json(data);
    }
    catch (e) {
        console.error(e);
        return res.status(500).json({ error: { message: e?.message || "FixIt could not reach Gemini." } });
    }
}
