const MODELS = [
    ["Astra Flash 3", "gemini-3-flash-preview"], ["Astra Flash 3.1 Lite", "gemini-3.1-flash-lite"], ["Astra Flash 3.5", "gemini-3.5-flash"], ["Astra Flash 3.5 Lite", "gemini-3.5-flash-lite"], ["Astra Flash 3.6", "gemini-3.6-flash"], ["Astra Flash 3.7", "gemini-3.7-flash"], ["Astra Flash 3.8", "gemini-3.8-flash"], ["Astra Gemma 4 31B", "gemma-4-31b-it"], ["Astra Flash 3.1 Image", "gemini-3.1-flash-image"]
];
const state = { files: [], followupFiles: [], diagnosis: null, model: "gemini-3.1-flash-lite", turns: [], busy: false, status: "waiting" };
const $ = id => document.getElementById(id);
const toast = s => { let t = $("toast"); t.textContent = s; t.classList.add("show"); clearTimeout(t._x); t._x = setTimeout(() => t.classList.remove("show"), 2400); };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function renderModels() { const s = $("model"); s.innerHTML = MODELS.map(x => `<option value="${x[1]}">${x[0]}</option>`).join(""); s.value = state.model; }
async function fetchJson(url, options = {}) { const r = await fetch(url, options); const text = await r.text(); let d = {}; try {
    d = text ? JSON.parse(text) : {};
}
catch {
    d = { error: { message: text } };
} if (!r.ok)
    throw Error(d?.error?.message || `Request failed (${r.status})`); return d; }
async function directModels(key) { return fetchJson("https://generativelanguage.googleapis.com/v1beta/models", { headers: { "x-goog-api-key": key } }); }
async function discoverModels() { const own = sessionStorage.getItem("FIXIT_GEMINI_KEY") || ""; try {
    let d;
    try {
        d = await fetchJson("/api/models", own ? { headers: { "x-fixit-api-key": own } } : {});
    }
    catch (e) {
        if (!own)
            throw e;
        d = await directModels(own);
    }
    const remote = (d.models || []).filter(m => (m.supportedGenerationMethods || []).some(x => String(x).toLowerCase().includes("generatecontent"))).map(x => String(x.name || "").replace(/^models\//, ""));
    const usable = MODELS.filter(x => remote.includes(x[1]));
    if (!usable.length)
        throw Error("No configured Astra model is available for this Gemini key.");
    const prev = state.model;
    state.model = usable.some(x => x[1] === prev) ? prev : usable[0][1];
    $("model").innerHTML = usable.map(x => `<option value="${x[1]}">${x[0]}</option>`).join("");
    $("model").value = state.model;
    return true;
}
catch (e) {
    renderModels();
    console.warn("Model discovery:", e.message);
    return false;
} }
function renderFiles() { const box = $("fileList"); box.innerHTML = ""; if (!state.files.length) {
    box.classList.remove("show");
    return;
} box.classList.add("show"); state.files.forEach((f, i) => { const el = document.createElement("div"); el.className = "file-item"; el.innerHTML = `<div class="file-icon">${f.type.startsWith("image/") ? "🖼️" : f.type.startsWith("video/") ? "🎥" : f.type === "application/pdf" ? "📄" : "📎"}</div><div class="file-name">${esc(f.name)}</div><div class="file-size">${Math.round(f.size / 1024)} KB</div><button class="remove" data-i="${i}">✕</button>`; el.querySelector(".remove").onclick = () => { state.files.splice(i, 1); renderFiles(); }; box.appendChild(el); }); }
function addFiles(list) { for (const f of list) {
    if (f.size > 15 * 1024 * 1024) {
        toast(f.name + " is over the 15 MB limit.");
        continue;
    }
    state.files.push(f);
} renderFiles(); updateAstraContext(); }
function addFollowupFiles(list) { for (const f of list) {
    if (f.size > 15 * 1024 * 1024) {
        toast(f.name + " is over the 15 MB limit.");
        continue;
    }
    state.followupFiles.push(f);
} renderFollowupFiles(); }
function renderFollowupFiles() { const box = $("followupFiles"); if (!box)
    return; box.innerHTML = ""; state.followupFiles.forEach((f, i) => { const el = document.createElement("div"); el.className = "followup-file"; el.innerHTML = `<span>${f.type.startsWith("image/") ? "🖼️" : f.type.startsWith("video/") ? "🎥" : f.type === "application/pdf" ? "📄" : "📎"}</span><span>${esc(f.name)}</span><button type="button" aria-label="Remove ${esc(f.name)}">✕</button>`; el.querySelector("button").onclick = () => { state.followupFiles.splice(i, 1); renderFollowupFiles(); }; box.appendChild(el); }); }
function updateAstraContext() { const box = $("astraContext"); if (!box)
    return; const desc = $("problem")?.value.trim() || "No description yet"; const files = state.files.length ? `${state.files.length} evidence file${state.files.length > 1 ? "s" : ""}` : "No evidence files"; const latest = state.diagnosis ? state.diagnosis.replace(/\s+/g, " ").slice(0, 260) : "No FixIt diagnosis yet."; box.classList.remove("hidden"); box.innerHTML = `<strong>🧠 Live FixIt context</strong><br>${esc(desc.slice(0, 150))}<br><span>${esc(files)} · Latest: ${esc(latest)}${latest.length >= 260 ? "…" : ""}</span>`; }
$("uploadBtn").onclick = () => $("file").click();
$("file").onchange = e => addFiles(e.target.files);
["dragenter", "dragover"].forEach(x => $("drop").addEventListener(x, e => { e.preventDefault(); $("drop").classList.add("drag"); }));
["dragleave", "drop"].forEach(x => $("drop").addEventListener(x, e => { e.preventDefault(); $("drop").classList.remove("drag"); }));
$("drop").addEventListener("drop", e => addFiles(e.dataTransfer.files));
document.querySelectorAll(".chip").forEach(c => c.onclick = () => { $("problem").value = `I have a problem with ${c.textContent.replace(/^\S+\s/, "").toLowerCase()}. `; $("problem").focus(); });
function readFile(f) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); }); }
async function partFor(f) { if (f.type.startsWith("text/") || f.type === "application/json") {
    const text = await f.text();
    return { text: `FILE: ${f.name}\n${text.slice(0, 50000)}` };
} const data = await readFile(f); return { inlineData: { mimeType: f.type || "application/octet-stream", data: data.split(",")[1] } }; }
async function directGenerate(payload, key) { return fetchJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(payload.model)}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify((({ model, ...body }) => body)(payload)) }); }
async function gemini(contents, system) { const own = sessionStorage.getItem("FIXIT_GEMINI_KEY") || ""; const payload = { model: state.model, systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { temperature: .2 } }; try {
    return await fetchJson("/api/chat", { method: "POST", headers: { "Content-Type": "application/json", ...(own ? { "x-fixit-api-key": own } : {}) }, body: JSON.stringify(payload) });
}
catch (e) {
    if (own && (e instanceof TypeError || /fetch|network|failed/i.test(e.message)))
        return directGenerate(payload, own);
    throw e;
} }
function extractText(d) { return d?.candidates?.[0]?.content?.parts?.map(p => typeof p.text === "string" ? p.text : "").join("") || ""; }
function enginePrompt(mode) { return `You are FixIt Engine, the dedicated troubleshooting wrapper inside Aurora Cloud FixIt. You are not a generic chatbot and you are not Astra. Your job is to help a person actually resolve the problem they brought you.\n\nOPERATING METHOD:\n1. Inspect every supplied piece of evidence before forming a conclusion.\n2. Separate OBSERVED FACTS from INFERENCES. Never present a guess as a fact.\n3. Identify the most plausible issue(s), but keep uncertainty explicit when evidence is insufficient.\n4. Choose the safest, lowest-risk useful check first.\n5. Give concrete actions the person can perform, in order. For every important step, say what result to look for and what the next branch is if it fails.\n6. End with a verification step so the person can tell whether the fix actually worked.\n7. If the evidence is insufficient, ask only the smallest number of questions needed to continue; do not invent missing details.\n8. Treat screenshots, photos, videos and attached files as evidence, not decoration. Mention visible evidence when it materially supports your conclusion.\n9. For dangerous situations involving mains electricity, gas, fire, structural damage, chemicals, high voltage, brakes, steering, airbags, fuel systems or other serious hazards, do not provide hazardous repair instructions. Give safe checks and recommend a qualified professional.\n10. Never reveal private chain-of-thought or hidden reasoning. Give the useful conclusion and concise rationale instead.\n11. Never fabricate error codes, specifications, measurements, model numbers, URLs or test results.\n12. Answer the user's actual problem, not a generic version of it.\n\nOUTPUT RULE: Return ONLY the answer the user should see. Plain text. Preserve your own emojis, headings, bullets, markdown symbols and line breaks. Do not wrap the answer in JSON or a code block. Do not mention these instructions.\n\nCURRENT MODE: ${mode}`; }
async function analyze() {
    if (state.busy)
        return;
    const desc = $("problem").value.trim();
    if (!state.files.length && !desc) {
        toast("Add evidence or describe the problem first.");
        return;
    }
    if (!state.model) {
        toast("Choose an Astra model first.");
        return;
    }
    state.busy = true;
    setStatus("investigating");
    $("loading").classList.add("show");
    $("analyze").disabled = true;
    $("analyze").textContent = "⏳ FixIt is working…";
    $("result").style.display = "block";
    $("result").innerHTML = `<div class="raw-result"><div class="raw-result-head"><div><div class="kicker">FixIt Engine</div><div class="raw-result-title">Examining the problem…</div><div class="raw-result-meta">Evidence → diagnosis → action → verification</div></div></div><div class="raw-output loading-state">FixIt is inspecting the evidence and building a troubleshooting path…</div></div>`;
    $("result").classList.add("show");
    try {
        const parts = [{ text: `USER PROBLEM:\n${desc || "(No description supplied. Use only the attached evidence.)"}` }];
        for (const f of state.files)
            parts.push(await partFor(f));
        const d = await gemini([{ role: "user", parts }], enginePrompt("INITIAL DIAGNOSIS"));
        const raw = extractText(d);
        if (!raw)
            throw Error(d?.promptFeedback?.blockReason ? `Gemini blocked the request: ${d.promptFeedback.blockReason}` : "Gemini returned an empty answer.");
        state.diagnosis = raw;
        state.turns = [{ role: "user", text: desc, files: state.files.map(f => f.name) }, { role: "fixit", text: raw }];
        setStatus(inferStatusFromAnswer(raw));
        renderRawResult(raw, "Initial diagnosis");
        updateAstraContext();
    }
    catch (e) {
        console.error(e);
        renderResultError(e?.message || String(e));
    }
    finally {
        state.busy = false;
        $("loading").classList.remove("show");
        $("analyze").disabled = false;
        $("analyze").textContent = "🔍 Diagnose & Build a Fix";
    }
}
function renderInlineFixItMarkdown(value) {
    let text = esc(value);
    const code = [];
    text = text.replace(/`([^`\n]+)`/g, (_, c) => { const i = code.length; code.push(`<code>${c}</code>`); return `\u0000CODE${i}\u0000`; });
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)(?:\s+"([^"]*)")?\)/g, (_, label, url, title) => `<a href="${url}" target="_blank" rel="noopener noreferrer"${title ? ` title="${title}"` : ""}>${label}</a>`);
    text = text.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>").replace(/__([^_\n]+)__/g, "<strong>$1</strong>").replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>").replace(/(?<!_)_([^_\n]+)_(?!_)/g, "<em>$1</em>").replace(/~~([^~\n]+)~~/g, "<del>$1</del>").replace(/\\([\\`*_[\]{}()#+.!-])/g, "$1").replace(/ {2}\n/g, "<br>");
    return text.replace(/\u0000CODE(\d+)\u0000/g, (_, i) => code[Number(i)]);
}
function markdownSafe(raw) {
    const source = String(raw ?? "").replace(/\r\n?/g, "\n");
    const lines = source.split("\n");
    const html = [];
    let paragraph = [];
    let listType = null;
    let codeBuffer = null;
    let codeLanguage = "";
    const flush = () => { if (!paragraph.length)
        return; html.push(`<p>${paragraph.map(renderInlineFixItMarkdown).join("<br>")}</p>`); paragraph = []; };
    const closeList = () => { if (listType) {
        html.push(`</${listType}>`);
        listType = null;
    } };
    const closeCode = () => { if (codeBuffer === null)
        return; const lang = codeLanguage ? ` class="language-${esc(codeLanguage)}"` : ""; html.push(`<pre><code${lang}>${esc(codeBuffer.join("\n"))}</code></pre>`); codeBuffer = null; codeLanguage = ""; };
    for (const line of lines) {
        const fence = line.match(/^\s*```\s*([\w+-]*)\s*$/);
        if (codeBuffer !== null) {
            if (fence)
                closeCode();
            else
                codeBuffer.push(line);
            continue;
        }
        if (fence) {
            flush();
            closeList();
            codeBuffer = [];
            codeLanguage = fence[1] || "";
            continue;
        }
        if (!line.trim()) {
            flush();
            closeList();
            continue;
        }
        const h = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
        if (h) {
            flush();
            closeList();
            html.push(`<h${h[1].length}>${renderInlineFixItMarkdown(h[2])}</h${h[1].length}>`);
            continue;
        }
        if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
            flush();
            closeList();
            html.push("<hr>");
            continue;
        }
        const u = line.match(/^\s*[-*+]\s+(.+)$/), o = line.match(/^\s*\d+[.)]\s+(.+)$/);
        if (u || o) {
            flush();
            const wanted = o ? "ol" : "ul";
            if (listType !== wanted) {
                closeList();
                listType = wanted;
                html.push(`<${listType}>`);
            }
            html.push(`<li>${renderInlineFixItMarkdown((o || u)[1])}</li>`);
            continue;
        }
        const q = line.match(/^\s*>\s?(.*)$/);
        if (q) {
            flush();
            closeList();
            html.push(`<blockquote>${renderInlineFixItMarkdown(q[1])}</blockquote>`);
            continue;
        }
        closeList();
        paragraph.push(line);
    }
    flush();
    closeList();
    closeCode();
    return html.join("");
}
function togglePretty() { const out = $("rawOutput"); const raw = out.dataset.raw || out.textContent || ""; const rendered = !out.classList.contains("pretty"); if (rendered) {
    out.classList.add("pretty");
    out.innerHTML = markdownSafe(raw);
}
else {
    out.classList.remove("pretty");
    out.textContent = raw;
} $("rawToggle").textContent = rendered ? "Raw" : "Rendered"; $("rawToggle").classList.toggle("active", rendered); }
function statusInfo() {
    const map = {
        investigating: { icon: "🔵", label: "Investigating", cls: "investigating" },
        waiting: { icon: "🟡", label: "Waiting for your result", cls: "waiting" },
        verified: { icon: "🟢", label: "Fix verified", cls: "verified" },
        professional: { icon: "🔴", label: "Professional help recommended", cls: "professional" }
    };
    return map[state.status] || map.waiting;
}
function inferStatusFromAnswer(raw) {
    const t = String(raw || "").toLowerCase();
    if (/fix (is|has been) verified|problem (is|has been) resolved|issue (is|has been) resolved|working normally now|successfully fixed|that confirms the fix worked/.test(t))
        return "verified";
    if (/do not attempt|don't attempt|stop using|unplug immediately|qualified professional|professional service|seek professional|requires professional/.test(t))
        return "professional";
    return "waiting";
}
function setStatus(status) { state.status = status; updateStatusUI(); }
function scrollFixitTo(el, mode = "start") {
    const scroller = document.querySelector(".fixit");
    if (!scroller || !el)
        return;
    const sr = scroller.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    let top = scroller.scrollTop + (er.top - sr.top);
    if (mode === "center")
        top -= Math.max(0, (sr.height - er.height) / 2);
    else
        top -= 24;
    scroller.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}
function updateStatusUI() {
    const info = statusInfo();
    const dot = $("caseStatusDot"), icon = $("caseStatusIcon"), label = $("caseStatusLabel");
    if (dot) {
        dot.className = `status-dot status-dot-${info.cls}`;
    }
    if (icon)
        icon.textContent = info.icon;
    if (label)
        label.textContent = info.label;
}
function chooseFollowup(kind) {
    const input = $("followupInput");
    if (!input)
        return;
    setStatus("waiting");
    updateStatusUI();
    input.value = kind === "done" ? "I did it. Here is what happened: " : "It didn't work. Here is what happened: ";
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    scrollFixitTo($("followup"), "center");
}
function renderConversation(scrollToLatest = true) {
    const modelLabel = $("model").selectedOptions[0]?.textContent || state.model;
    const evidenceCount = state.files.length;
    const turns = state.turns || [];
    let shell = $("result").querySelector(".conversation-result");
    if (!shell) {
        $("result").innerHTML = `<div class="raw-result conversation-result"><div class="raw-result-head"><div><div class="kicker">FixIt Engine</div><div class="raw-result-title">Troubleshooting conversation</div><div class="raw-result-meta" id="caseMeta"></div></div><span class="model-pill">● Live</span></div><div class="conversation-stream" id="fixitConversation"></div><div class="case-bar"><div class="case-status"><span id="caseStatusDot" class="status-dot"></span><span id="caseStatusIcon" class="status-icon"></span><strong id="caseStatusLabel"></strong></div><div class="case-meta">Evidence → diagnosis → action → verification</div></div><div class="raw-actions"><button class="btn primary" onclick="openFollowUp()">Continue with FixIt</button><button class="btn success-action" onclick="chooseFollowup('done')">✓ I did it</button><button class="btn retry-action" onclick="chooseFollowup('failed')">✕ Didn't work</button><button class="btn" onclick="askAstra()">Explain with Astra</button><button class="btn" onclick="copyFixItAnswer()">Copy latest answer</button></div></div><div class="followup" id="followup"><div><b>What happened after you tried it?</b><span>Tell FixIt exactly what you observed. You can also attach a new photo, screenshot, video or file if the next issue needs evidence.</span></div><div class="followup-upload"><label class="btn" for="followupFile">📎 Add evidence</label><input id="followupFile" type="file" multiple accept="image/*,video/*,audio/*,application/pdf,text/plain,text/csv,application/json,.md"><button type="button" class="btn" id="clearFollowupFiles">Clear attachments</button></div><div class="followup-files" id="followupFiles"></div><textarea class="textarea" id="followupInput" placeholder="Example: I restarted it, but the same error came back. I also attached a photo of the error."></textarea><button class="btn primary" id="continueBtn">Continue diagnosis</button></div>`;
        shell = $("result").querySelector(".conversation-result");
        const followupFile = $("followupFile");
        if (followupFile)
            followupFile.onchange = e => addFollowupFiles(e.target.files);
        const clear = $("clearFollowupFiles");
        if (clear)
            clear.onclick = () => { state.followupFiles = []; renderFollowupFiles(); };
        const cont = $("continueBtn");
        if (cont)
            cont.onclick = continueFix;
    }
    const meta = $("caseMeta");
    if (meta)
        meta.textContent = `${modelLabel} · ${evidenceCount ? `${evidenceCount} evidence file${evidenceCount > 1 ? 's' : ''}` : 'description only'} · ${turns.filter(t => t.role === 'user').length} user turn${turns.filter(t => t.role === 'user').length === 1 ? '' : 's'} · ${turns.filter(t => t.role === 'fixit').length} FixIt response${turns.filter(t => t.role === 'fixit').length === 1 ? '' : 's'}`;
    updateStatusUI();
    const stream = $("fixitConversation");
    if (stream) {
        const renderedCount = Number(stream.dataset.renderedCount || 0);
        for (let i = renderedCount; i < turns.length; i++) {
            const t = turns[i];
            const wrap = document.createElement("div");
            wrap.className = `chat-turn ${t.role === 'user' ? 'chat-turn-user' : 'chat-turn-fixit'}`;
            if (t.role === 'user') {
                const files = (t.files || []).filter(Boolean);
                wrap.innerHTML = `<div class="chat-role user-role">You</div><div class="chat-bubble user-bubble"><div class="chat-text"></div>${files.length ? `<div class="chat-attachments">${files.map(f => `<span class="chat-attachment">📎 ${esc(f)}</span>`).join('')}</div>` : ''}</div>`;
                wrap.querySelector('.chat-text').textContent = t.text || 'Attached evidence.';
            }
            else {
                const id = `fixitTurn${i}`;
                wrap.innerHTML = `<div class="chat-role fixit-role"><span class="fixit-dot"></span> FixIt <span class="turn-label">${i === 1 ? 'Initial diagnosis' : 'Next FixIt step'}</span></div><div class="response-bubble"><div class="response-toolbar"><button onclick="copyTurn(${i})">▣ Copy</button>${i === turns.length - 1 ? `<button onclick="bookmarkFixIt()">☆ Bookmark</button><button onclick="regenerateFixIt()">↻ Regenerate</button><button onclick="askAstra()">✦ Ask Astra</button>` : ''}</div><div class="raw-output pretty" id="${id}">${markdownSafe(t.text || '')}</div></div>`;
            }
            stream.appendChild(wrap);
        }
        stream.dataset.renderedCount = String(turns.length);
    }
    $("result").classList.add('show');
    $("result").style.display = 'block';
    renderFollowupFiles();
    updateAstraContext();
    if (scrollToLatest) {
        requestAnimationFrame(() => { const stream = $("fixitConversation"); const last = stream?.lastElementChild; if (last)
            scrollFixitTo(last, "start");
        else
            scrollFixitTo($("followup"), "center"); });
    }
}
async function copyTurn(index) { const t = state.turns?.[index]; if (!t?.text)
    return; const ok = await copyTextRobust(t.text); toast(ok ? 'Copied FixIt response.' : 'Could not copy automatically.'); }
function renderRawResult(raw, label = "FixIt answer") {
    if (!state.turns.length || state.turns[state.turns.length - 1]?.text !== raw) {
        state.turns.push({ role: 'fixit', text: raw, label });
    }
    state.diagnosis = raw;
    renderConversation(true);
}
function openFollowUp() { const box = $("followup"); if (!box)
    return; box.style.display = "block"; scrollFixitTo(box, "center"); $("followupInput")?.focus(); }
async function continueFix() { const q = $("followupInput")?.value.trim(); if ((!q && !state.followupFiles.length) || state.busy)
    return; state.busy = true; setStatus("investigating"); $("continueBtn").disabled = true; $("continueBtn").textContent = "⏳ Updating the fix…"; try {
    const history = state.turns.slice(-8).map(t => `${t.role.toUpperCase()}${t.files?.length ? ` [${t.files.join(", ")}]` : ""}:\n${t.text}`).join("\n\n");
    const parts = [{ text: `PREVIOUS FIXIT SESSION:\n${history}\n\nNEW OBSERVATION FROM USER:\n${q || "(See attached new evidence.)"}\n\nAttached new evidence should be treated as part of the current case. Decide the next safest useful action. If the previous step worked, verify it and say what to do next. If it failed, branch to the next diagnostic check.` }];
    for (const f of state.followupFiles)
        parts.push(await partFor(f));
    const d = await gemini([{ role: "user", parts }], enginePrompt("INTERACTIVE FOLLOW-UP"));
    const raw = extractText(d);
    if (!raw)
        throw Error("FixIt returned an empty follow-up answer.");
    const addedFiles = state.followupFiles.map(f => f.name);
    state.turns.push({ role: "user", text: q || "Attached new evidence.", files: addedFiles }, { role: "fixit", text: raw });
    state.diagnosis = raw;
    setStatus(inferStatusFromAnswer(raw));
    if (state.followupFiles.length) {
        state.files.push(...state.followupFiles);
        state.followupFiles = [];
    }
    const followup = $("followup");
    if (followup)
        followup.style.display = "none";
    const input = $("followupInput");
    if (input)
        input.value = "";
    renderFollowupFiles();
    renderConversation(true);
    updateAstraContext();
}
catch (e) {
    toast("FixIt: " + (e?.message || e));
}
finally {
    state.busy = false;
    $("continueBtn").disabled = false;
    $("continueBtn").textContent = "Continue diagnosis";
} }
function renderResultError(message) { $("result").innerHTML = `<div class="raw-result"><div class="raw-result-head"><div><div class="raw-result-title">FixIt could not complete the diagnosis</div><div class="raw-result-meta">The API error is shown below.</div></div></div><pre class="result-error" id="resultError"></pre><div class="raw-actions"><button class="btn" onclick='$("keyBtn").click()'>🔑 Check Gemini Key</button></div></div>`; $("resultError").textContent = message; $("result").classList.add("show"); $("result").scrollIntoView({ behavior: "smooth", block: "start" }); toast("FixIt: " + message); }
window.bookmarkFixIt = () => { const text = $("rawOutput")?.dataset.raw || $("rawOutput")?.textContent || ""; if (!text)
    return; const saved = JSON.parse(localStorage.getItem("FIXIT_BOOKMARKS") || "[]"); saved.unshift({ text, model: state.model, at: new Date().toISOString() }); localStorage.setItem("FIXIT_BOOKMARKS", JSON.stringify(saved.slice(0, 20))); toast("FixIt answer bookmarked."); };
window.regenerateFixIt = async () => {
    if (state.busy || !state.turns.length)
        return;
    const desc = $("problem").value.trim();
    state.busy = true;
    try {
        const parts = [{ text: `USER PROBLEM:
${desc || "(No description supplied.)"}` }];
        for (const f of state.files)
            parts.push(await partFor(f));
        const d = await gemini([{ role: "user", parts }], enginePrompt("REGENERATE INITIAL DIAGNOSIS"));
        const raw = extractText(d);
        if (!raw)
            throw Error("FixIt returned an empty answer.");
        state.diagnosis = raw;
        setStatus(inferStatusFromAnswer(raw));
        state.turns.push({ role: "fixit", text: raw, label: "Regenerated diagnosis" });
        renderConversation(true);
        updateAstraContext();
        toast("FixIt regenerated the diagnosis.");
    }
    catch (e) {
        renderResultError(e?.message || String(e));
    }
    finally {
        state.busy = false;
    }
};
async function copyTextRobust(text) { if (!text)
    return false; try {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
    }
}
catch { } try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
}
catch {
    return false;
} }
window.copyFixItAnswer = async () => { const latest = [...(state.turns || [])].reverse().find(t => t.role === "fixit" && t.text)?.text || state.diagnosis || ""; if (!latest) {
    toast("No FixIt answer to copy yet.");
    return;
} const ok = await copyTextRobust(latest); toast(ok ? "FixIt answer copied." : "Copy was blocked by the browser."); };
window.askAstra = () => { $("astraInput").value = "Explain the current FixIt case simply and tell me what I should do next."; $("astraInput").focus(); };
function appendAstraMessage(text, isUser = false) { const box = $("astraMessages"); const m = document.createElement("div"); m.className = `msg${isUser ? " user" : " markdown-body"}`; if (isUser)
    m.textContent = text;
else
    m.innerHTML = markdownSafe(text); box.appendChild(m); box.scrollTop = box.scrollHeight; return m; }
async function astra() { const q = $("astraInput").value.trim(); if (!q)
    return; appendAstraMessage(q, true); $("astraInput").value = ""; const wait = document.createElement("div"); wait.className = "msg"; wait.textContent = "Astra is thinking…"; $("astraMessages").appendChild(wait); $("astraMessages").scrollTop = $("astraMessages").scrollHeight; try {
    const caseHistory = state.turns.slice(-10).map(t => `${t.role.toUpperCase()}${t.files?.length ? ` [${t.files.join(", ")}]` : ""}:\n${t.text}`).join("\n\n");
    const context = `CURRENT FIXIT CASE:\nProblem: ${$("problem")?.value.trim() || "Not provided"}\nEvidence files: ${state.files.map(f => f.name).join(", ") || "None"}\n\nCASE HISTORY:\n${caseHistory || "No diagnosis yet."}\n\nLATEST FIXIT ANSWER:\n${state.diagnosis || "No FixIt diagnosis yet."}`;
    const astraParts = [{ text: `USER QUESTION TO ASTRA:\n${q}\n\n${context}` }];
    for (const f of state.files)
        astraParts.push(await partFor(f));
    const d = await gemini([{ role: "user", parts: astraParts }], `You are Astra AI, the companion inside Aurora Cloud FixIt. FixIt Engine is the primary troubleshooting system. You automatically have the current FixIt case context, including the user's problem, attached evidence, prior observations, and latest FixIt answer. Never ask the user to repeat context that is already supplied. Inspect attached evidence when relevant. Explain, clarify, interpret observations, and help the user understand the next step. Do not invent facts and do not reveal private chain-of-thought. Preserve natural Markdown formatting, emojis, punctuation, headings, lists and line breaks when useful.\n\n${context}`);
    const text = extractText(d) || "Astra returned an empty answer.";
    wait.remove();
    appendAstraMessage(text, false);
}
catch (e) {
    wait.textContent = "Astra: " + (e?.message || e);
} }
$("analyze").onclick = analyze;
$("astraSend").onclick = astra;
$("astraInput").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    astra();
} });
$("model").onchange = e => state.model = e.target.value;
$("problem").addEventListener("input", updateAstraContext);
$("newBtn").onclick = () => { state.files = []; state.followupFiles = []; state.diagnosis = null; state.turns = []; state.status = "waiting"; $("problem").value = ""; renderFiles(); $("result").style.display = "none"; $("result").classList.remove("show"); $("astraMessages").innerHTML = '<div class="msg">✨ <b>Astra is ready.</b><br>FixIt is the troubleshooting engine. I automatically receive the current FixIt case context, evidence, and latest result so you can ask me about it without repeating yourself.</div>'; $("astraContext").classList.add("hidden"); window.scrollTo({ top: 0, behavior: "smooth" }); };
$("keyBtn").onclick = () => { $("apiKeyInput").value = ""; $("keyModal").classList.add("show"); };
$("closeKey").onclick = () => $("keyModal").classList.remove("show");
$("saveKey").onclick = async () => { const k = $("apiKeyInput").value.trim(); if (!k)
    return toast("Paste a Gemini key first."); const oldKey = sessionStorage.getItem("FIXIT_GEMINI_KEY") || ""; sessionStorage.setItem("FIXIT_GEMINI_KEY", k); const ok = await discoverModels(); if (!ok) {
    sessionStorage.setItem("FIXIT_GEMINI_KEY", oldKey);
    return toast("Gemini key could not be verified. Check the key and try again.");
} $("keyModal").classList.remove("show"); toast("Gemini key verified and active."); };
$("clearKey").onclick = async () => { sessionStorage.removeItem("FIXIT_GEMINI_KEY"); $("keyModal").classList.remove("show"); renderModels(); await discoverModels(); toast("Using the Vercel Gemini connection."); };
renderModels();
discoverModels();
