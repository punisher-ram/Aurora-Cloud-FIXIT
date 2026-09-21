const BASE = "https://generativelanguage.googleapis.com/v1beta";
export default async function handler(req, res) {
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return res.status(405).json({ error: { message: "Method not allowed." } });
    }
    try {
        const key = String(req.headers['x-fixit-api-key'] || req.query?.key || process.env.GEMINI_API_KEY || "").trim();
        if (!key)
            return res.status(500).json({ error: { message: "Gemini API key is not configured." } });
        const r = await fetch(`${BASE}/models`, { headers: { "x-goog-api-key": key } });
        const text = await r.text();
        let d;
        try {
            d = JSON.parse(text);
        }
        catch {
            d = { error: { message: text } };
        }
        return res.status(r.status).json(d);
    }
    catch (e) {
        return res.status(500).json({ error: { message: "Could not reach Gemini model discovery." } });
    }
}
