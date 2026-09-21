// Local FixIt development server. No framework required.
// Reads GEMINI_API_KEY from .env when present. Browser session keys can override it.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
function loadEnv() {
    const p = path.join(ROOT, '.env');
    if (!fs.existsSync(p))
        return;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!m)
            continue;
        let v = m[2].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
            v = v.slice(1, -1);
        if (!process.env[m[1]])
            process.env[m[1]] = v;
    }
}
loadEnv();
const BASE = 'https://generativelanguage.googleapis.com/v1beta';
function send(res, status, data, type = 'application/json') { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(type === 'application/json' ? JSON.stringify(data) : data); }
function keyFrom(req, body) { return String(req.headers['x-fixit-api-key'] || body?.apiKey || process.env.GEMINI_API_KEY || '').trim(); }
function readBody(req) { return new Promise((resolve, reject) => { let data = ''; let size = 0; req.on('data', c => { size += c.length; if (size > 35 * 1024 * 1024) {
    req.destroy();
    reject(new Error('Request is too large (35 MB maximum).'));
    return;
} data += c; }); req.on('end', () => { try {
    resolve(data ? JSON.parse(data) : {});
}
catch (e) {
    reject(new Error('Invalid JSON request.'));
} }); req.on('error', reject); }); }
async function proxyChat(req, res) {
    const body = await readBody(req);
    const key = keyFrom(req, body);
    if (!key)
        return send(res, 500, { error: { message: 'Gemini API key is not configured. Use My Gemini Key or add GEMINI_API_KEY to .env.' } });
    const model = String(body.model || '').trim();
    if (!model)
        return send(res, 400, { error: { message: 'No Astra model selected.' } });
    const payload = { systemInstruction: body.systemInstruction, contents: body.contents, generationConfig: body.generationConfig };
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
    const r = await fetch(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(payload) });
    const text = await r.text();
    let data;
    try {
        data = JSON.parse(text);
    }
    catch {
        data = { error: { message: text || `Gemini returned HTTP ${r.status}.` } };
    }
    send(res, r.status, data);
}
async function proxyModels(req, res) {
    const u = new URL(req.url, 'http://localhost');
    const key = String(req.headers['x-fixit-api-key'] || process.env.GEMINI_API_KEY || '').trim();
    if (!key)
        return send(res, 500, { error: { message: 'Gemini API key is not configured. Use My Gemini Key or add GEMINI_API_KEY to .env.' } });
    const r = await fetch(`${BASE}/models`, { headers: { 'x-goog-api-key': key } });
    const text = await r.text();
    let data;
    try {
        data = JSON.parse(text);
    }
    catch {
        data = { error: { message: text } };
    }
    send(res, r.status, data);
}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.ico': 'image/x-icon' };
const server = http.createServer(async (req, res) => {
    try {
        const u = new URL(req.url, 'http://localhost');
        if (u.pathname === '/api/chat' && req.method === 'POST')
            return await proxyChat(req, res);
        if (u.pathname === '/api/models' && req.method === 'GET')
            return await proxyModels(req, res);
        if (u.pathname === '/api/health')
            return send(res, 200, { ok: true, geminiConfigured: Boolean(process.env.GEMINI_API_KEY), local: true });
        let p = path.normalize(path.join(ROOT, u.pathname === '/' ? 'index.html' : u.pathname));
        if (!p.startsWith(ROOT))
            return send(res, 403, { error: 'Forbidden' });
        if (!fs.existsSync(p) || fs.statSync(p).isDirectory())
            p = path.join(ROOT, 'index.html');
        const ext = path.extname(p);
        res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
        fs.createReadStream(p).pipe(res);
    }
    catch (e) {
        console.error(e);
        send(res, 500, { error: { message: e.message || 'Local server error' } });
    }
});
server.listen(PORT, () => console.log(`\nAurora Cloud FixIt running at http://localhost:${PORT}\n`));
