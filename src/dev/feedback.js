// Dev-Werkzeug (nur über scripts/serve.js eingespeist, nie im Build): Kommentare direkt auf der App setzen.
// Alt+Klick = Punkt, Rechtsklick = ganzes Element, Alt+Ziehen = Bereich (ohne Alt bleibt die App bedienbar). Gespeichert in .feedback/comments.json.
// «Handy» zeigt die App in einem 390×844-Rahmen (iframe); dort läuft dasselbe Skript, gesteuert per postMessage.
(() => {
  if (window.__fb) return;
  window.__fb = true;
  const ENDPOINT = "/__feedback";
  const inFrame = window.self !== window.top;
  const MODE = inFrame ? "handy" : "desktop";
  const PHONE = { w: 390, h: 844 };
  const GOLD = "#e0bf6a";
  const KIND = { point: "Punkt", element: "Element", area: "Bereich" };
  const S = { on: false, list: [], draft: null, drag: null, open: false, phone: false, scale: 1, screen: "", toast: "", dictating: "", shown: {}, chat: { open: false, msgs: [], ctxs: [], busy: false } };
  try { S.phone = !inFrame && localStorage.getItem("fb.phone") === "1"; } catch (_) {}

  const css = document.createElement("style");
  css.textContent = `
  [data-fb]{box-sizing:border-box;font:400 14px/20px system-ui,sans-serif;color:var(--text,#f5f5f7)}
  [data-fb] button{font:600 13px/18px system-ui,sans-serif;color:inherit;border:0;background:none;cursor:pointer}
  .fb-pill{background:var(--card,#0e1016)!important;padding:8px 12px;border-radius:999px;box-shadow:var(--edge,none),0 4px 14px rgba(0,0,0,.5)}
  .fb-pill.on{background:var(--accent,${GOLD})!important;color:var(--on-accent,#16181a)}
  .fb-box{position:fixed;border:2px dashed ${GOLD};background:rgba(224,191,106,.12);border-radius:6px;pointer-events:none}
  .fb-box.solid{border-style:solid}
  .fb-pin{position:fixed;width:12px;height:12px;padding:0;border-radius:50%;background:${GOLD}!important;box-shadow:0 0 0 2px rgba(0,0,0,.55),0 0 0 4px rgba(224,191,106,.35);pointer-events:auto;cursor:pointer;opacity:.85}
  .fb-pin:hover,.fb-pin.sel{opacity:1;transform:scale(1.25)}
  .fb-pin::after{content:"";position:absolute;inset:-8px}
  .fb-pop{position:fixed;background:var(--card,#0e1016);border-radius:16px;padding:12px;box-shadow:var(--edge,none),0 8px 30px rgba(0,0,0,.6);pointer-events:auto;display:flex;flex-direction:column;gap:8px}
  .fb-pop textarea{background:var(--well,#161922);border:0;border-radius:10px;color:var(--text,#f5f5f7);padding:10px;font:400 14px/20px system-ui;resize:none;outline:none}
  .fb-xs{font-size:12px;line-height:16px;color:var(--muted,#9a9ba3)}
  .fb-row{display:flex;gap:8px;justify-content:flex-end}
  .fb-sm{background:var(--well,#161922)!important;padding:6px 10px;border-radius:999px;font-size:12px!important}
  .fb-sm.rec{background:#ff6961!important;color:#16181a!important}
  .fb-chip{background:var(--well,#161922);border-radius:999px;padding:2px 8px;display:inline-block;margin:2px 0}
  .fb-chip a{cursor:pointer;color:var(--accent,${GOLD})}
  `;
  document.head.appendChild(css);

  const root = document.createElement("div");
  root.setAttribute("data-fb", "");
  document.body.appendChild(root);

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const isFb = (el) => !!(el && el.closest && el.closest("[data-fb]"));
  const textOf = (el, n = 80) => (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, n);
  // Oberstes offenes Fenster (Fokusmodus, Menü, Dialog/Sheet): Kommentare gelten nur für dieses, nie für die Seite darunter.
  const LAYERS = '#focus, .drawer.open, [role="dialog"][aria-modal="true"], .sheet.open';
  const zOf = (el) => { let z = 0; for (let c = el; c && c !== document.documentElement; c = c.parentElement) { const v = parseInt(getComputedStyle(c).zIndex, 10); if (!isNaN(v)) z = Math.max(z, v); } return z; };
  function topLayer() {
    let best = null, bz = -1;
    for (const el of document.querySelectorAll(LAYERS)) {
      if (isFb(el) || !el.getClientRects().length) continue;
      const z = zOf(el);
      if (z >= bz) { best = el; bz = z; }
    }
    return best;
  }
  const layerName = (l) => l.id === "focus" ? "Fokusmodus" : l.classList.contains("drawer") ? "Menü" : (l.getAttribute("aria-label") || textOf(l.querySelector("h1,h2,h3") || l, 30) || "Fenster");
  const inLayer = (el) => { const l = topLayer(); return !l || l.contains(el) ? el : l; }; // Ziel ausserhalb des obersten Fensters → das Fenster selbst
  const screenName = () => {
    const l = topLayer();
    if (l) return `Fenster: ${layerName(l)}`;
    const tab = document.querySelector(".nav .ni.on");
    const t = tab ? textOf(tab) : "Start";
    return t;
  };
  function selectorOf(el) {
    const parts = [];
    let cur = el;
    while (cur && cur !== document.body && parts.length < 6) {
      const cls = [...cur.classList].slice(0, 2).map((c) => "." + CSS.escape(c)).join("");
      const sib = cur.parentElement ? [...cur.parentElement.children].filter((c) => c.tagName === cur.tagName) : [];
      const nth = sib.length > 1 ? `:nth-of-type(${sib.indexOf(cur) + 1})` : "";
      parts.unshift(cur.tagName.toLowerCase() + cls + nth);
      cur = cur.parentElement;
    }
    return parts.join(" > ") || "body";
  }
  function containedIn(b) {
    const out = [];
    for (const el of (topLayer() || document.body).querySelectorAll("*")) {
      if (isFb(el) || ["SCRIPT", "STYLE"].includes(el.tagName)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const ix = Math.max(0, Math.min(r.right, b.x + b.w) - Math.max(r.left, b.x));
      const iy = Math.max(0, Math.min(r.bottom, b.y + b.h) - Math.max(r.top, b.y));
      if ((ix * iy) / (r.width * r.height) < 0.6) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own && !["BUTTON", "INPUT", "SELECT", "SVG", "I", "IMG"].includes(el.tagName.toUpperCase())) continue;
      out.push({ selector: selectorOf(el), text: textOf(el, 50) });
      if (out.length >= 20) break;
    }
    return out;
  }
  function ancestorOf(b) {
    const lay = topLayer();
    let el = document.elementFromPoint(b.x + b.w / 2, b.y + b.h / 2);
    if (lay && el && !lay.contains(el)) return lay;
    while (el && el !== document.body) {
      const r = el.getBoundingClientRect();
      if (r.left <= b.x + 1 && r.top <= b.y + 1 && r.right >= b.x + b.w - 1 && r.bottom >= b.y + b.h - 1) return el;
      el = el.parentElement;
    }
    return document.body;
  }
  const api = (method, body) =>
    fetch(ENDPOINT, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json());

  const base = () => ({ screen: screenName(), viewport: `${innerWidth}x${innerHeight}`, mode: MODE });
  const boxStyle = (b) => `left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px`;
  function place(c) {
    try {
      const el = document.querySelector(c.selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return null;
      if (c.kind === "element" || c.kind === "area") {
        const box = { x: r.left + r.width * c.rx, y: r.top + r.height * c.ry, w: r.width * (c.rw ?? 1), h: r.height * (c.rh ?? 1) };
        return { x: box.x, y: box.y, box };
      }
      return { x: r.left + r.width * c.rx, y: r.top + r.height * c.ry };
    } catch (_) { return null; }
  }

  // ---- Hinweis-Meldung
  let toastTimer = 0;
  const toast = (m) => { S.toast = m; render(true); clearTimeout(toastTimer); toastTimer = setTimeout(() => { S.toast = ""; render(true); }, 3500); };

  // ---- Kontext eines Elements (für den Chat mit Claude)
  function ctxOf(el, c) {
    const cs = el ? getComputedStyle(el) : null;
    return {
      screen: c ? c.screen : screenName(),
      selector: c ? c.selector : selectorOf(el),
      text: c ? c.elementText : textOf(el, 200),
      comment: c ? c.text : "",
      html: el ? el.outerHTML.replace(/\s+/g, " ").slice(0, 2500) : "",
      styles: cs ? { color: cs.color, background: cs.backgroundColor, font: `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily.split(",")[0]}`, padding: cs.padding, radius: cs.borderRadius, display: cs.display } : {},
    };
  }
  const elOfDraft = () => { try { return S.draft && document.querySelector(S.draft.selector); } catch (_) { return null; } };
  const elOfComment = (c) => { try { return document.querySelector(c.selector); } catch (_) { return null; } };
  function addChat(ctx) {
    if (inFrame) return parent.postMessage({ fb: "chat", ctx }, "*");
    if (!S.chat.ctxs.some((x) => x.selector === ctx.selector)) S.chat.ctxs.push(ctx);
    S.chat.open = true; S.open = false;
    render(true);
  }

  // ---- Export für Figma/Adobe: Element als SVG mit echten Ebenen (Rechtecke und Text), einfügbar mit Strg+V
  function toSvg(el) {
    const root = el.getBoundingClientRect(), out = [];
    const x2 = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const clear = (c) => !c || c === "transparent" || /rgba\(.*,\s*0\)$/.test(c);
    const walk = (e) => {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0 || isFb(e)) return;
      const r = e.getBoundingClientRect(), x = r.left - root.left, y = r.top - root.top;
      const bw = parseFloat(cs.borderTopWidth) || 0;
      if (r.width >= 1 && r.height >= 1 && (!clear(cs.backgroundColor) || (bw && !clear(cs.borderTopColor)))) {
        const rx = parseFloat(cs.borderTopLeftRadius) || 0;
        out.push(`<rect x="${x}" y="${y}" width="${r.width}" height="${r.height}" rx="${Math.min(rx, r.height / 2, r.width / 2)}" fill="${clear(cs.backgroundColor) ? "none" : cs.backgroundColor}"${bw && !clear(cs.borderTopColor) ? ` stroke="${cs.borderTopColor}" stroke-width="${bw}"` : ""} data-name="${x2(e.className && e.className.baseVal === undefined ? String(e.className).slice(0, 30) : e.tagName.toLowerCase())}"/>`);
      }
      if (e.tagName === "svg" || e.tagName === "SVG") {
        out.push(`<svg x="${x}" y="${y}" width="${r.width}" height="${r.height}" viewBox="${e.getAttribute("viewBox") || `0 0 ${r.width} ${r.height}`}" style="color:${cs.color}">${e.innerHTML.replace(/currentColor/g, cs.color)}</svg>`);
        return;
      }
      if (e.tagName === "IMG") out.push(`<image x="${x}" y="${y}" width="${r.width}" height="${r.height}" href="${x2(e.currentSrc || e.src)}"/>`);
      for (const n of e.childNodes) {
        if (n.nodeType === 1) walk(n);
        else if (n.nodeType === 3 && n.textContent.trim()) {
          const lines = [];
          const re = /\S+/g; let m;
          while ((m = re.exec(n.textContent))) {
            const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length);
            const b = rg.getBoundingClientRect();
            if (!b.width) continue;
            const last = lines[lines.length - 1];
            if (last && Math.abs(last.top - b.top) < 3) last.t += " " + m[0]; else lines.push({ top: b.top, left: b.left, h: b.height, t: m[0] });
          }
          const fs = parseFloat(cs.fontSize);
          for (const l of lines) {
            const t = cs.textTransform === "uppercase" ? l.t.toUpperCase() : l.t;
            out.push(`<text x="${l.left - root.left}" y="${l.top - root.top + (l.h + fs * 0.7) / 2}" font-family="${x2(cs.fontFamily.replace(/"/g, "'"))}" font-size="${fs}" font-weight="${cs.fontWeight}" letter-spacing="${parseFloat(cs.letterSpacing) || 0}" fill="${cs.color}">${x2(t)}</text>`);
          }
        }
      }
    };
    walk(el);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${root.width}" height="${root.height}" viewBox="0 0 ${root.width} ${root.height}">${out.join("")}</svg>`;
  }
  async function exportEl(el, download) {
    if (!el) return toast("Element nicht gefunden (anderer Bildschirm?)");
    const svg = toSvg(el);
    if (download) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      a.download = `element-${Date.now().toString(36)}.svg`; a.click();
      return toast("SVG-Datei geladen (in Figma hineinziehen)");
    }
    try { await navigator.clipboard.writeText(svg); toast("SVG kopiert: in Figma mit Strg+V einfügen"); }
    catch (_) { toast("Kopieren blockiert, nimm «SVG-Datei»"); }
  }

  // ---- Diktieren (Spracherkennung des Browsers, Chrome/Edge)
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, wantDict = false;
  const DICT_ERR = {
    "not-allowed": "Mikrofon nicht erlaubt: Schloss in der Adressleiste, Mikrofon auf «Zulassen»",
    "service-not-allowed": "Spracherkennung vom Browser blockiert. Nimm Windows-Diktat: Win+H",
    "audio-capture": "Kein Mikrofon gefunden",
    network: "Die Spracherkennung dieses Browsers ist nicht erreichbar. Nimm stattdessen Windows-Diktat: Win+H drücken, Feld bleibt aktiv",
    "no-speech": "Nichts gehört, sprich näher ans Mikrofon",
  };
  function dictate(targetSel) {
    if (!SR) return toast("Diktieren geht nur in Chrome oder Edge");
    if (rec || wantDict) { wantDict = false; if (rec) rec.stop(); return; }
    if (!root.querySelector(targetSel)) return;
    let lang = "de-CH";
    wantDict = true; S.dictating = targetSel; render(true);
    const start = () => {
      const cur0 = root.querySelector(targetSel);
      if (!cur0) { wantDict = false; S.dictating = ""; return; }
      const base = cur0.value ? cur0.value.replace(/s*$/, " ") : "";
      rec = new SR(); rec.lang = lang; rec.continuous = true; rec.interimResults = true;
      rec.onresult = (e) => {
        let fin = "", interim = "";
        for (let i = 0; i < e.results.length; i++) (e.results[i].isFinal ? (fin += e.results[i][0].transcript) : (interim += e.results[i][0].transcript));
        const cur = root.querySelector(targetSel);
        if (cur) cur.value = base + fin + interim;
      };
      rec.onerror = (e) => {
        if (e.error === "language-not-supported" && lang === "de-CH") { lang = "de-DE"; return; }
        if (e.error === "aborted") return;
        if (e.error !== "no-speech") wantDict = false;
        toast(DICT_ERR[e.error] || "Diktieren: " + e.error);
      };
      rec.onend = () => {
        rec = null;
        if (wantDict) { try { return start(); } catch (_) { wantDict = false; } }
        S.dictating = ""; render(true);
      };
      try { rec.start(); } catch (e) { rec = null; wantDict = false; S.dictating = ""; render(true); toast("Diktieren startet nicht: " + e.message); }
    };
    start();
  }

  // ---- Chat mit Claude über markierte Elemente
  async function sendChat() {
    const ta = root.querySelector("#fb-c");
    const message = ta && ta.value.trim();
    if (!message || S.chat.busy) return;
    const history = [...S.chat.msgs];
    S.chat.msgs.push({ role: "user", text: message });
    S.chat.busy = true; render(true);
    try {
      const r = await fetch(ENDPOINT + "/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, history, contexts: S.chat.ctxs }) });
      const j = await r.json();
      S.chat.msgs.push({ role: "assistant", text: r.ok ? j.reply : "Fehler: " + j.error });
    } catch (e) { S.chat.msgs.push({ role: "assistant", text: "Fehler: " + e.message }); }
    S.chat.busy = false; render(true);
    const box = root.querySelector("#fb-msgs"); if (box) box.scrollTop = box.scrollHeight;
  }

  // ---- Rendern: Overlay nur neu bauen, wenn sich etwas ändert; offener Entwurf behält seinen Text
  let lastKey = "";
  function render(force) {
    S.screen = screenName();
    S.scale = Math.min(1, (innerHeight - 96) / PHONE.h);
    const here = S.list.filter((c) => (c.mode || "desktop") === MODE && c.screen === S.screen);
    const showPins = inFrame || !S.phone;
    const pins = showPins ? here.map((c) => ({ c, p: place(c), n: S.list.indexOf(c) + 1 })).filter((x) => x.p) : [];
    const key = JSON.stringify([S.on, S.open, S.phone, S.scale, S.list.map((c) => c.id), S.screen, S.toast, S.dictating, Object.keys(S.shown).join(), S.chat.open, S.chat.busy, S.chat.msgs.length, S.chat.ctxs.length, S.drag, pins.map((x) => [x.p.x | 0, x.p.y | 0]), !!S.draft]);
    if (!force && key === lastKey) return;
    lastKey = key;
    const keep = [...root.querySelectorAll("textarea")].map((t) => ({ id: t.id, v: t.value, s: t.selectionStart, f: document.activeElement === t }));
    let h = "";
    if (!inFrame && S.phone) {
      h += `<div data-fb style="position:fixed;inset:0;z-index:90;background:#0a0b0f;display:grid;place-items:center">
        <div style="width:${PHONE.w * S.scale}px;height:${PHONE.h * S.scale}px;position:relative">
          <div style="width:${PHONE.w}px;height:${PHONE.h}px;transform:scale(${S.scale});transform-origin:top left;border-radius:40px;overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.09),0 18px 40px rgba(0,0,0,.5);background:#06070a">
            <iframe id="fb-frame" src="/" title="Handy-Ansicht" style="width:${PHONE.w}px;height:${PHONE.h}px;border:0;display:block"></iframe>
          </div></div></div>`;
    }
    h += `<div data-fb style="position:fixed;inset:0;z-index:2147483000;pointer-events:none">`;
    if (S.drag) h += `<div class="fb-box" style="${boxStyle(S.drag)}"></div>`;
    if (S.draft && S.draft.box) h += `<div class="fb-box" style="${boxStyle(S.draft.box)}"></div>`;
    for (const { c, p, n } of pins) {
      const on = !!S.shown[c.id]; // Standard: nur der kleine Punkt, Bereich und Text erst nach Klick auf den Punkt
      if (on && p.box) h += `<div class="fb-box solid" style="${boxStyle(p.box)}"></div>`;
      h += `<button data-fb class="fb-pin ${on ? "sel" : ""}" data-pid="${esc(c.id)}" title="Kommentar ${n} anzeigen" style="left:${p.x - 6}px;top:${p.y - 6}px"></button>`;
      if (on) h += `<div data-fb class="fb-pop" data-pid="${esc(c.id)}" style="left:${Math.max(8, Math.min(p.x + 12, innerWidth - 248))}px;top:${Math.max(8, Math.min(p.y + 12, innerHeight - 120))}px;width:236px;padding:10px;gap:4px"><div class="fb-xs">${n} · ${KIND[c.kind || "point"]}</div><div>${esc(c.text)}</div></div>`;
    }
    if (S.draft) {
      const d = S.draft;
      h += `<div data-fb id="fb-draft" class="fb-pop" style="left:${Math.max(8, Math.min(d.x, innerWidth - 296))}px;top:${Math.max(8, Math.min(d.y + 14, innerHeight - 300))}px;width:280px">
        <div class="fb-xs" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${KIND[d.kind]} · ${esc(d.screen)}: ${esc(d.elementText || d.selector)}</div>
        ${d.kind === "area" ? `<div class="fb-xs">Die Frage gilt für das Innere des Bereichs (${d.contained ? d.contained.length : 0} Elemente).</div>` : ""}
        <textarea id="fb-t" rows="3" placeholder="${d.kind === "area" ? "Was stimmt in diesem Bereich nicht?" : "Was ist hier falsch?"}"></textarea>
        <div class="fb-row" style="flex-wrap:wrap;justify-content:flex-start">
          <button data-fb class="fb-sm ${S.dictating === "#fb-t" ? "rec" : ""}" data-dict="#fb-t">${S.dictating === "#fb-t" ? "● Stopp" : "🎤 Diktieren"}</button>
          <button data-fb class="fb-sm" data-chat-draft>💬 Claude fragen</button>
          <button data-fb class="fb-sm" data-fig-draft>Figma: SVG kopieren</button>
          <button data-fb class="fb-sm" data-svg-draft>SVG-Datei</button></div>
        <div class="fb-row"><button data-fb data-cancel style="color:var(--muted,#9a9ba3);padding:8px 12px">Abbrechen</button><button data-fb data-save style="background:var(--accent,${GOLD});color:var(--on-accent,#16181a);padding:8px 14px;border-radius:10px">Senden <span style="opacity:.6;font-weight:400">Strg+Enter</span></button></div></div>`;
    }
    if (!inFrame && S.open) {
      h += `<div data-fb class="fb-pop" style="right:12px;top:56px;width:300px;max-height:70vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between"><b>Kommentare (${S.list.length})</b><button data-fb data-close style="color:var(--muted,#9a9ba3)">Schliessen</button></div>
        ${S.list.length ? "" : `<div class="fb-xs">Noch keine. «Kommentieren» einschalten: Alt+Klick = Punkt, Rechtsklick = Element, Alt+ziehen = Bereich. Ohne Alt bedienst du die App normal.</div>`}
        ${S.list.map((c, i) => `<div style="background:var(--well,#161922);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:4px">
          <div class="fb-xs">${i + 1} · ${c.mode === "handy" ? "Handy" : "Desktop"} · ${KIND[c.kind || "point"]} · ${esc(c.screen)}</div>
          <div>${esc(c.text)}</div>
          <div class="fb-row"><button data-fb class="fb-sm" data-chat-c="${esc(c.id)}">💬 Claude</button>
          ${(c.mode || "desktop") === MODE ? `<button data-fb class="fb-sm" data-fig-c="${esc(c.id)}">Figma: SVG</button>` : ""}
          <button data-fb data-done="${esc(c.id)}" style="color:var(--accent,${GOLD});margin-left:auto">Erledigt</button></div></div>`).join("")}
        <button data-fb class="fb-sm" data-overview>Übersicht in neuem Tab öffnen</button></div>`;
    }
    if (!inFrame && S.chat.open) {
      h += `<div data-fb class="fb-pop" style="left:12px;bottom:12px;top:56px;width:340px">
        <div style="display:flex;justify-content:space-between"><b>Chat mit Claude</b><span><button data-fb data-chat-clear style="color:var(--muted,#9a9ba3)">Neu</button> <button data-fb data-chat-close style="color:var(--muted,#9a9ba3)">Schliessen</button></span></div>
        <div class="fb-xs">${S.chat.ctxs.length ? "Markiert: " + S.chat.ctxs.map((c, i) => `<span class="fb-chip">${esc((c.text || c.selector).slice(0, 24))} <a data-fb data-ctx-rm="${i}">×</a></span>`).join(" ") : "Noch nichts markiert: «Kommentieren» einschalten, Stelle markieren, «Claude fragen»."} Claude liest nur, ändert nichts.</div>
        <div id="fb-msgs" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px">
          ${S.chat.msgs.map((m) => `<div style="background:${m.role === "user" ? "var(--well,#161922)" : "transparent"};border-radius:10px;padding:${m.role === "user" ? "8px 10px" : "0 4px"};white-space:pre-wrap">${esc(m.text)}</div>`).join("")}
          ${S.chat.busy ? `<div class="fb-xs">Claude liest und denkt nach … (bis 1–2 Minuten)</div>` : ""}</div>
        <textarea id="fb-c" rows="3" placeholder="Frage zu den markierten Elementen … (Strg+Enter sendet)"></textarea>
        <div class="fb-row"><button data-fb class="fb-sm ${S.dictating === "#fb-c" ? "rec" : ""}" data-dict="#fb-c">${S.dictating === "#fb-c" ? "● Stopp" : "🎤 Diktieren"}</button>
          <button data-fb data-chat-send style="background:var(--accent,${GOLD});color:var(--on-accent,#16181a);padding:8px 14px;border-radius:10px;opacity:${S.chat.busy ? 0.4 : 1}">Senden</button></div></div>`;
    }
    if (S.toast) h += `<div data-fb class="fb-pop" style="left:50%;bottom:20px;transform:translateX(-50%);padding:10px 16px;max-width:calc(100vw - 24px);width:max-content">${esc(S.toast)}</div>`;
    if (!inFrame) {
      h += `<div data-fb style="position:fixed;right:12px;top:12px;display:flex;gap:8px;pointer-events:auto">
        <button data-fb class="fb-pill ${S.chat.open ? "on" : ""}" data-chat-toggle>💬 Chat</button>
        <button data-fb class="fb-pill" data-list>${S.list.length} Kommentare</button>
        <button data-fb class="fb-pill ${S.phone ? "on" : ""}" data-phone>${S.phone ? "Handy: an" : "Handy"}</button>
        <button data-fb class="fb-pill ${S.on ? "on" : ""}" data-toggle>${S.on ? "Kommentieren: an (Alt+Klick)" : "Kommentieren"}</button></div>`;
    }
    h += `</div>`;
    root.innerHTML = h;
    const f = root.querySelector("#fb-frame");
    if (f) f.addEventListener("load", () => f.contentWindow.postMessage({ fb: "mode", on: S.on }, "*"));
    const dp = root.querySelector("#fb-draft");
    if (dp) {
      dp.style.maxHeight = innerHeight - 16 + "px"; dp.style.overflowY = "auto";
      const r = dp.getBoundingClientRect();
      dp.style.top = Math.max(8, Math.min(r.top, innerHeight - r.height - 8)) + "px";
    }
    let focused = false;
    for (const t of root.querySelectorAll("textarea")) {
      const k = keep.find((x) => x.id === t.id);
      if (k) { t.value = k.v; t.setSelectionRange(k.s, k.s); if (k.f) { t.focus(); focused = true; } }
    }
    const mb = root.querySelector("#fb-msgs"); if (mb) mb.scrollTop = mb.scrollHeight;
    if (!focused && S.draft && !keep.length) root.querySelector("#fb-t")?.focus();
  }

  // ---- Aktionen
  const toggle = (next) => {
    S.on = next; S.draft = null;
    const f = root.querySelector("#fb-frame");
    if (f && f.contentWindow) f.contentWindow.postMessage({ fb: "mode", on: next }, "*");
    render(true);
  };
  const openDraft = (d) => { S.draft = d; render(true); };
  const save = async () => {
    const ta = root.querySelector("#fb-t");
    if (!S.draft || !ta || !ta.value.trim()) return;
    const { x, y, box, ...rest } = S.draft;
    const text = ta.value.trim();
    S.draft = null;
    S.list = await api("POST", { ...rest, id: "c" + Date.now().toString(36), text, at: new Date().toISOString() });
    render(true);
  };
  root.addEventListener("click", async (e) => {
    const pop = e.target.closest(".fb-pop[data-pid]");
    if (pop) { delete S.shown[pop.dataset.pid]; render(true); return; } // Klick auf die Sprechblase blendet sie wieder aus
    const t = e.target.closest("button");
    if (!t) return;
    e.stopPropagation();
    if (t.dataset.pid) { if (S.shown[t.dataset.pid]) delete S.shown[t.dataset.pid]; else S.shown[t.dataset.pid] = 1; render(true); }
    else if (t.hasAttribute("data-toggle")) toggle(!S.on);
    else if (t.hasAttribute("data-phone")) {
      S.phone = !S.phone; S.draft = null;
      try { localStorage.setItem("fb.phone", S.phone ? "1" : "0"); } catch (_) {}
      document.documentElement.style.overflow = S.phone ? "hidden" : "";
      render(true);
    } else if (t.hasAttribute("data-list")) { S.open = !S.open; render(true); }
    
    else if (t.hasAttribute("data-close")) { S.open = false; render(true); }
    else if (t.hasAttribute("data-cancel")) { S.draft = null; render(true); }
    else if (t.hasAttribute("data-save")) save();
    else if (t.dataset.dict) dictate(t.dataset.dict);
    else if (t.hasAttribute("data-chat-draft")) { const el = elOfDraft(); if (el) addChat({ ...ctxOf(el), comment: root.querySelector("#fb-t")?.value || "" }); else toast("Element nicht gefunden"); }
    else if (t.hasAttribute("data-fig-draft")) exportEl(elOfDraft(), false);
    else if (t.hasAttribute("data-svg-draft")) exportEl(elOfDraft(), true);
    else if (t.dataset.chatC) { const c = S.list.find((x) => x.id === t.dataset.chatC); if (c) addChat(ctxOf(elOfComment(c), c)); }
    else if (t.dataset.figC) { const c = S.list.find((x) => x.id === t.dataset.figC); exportEl(c && elOfComment(c), false); }
    else if (t.hasAttribute("data-test-open")) window.open("http://localhost:8081/", "_blank");
    else if (t.hasAttribute("data-overview")) window.open("/src/dev/uebersicht.html", "_blank");
    else if (t.hasAttribute("data-chat-toggle")) { S.chat.open = !S.chat.open; render(true); }
    else if (t.hasAttribute("data-chat-close")) { S.chat.open = false; render(true); }
    else if (t.hasAttribute("data-chat-clear")) { S.chat.msgs = []; S.chat.ctxs = []; render(true); }
    else if (t.hasAttribute("data-chat-send")) sendChat();
    else if (t.dataset.done) { S.list = await api("DELETE", { id: t.dataset.done }); render(true); }
  });
  root.addEventListener("keydown", (e) => {
    if (e.target.tagName !== "TEXTAREA") return;
    const chat = e.target.id === "fb-c";
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) chat ? sendChat() : save();
    if (e.key === "Escape" && !chat) { S.draft = null; render(true); }
  });
  document.addEventListener("keydown", (e) => {
    if (S.draft && e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
  }, true);
  // Chip im Chat entfernen
  root.addEventListener("click", (e) => {
    const a = e.target.closest("[data-ctx-rm]");
    if (a) { S.chat.ctxs.splice(+a.dataset.ctxRm, 1); render(true); }
  });
  document.documentElement.style.overflow = S.phone ? "hidden" : "";

  if (inFrame) window.addEventListener("message", (e) => { if (e.data && e.data.fb === "mode") toggle(!!e.data.on); });
  else window.addEventListener("message", (e) => { if (e.data && e.data.fb === "chat") addChat(e.data.ctx); });

  // ---- Auswahl auf der Seite
  let start = null, dragged = false;
  const picking = () => S.on && (inFrame || !S.phone);
  document.addEventListener("mousedown", (e) => {
    if (!picking() || e.button !== 0 || !e.altKey || isFb(e.target)) return;
    e.preventDefault(); start = { x: e.clientX, y: e.clientY }; dragged = false;
  }, true);
  document.addEventListener("mousemove", (e) => {
    if (!start) return;
    const w = e.clientX - start.x, h = e.clientY - start.y;
    if (!dragged && Math.hypot(w, h) < 8) return;
    dragged = true;
    S.drag = { x: Math.min(start.x, e.clientX), y: Math.min(start.y, e.clientY), w: Math.abs(w), h: Math.abs(h) };
    render();
  }, true);
  document.addEventListener("mouseup", (e) => {
    if (!start) return;
    const s = start; start = null;
    if (!dragged) return;
    e.preventDefault();
    S.drag = null;
    const b = { x: Math.min(s.x, e.clientX), y: Math.min(s.y, e.clientY), w: Math.abs(e.clientX - s.x), h: Math.abs(e.clientY - s.y) };
    if (b.w < 12 || b.h < 12) return render(true);
    const anc = ancestorOf(b), r = anc.getBoundingClientRect();
    openDraft({ ...base(), kind: "area", selector: selectorOf(anc), elementText: textOf(anc),
      rx: r.width ? (b.x - r.left) / r.width : 0, ry: r.height ? (b.y - r.top) / r.height : 0,
      rw: r.width ? b.w / r.width : 1, rh: r.height ? b.h / r.height : 1,
      contained: containedIn(b), x: b.x + b.w, y: b.y + b.h, box: b });
  }, true);
  document.addEventListener("click", (e) => {
    if (!picking() || isFb(e.target)) return;
    if (dragged) { dragged = false; e.preventDefault(); e.stopPropagation(); return; }
    if (!e.altKey) return; // ohne Alt bedient man die App ganz normal
    e.preventDefault(); e.stopPropagation();
    const t = inLayer(e.target), r = t.getBoundingClientRect();
    openDraft({ ...base(), kind: "point", selector: selectorOf(t), elementText: textOf(t),
      rx: r.width ? (e.clientX - r.left) / r.width : 0.5, ry: r.height ? (e.clientY - r.top) / r.height : 0.5, x: e.clientX, y: e.clientY });
  }, true);
  document.addEventListener("contextmenu", (e) => {
    if (!picking() || isFb(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    const t = inLayer(e.target), r = t.getBoundingClientRect();
    openDraft({ ...base(), kind: "element", selector: selectorOf(t), elementText: textOf(t), rx: 0, ry: 0, rw: 1, rh: 1,
      x: r.right, y: r.bottom, box: { x: r.left, y: r.top, w: r.width, h: r.height } });
  }, true);

  // Fadenkreuz nur, solange Alt gedrückt ist
  const cross = (e) => { document.body.style.cursor = picking() && e.altKey ? "crosshair" : ""; };
  document.addEventListener("keydown", cross, true);
  document.addEventListener("keyup", cross, true);
  addEventListener("blur", () => { document.body.style.cursor = ""; });

  const load = () => api("GET").then((l) => { if (JSON.stringify(l) !== JSON.stringify(S.list)) { S.list = l; render(true); } }).catch(() => {});
  setInterval(load, 1200);
  setInterval(() => render(), 400);
  addEventListener("scroll", () => render(), true);
  addEventListener("resize", () => render(true));
  load(); render(true);
})();
