"use strict";
// דף ההקמה לחיבור בנק. הכל בדפדפן; סיסמאות הבנק מוצפנות כאן לפני שהן יוצאות, ורק לגיטהאב.
(function () {
  if (window.top !== window.self) { document.body.innerHTML = ""; return; }
  const API = "https://api.github.com";
  const REPO = "kama-data";
  const BANKS = {
    hapoalim: ["בנק הפועלים", { userCode: "קוד משתמש", password: "סיסמה" }],
    leumi: ["בנק לאומי", { username: "שם משתמש", password: "סיסמה" }],
    discount: ["בנק דיסקונט", { id: "תעודת זהות", password: "סיסמה", num: "קוד מזהה" }],
    mizrahi: ["מזרחי טפחות", { username: "שם משתמש", password: "סיסמה" }],
    mercantile: ["מרכנתיל", { id: "תעודת זהות", password: "סיסמה", num: "קוד מזהה" }],
    otsarHahayal: ["אוצר החייל", { username: "שם משתמש", password: "סיסמה" }],
    beinleumi: ["הבינלאומי", { username: "שם משתמש", password: "סיסמה" }],
    massad: ["מסד", { username: "שם משתמש", password: "סיסמה" }],
    pagi: ["פאגי", { username: "שם משתמש", password: "סיסמה" }],
    yahav: ["בנק יהב", { username: "שם משתמש", nationalID: "תעודת זהות", password: "סיסמה" }],
    max: ["מקס", { username: "שם משתמש", password: "סיסמה" }],
    visaCal: ["כאל", { username: "שם משתמש", password: "סיסמה" }],
    isracard: ["ישראכרט", { id: "תעודת זהות", card6Digits: "6 ספרות של הכרטיס", password: "סיסמה" }],
    amex: ["אמריקן אקספרס", { id: "תעודת זהות", card6Digits: "6 ספרות של הכרטיס", password: "סיסמה" }],
  };
  const S = { cfg: null, token: null, login: null, priv: null, isNew: false, banks: [] };
  const $ = (id) => document.getElementById(id);
  const app = $("app");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function view(step, html) {
    app.innerHTML = `<h1>חיבור בנק</h1><div class="steps">${[1, 2, 3, 4].map((i) => `<i class="${i <= step ? "on" : ""}"></i>`).join("")}</div>${html}`;
  }
  function fail(msg) {
    view(0, `<div class="card"><p class="err">${esc(msg)}</p><button id="again">להתחיל מחדש</button></div>`);
    $("again").onclick = () => location.replace(S.cfg.redirect_uri);
  }
  async function gh(path, opt = {}) {
    const r = await fetch(API + path, { ...opt, headers: { Authorization: "Bearer " + S.token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(opt.body ? { "Content-Type": "application/json" } : {}) } });
    if (r.status === 204) return {};
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.message || "github " + r.status); e.status = r.status; throw e; }
    return j;
  }
  const b64 = (s) => btoa(unescape(encodeURIComponent(s)));
  async function putFile(path, text, msg) {
    let sha;
    try { sha = (await gh(`/repos/${S.login}/${REPO}/contents/${path}`)).sha; } catch (e) { if (e.status !== 404) throw e; }
    await gh(`/repos/${S.login}/${REPO}/contents/${path}`, { method: "PUT", body: JSON.stringify({ message: msg, content: b64(text), ...(sha ? { sha } : {}) }) });
  }
  async function fileExists(path) {
    try { await gh(`/repos/${S.login}/${REPO}/contents/${path}`); return true; } catch (e) { if (e.status === 404) return false; throw e; }
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // מאגר חדש לפעמים לא מוכן מיד — ניסיון חוזר עם השהיה
  async function retry(fn, n = 6) { for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= n - 1 || ![404, 409, 422, 500, 502].includes(e.status)) throw e; await sleep(1500 * (i + 1)); } } }

  // שלב 1: כניסה לגיטהאב
  function step1() {
    view(1, `<div class="card"><b>מה קורה כאן</b><ul class="muted">
<li>נפתח לך מאגר פרטי בגיטהאב, על שמך בלבד.</li>
<li>פעם ביום הוא מושך את התנועות מהבנק, מצפין אותן ושומר.</li>
<li>הסיסמאות מוצפנות כאן בדפדפן לפני שהן יוצאות.</li>
<li>אף אחד חוץ ממך, גם לא בעל האפליקציה, לא רואה אותן.</li></ul>
<button id="go">להתחבר לגיטהאב</button><p class="muted">אין לך חשבון? אפשר לפתוח בחינם במסך הבא.</p></div>`);
    $("go").onclick = () => {
      const st = sodium.to_hex(sodium.randombytes_buf(24));
      sessionStorage.setItem("kst", st);
      // גיבוי למקרה שהחזרה מגיטהאב נפתחת בלשונית אחרת (אפליקציית גיטהאב/אימות דו-שלבי); נמחק מיד בחזרה, תוקף 10 דקות
      try { localStorage.setItem("kst", JSON.stringify({ st, at: Date.now() })); } catch (e) {}
      const u = new URL("https://github.com/login/oauth/authorize");
      u.searchParams.set("client_id", S.cfg.client_id);
      u.searchParams.set("redirect_uri", S.cfg.redirect_uri);
      u.searchParams.set("scope", "repo workflow");
      u.searchParams.set("state", st);
      location.assign(u.toString());
    };
  }

  // חזרה מגיטהאב: בדיקת state והחלפת קוד במפתח
  async function back(code, state) {
    history.replaceState(null, "", location.pathname);
    let st = sessionStorage.getItem("kst");
    sessionStorage.removeItem("kst");
    try { const L = JSON.parse(localStorage.getItem("kst") || "null"); localStorage.removeItem("kst"); if (!st && L && Date.now() - L.at < 600000) st = L.st; } catch (e) {}
    if (!st || st !== state) return fail("הכניסה לא אומתה. נסה שוב.");
    view(1, `<div class="card"><p>מתחבר…</p></div>`);
    let j;
    try {
      const ac = new AbortController(); setTimeout(() => ac.abort(), 20000);
      const r = await fetch(S.cfg.worker_url, { signal: ac.signal, method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      j = await r.json();
      if (!r.ok || !j.access_token) throw new Error(j.error || "exchange");
    } catch (e) { return fail("החיבור לגיטהאב נכשל (" + (e.name === "AbortError" ? "השרת לא ענה" : e.message) + "). נסה שוב."); }
    const sc = (j.scope || "").split(/[ ,]+/);
    if (!sc.includes("repo") || !sc.includes("workflow")) return fail("גיטהאב לא נתן את כל ההרשאות הנדרשות. נסה שוב ואשר את כולן.");
    S.token = j.access_token;
    try { await step2(); } catch (e) { fail("שגיאה בהכנת המאגר: " + e.message); }
  }

  // שלב 2: מאגר פרטי + מפתחות
  async function step2() {
    view(2, `<div class="card"><p>מכין את המאגר הפרטי…</p></div>`);
    S.login = (await gh("/user")).login;
    let repo;
    try { repo = await gh(`/repos/${S.login}/${REPO}`); } catch (e) { if (e.status !== 404) throw e; }
    if (repo && !repo.private) return fail(`המאגר ${REPO} קיים אצלך והוא ציבורי. מטעמי אבטחה לא ממשיכים. הפוך אותו לפרטי או מחק אותו, ונסה שוב.`);
    if (!repo) {
      await gh("/user/repos", { method: "POST", body: JSON.stringify({ name: REPO, private: true, auto_init: true, description: "נתוני כמה ע'ני עשיר (מוצפן)" }) });
      await retry(() => gh(`/repos/${S.login}/${REPO}/contents/README.md`));
    }
    S.isNew = !(await fileExists("kama/public.key"));
    if (S.isNew) {
      const kp = sodium.crypto_box_keypair();
      S.priv = sodium.to_base64(kp.privateKey, sodium.base64_variants.ORIGINAL);
      await retry(() => putFile("kama/public.key", sodium.to_base64(kp.publicKey, sodium.base64_variants.ORIGINAL), "public key"));
    }
    step3();
  }

  // שלב 3: פרטי בנק — מוצפנים כאן ונשמרים כסוד במאגר
  function step3(msg) {
    const opts = Object.entries(BANKS).map(([k, v]) => `<option value="${k}">${esc(v[0])}</option>`).join("");
    view(3, `<div class="card"><b>${S.isNew ? "הוספת בנק או כרטיס" : "עדכון סיסמה או הוספת בנק"}</b>
${msg ? `<p class="ok">${esc(msg)}</p>` : ""}
<label>בנק או חברת אשראי<select id="bank">${opts}</select></label><div id="flds"></div>
<button id="save">להצפין ולשמור</button>
${S.banks.length ? `<button class="ghost" id="done">סיימתי להוסיף</button>` : ""}
<div id="have"></div>
${S.isNew ? "" : `<label class="gap"><input type="checkbox" id="regen" ${S.regen ? "checked" : ""}> ליצור מפתח חדש לאפליקציה (אם הקוד מהפעם הקודמת לא הועבר לאפליקציה)</label>`}
<p class="muted">הסיסמה מוצפנת במפתח של המאגר שלך, ואי אפשר לקרוא אותה חזרה גם מגיטהאב.</p></div>`);
    const draw = () => {
      $("flds").innerHTML = Object.entries(BANKS[$("bank").value][1]).map(([f, l]) =>
        `<label>${esc(l)}<input id="f_${f}" type="${f === "password" ? "password" : "text"}" autocomplete="off" autocapitalize="off" spellcheck="false" ${/id|num|Digits|nationalID/.test(f) ? 'inputmode="numeric"' : ""}></label>`).join("");
    };
    $("bank").onchange = draw; draw();
    listHave();
    if ($("regen")) $("regen").onchange = (e) => { S.regen = e.target.checked; };
    $("save").onclick = saveBank;
    if ($("done")) $("done").onclick = () => step4().catch((e) => fail("שגיאה בהפעלה: " + e.message));
  }
  // בנקים שכבר שמורים במאגר — אפשר להסיר (למשל בנק שדורש קוד חד-פעמי)
  async function listHave() {
    let names = [];
    try { names = ((await gh(`/repos/${S.login}/${REPO}/actions/secrets?per_page=100`)).secrets || []).map((x) => x.name).filter((n) => n.startsWith("KAMA_ACC_")); } catch (e) { return; }
    for (const n of names) { const id = Object.keys(BANKS).find((k) => "KAMA_ACC_" + k.toUpperCase() === n); if (id && !S.banks.includes(id)) S.banks.push(id); }
    if (!$("have")) return;
    $("have").innerHTML = names.length ? `<p class="muted gap">שמורים אצלך:</p>` + names.map((n) => { const id = Object.keys(BANKS).find((k) => "KAMA_ACC_" + k.toUpperCase() === n); return `<button class="ghost" data-del="${esc(n)}">להסיר: ${esc(id ? BANKS[id][0] : n)}</button>`; }).join("") : "";
    if (S.banks.length && !$("done")) { const d = document.createElement("button"); d.className = "ghost"; d.id = "done"; d.textContent = "סיימתי להוסיף"; $("save").after(d); d.onclick = () => step4().catch((e) => fail("שגיאה בהפעלה: " + e.message)); }
    $("have").querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => {
      if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "ללחוץ שוב לאישור ההסרה"; return; }
      b.disabled = true;
      try { await gh(`/repos/${S.login}/${REPO}/actions/secrets/${b.dataset.del}`, { method: "DELETE" }); S.banks = S.banks.filter((k) => "KAMA_ACC_" + k.toUpperCase() !== b.dataset.del); step3("הוסר."); } catch (e) { b.disabled = false; alert("ההסרה נכשלה: " + e.message); }
    });
  }
  async function saveBank() {
    const id = $("bank").value, creds = { companyId: id };
    for (const f of Object.keys(BANKS[id][1])) {
      const v = $("f_" + f).value.trim();
      if (!v) { $("f_" + f).focus(); return; }
      creds[f] = v;
    }
    $("save").disabled = true; $("save").textContent = "מצפין…";
    try {
      const k = await retry(() => gh(`/repos/${S.login}/${REPO}/actions/secrets/public-key`));
      const sealed = sodium.crypto_box_seal(sodium.from_string(JSON.stringify(creds)), sodium.from_base64(k.key, sodium.base64_variants.ORIGINAL));
      await retry(() => gh(`/repos/${S.login}/${REPO}/actions/secrets/KAMA_ACC_${id.toUpperCase()}`, { method: "PUT", body: JSON.stringify({ encrypted_value: sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL), key_id: k.key_id }) }));
      for (const f of Object.keys(creds)) creds[f] = "";
      if (!S.banks.includes(id)) S.banks.push(id);
      step3(`${BANKS[id][0]} נשמר. אפשר להוסיף עוד, או ללחוץ "סיימתי להוסיף".`);
    } catch (e) { $("save").disabled = false; $("save").textContent = "להצפין ולשמור"; alert("השמירה נכשלה: " + e.message); }
  }

  // שלב 4: משימה יומית, ריצה ראשונה, והעברה לאפליקציה
  async function step4() {
    view(4, `<div class="card"><p>מגדיר משיכה יומית…</p></div>`);
    if (S.regen && !S.priv) {
      const kp = sodium.crypto_box_keypair();
      S.priv = sodium.to_base64(kp.privateKey, sodium.base64_variants.ORIGINAL);
      await retry(() => putFile("kama/public.key", sodium.to_base64(kp.publicKey, sodium.base64_variants.ORIGINAL), "new public key"));
    }
    const [yml, run, pkg, lock] = await Promise.all(["tpl/kama.yml", "tpl/run.mjs", "tpl/package.json", "tpl/package-lock.json"].map((p) => fetch(p, { cache: "no-store" }).then((r) => r.text())));
    const envs = Object.keys(BANKS).map((k) => `          KAMA_ACC_${k.toUpperCase()}: \${{ secrets.KAMA_ACC_${k.toUpperCase()} }}`).join("\n");
    const rnd = sodium.randombytes_buf(2);
    const cron = `${rnd[0] % 60} ${2 + (rnd[1] % 4)} * * *`;
    await retry(() => putFile("kama/run.mjs", run, "sync script"));
    await retry(() => putFile("kama/package.json", pkg, "deps"));
    await retry(() => putFile("kama/package-lock.json", lock, "deps lock"));
    await putFile(".github/workflows/kama.yml", yml.replace("__CRON__", cron).replace("__ENVS__", envs), "daily sync");
    // מפתח לשמירת אסימון הכניסה בין ריצות (כדי שהבנק לא יבקש SMS כל לילה) — נוצר פעם אחת
    const have = ((await gh(`/repos/${S.login}/${REPO}/actions/secrets?per_page=100`)).secrets || []).map((x) => x.name);
    if (!have.includes("KAMA_STATE_KEY")) {
      const k = await retry(() => gh(`/repos/${S.login}/${REPO}/actions/secrets/public-key`));
      const sk = sodium.to_base64(sodium.randombytes_buf(32), sodium.base64_variants.ORIGINAL);
      const sealed = sodium.crypto_box_seal(sodium.from_string(sk), sodium.from_base64(k.key, sodium.base64_variants.ORIGINAL));
      await retry(() => gh(`/repos/${S.login}/${REPO}/actions/secrets/KAMA_STATE_KEY`, { method: "PUT", body: JSON.stringify({ encrypted_value: sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL), key_id: k.key_id }) }));
    }
    await sleep(1500);
    const t0 = Date.now();
    let started = false;
    try { await retry(() => gh(`/repos/${S.login}/${REPO}/actions/workflows/kama.yml/dispatches`, { method: "POST", body: JSON.stringify({ ref: "main", inputs: { interactive: "true" } }) }), 8); started = true; } catch (e) { /* ריצה ראשונה תקרה בזמן הקבוע */ }
    const pack = JSON.stringify({ v: 1, r: `${S.login}/${REPO}`, t: S.token, k: S.priv || "" });
    const code = "KAMA1." + sodium.to_base64(sodium.from_string(pack), sodium.base64_variants.URLSAFE_NO_PADDING);
    const q = qrcode(0, "L"); q.addData(code); q.make();
    view(4, `<div class="card"><b class="ok">החיבור מוכן ✓</b>
<p class="muted">המשיכה הראשונה רצה עכשיו ולוקחת כמה דקות.</p>
${S.priv ? "" : `<p class="muted">המפתח הקיים נשמר. באפליקציה לא צריך לעשות כלום.</p>`}
<div id="live" class="card"><p>${started ? "המשיכה רצה עכשיו. אם הבנק ישלח קוד SMS, תופיע כאן תיבה להקליד אותו." : "המשיכה תרוץ בלילה."}</p></div>
<b>להעביר לאפליקציה</b><p class="muted">באפליקציה: תפריט ← חיבור בנק ← "הדבקת קוד" או "סריקה".</p>
<div id="qr">${q.createImgTag(4, 8)}</div>
<button id="cp">להעתיק קוד</button>
<button class="ghost" id="fin">סיימתי — למחוק מהדף</button>
<p class="muted">הקוד הזה הוא המפתח לנתונים שלך. לא לשלוח אותו לאף אחד.</p></div>`);
    $("cp").onclick = async () => { try { await navigator.clipboard.writeText(code); $("cp").textContent = "הועתק ✓"; } catch (e) { prompt("להעתיק:", code); } };
    if (started) watchRun(t0);
    $("fin").onclick = () => { S.live = false; S.token = S.priv = null; app.innerHTML = `<h1>חיבור בנק</h1><div class="card"><p>הנתונים נמחקו מהדף. אפשר לסגור.</p></div>`; };
  }

  // מעקב אחרי הריצה: מציג תיבה לקוד SMS כשהבנק מבקש, ואת התוצאה בסוף
  async function getFile(path) { try { const j = await gh(`/repos/${S.login}/${REPO}/contents/${path}?t=${Date.now()}`); return decodeURIComponent(escape(atob(j.content.replace(/\n/g, "")))); } catch (e) { return null; } }
  async function watchRun(t0) {
    S.live = true; let asked = 0;
    const live = (h) => { if ($("live")) $("live").innerHTML = h; };
    while (S.live && Date.now() - t0 < 15 * 60e3) {
      await sleep(4000);
      const req = await getFile("kama/otp-request.json");
      if (req) {
        let r; try { r = JSON.parse(req); } catch (e) { r = null; }
        if (r && r.at > t0 && Date.now() - r.at < 5 * 60e3 && r.at !== asked) {
          asked = r.at;
          live(`<b>הבנק שלח קוד SMS${r.hint ? " למספר שמסתיים ב-" + esc(r.hint) : ""}</b><label>להקליד את הקוד כאן<input id="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="10"></label><button id="otpGo">לשלוח את הקוד</button><p class="muted">יש 5 דקות. הקוד מוצפן ונמחק מיד אחרי שימוש.</p>`);
          await new Promise((res) => { $("otpGo").onclick = async () => {
            const v = $("otp").value.trim(); if (!/^\d{4,10}$/.test(v)) { $("otp").focus(); return; }
            $("otpGo").disabled = true;
            try { const sealed = sodium.crypto_box_seal(sodium.from_string(v), sodium.from_base64(r.pk, sodium.base64_variants.ORIGINAL)); await putFile("kama/otp.enc", sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL), "otp"); live("<p>הקוד נשלח. ממשיך למשוך…</p>"); } catch (e) { live('<p class="err">שליחת הקוד נכשלה. לנסות שוב בעוד רגע.</p>'); asked = 0; }
            res();
          }; });
          continue;
        }
      }
      const st = await getFile("status.json");
      if (st) { let j; try { j = JSON.parse(st); } catch (e) { j = null; }
        if (j && Date.parse(j.at) > t0 - 60e3) { live(`<b>${j.ok ? '<span class="ok">המשיכה הצליחה ✓</span>' : '<span class="err">המשיכה הסתיימה עם בעיה</span>'}</b>` + Object.entries(j.banks || {}).map(([k, v]) => `<p>${esc(BANKS[k] ? BANKS[k][0] : k)}: ${esc(v)}</p>`).join("")); return; } }
    }
  }

  (async function init() {
    if (location.protocol !== "https:" && location.hostname !== "localhost") { app.innerHTML = "<p>הדף עובד רק בחיבור מאובטח.</p>"; return; }
    try {
      await sodium.ready;
      S.cfg = await (await fetch("config.json", { cache: "no-store" })).json();
    } catch (e) { app.innerHTML = '<p class="err">הדף לא נטען. רענן ונסה שוב.</p>'; return; }
    const p = new URLSearchParams(location.search);
    if (p.get("error")) { history.replaceState(null, "", location.pathname); return fail("הכניסה לגיטהאב בוטלה."); }
    if (p.get("code")) return back(p.get("code"), p.get("state"));
    step1();
  })();
})();
