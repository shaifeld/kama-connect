// מושך תנועות מהבנקים, מצפין במפתח הציבורי ושומר. לא מדפיס תנועות, פרטי כניסה או קודים.
// קוד SMS: בריצה ידנית מהדף (KAMA_INTERACTIVE) מבקשים את הקוד מהדף דרך המאגר, מוצפן במפתח חד-פעמי.
// אחרי כניסה מוצלחת נשמר אסימון כניסה מוצפן (data/state.enc) כדי לדלג על SMS בריצות הבאות.
import fs from "fs";
import { execSync } from "child_process";
import { createScraper } from "@sergienko4/israeli-bank-scrapers";
import sodium from "libsodium-wrappers";
await sodium.ready;
const B = sodium.base64_variants.ORIGINAL;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const git = (c) => execSync(c, { stdio: "ignore" });
const push = (msg) => { git("git add -A kama data status.json"); try { git(`git commit -q -m "${msg}"`); } catch {} try { git("git pull -q --rebase"); } catch {} git("git push -q"); };
const pk = sodium.from_base64(fs.readFileSync("kama/public.key", "utf8").trim(), B);
const SK = process.env.KAMA_STATE_KEY ? sodium.from_base64(process.env.KAMA_STATE_KEY.trim(), B) : null;
const INTERACTIVE = process.env.KAMA_INTERACTIVE === "true";
// ניקוי שאריות קוד SMS מריצה קודמת שנקטעה
for (const f of ["kama/otp.enc", "kama/otp-request.json"]) { try { fs.rmSync(f); } catch {} }
let state = {};
try { if (SK && fs.existsSync("data/state.enc")) { const raw = sodium.from_base64(fs.readFileSync("data/state.enc", "utf8").trim(), B); state = JSON.parse(sodium.to_string(sodium.crypto_secretbox_open_easy(raw.slice(24), raw.slice(0, 24), SK))); } } catch { state = {}; }

async function askOtp(companyId, hint) {
  if (!INTERACTIVE) throw new Error("OTP_NEEDED");
  const kp = sodium.crypto_box_keypair();
  fs.mkdirSync("kama", { recursive: true });
  try { fs.rmSync("kama/otp.enc"); } catch {}
  fs.writeFileSync("kama/otp-request.json", JSON.stringify({ companyId, hint: String(hint || "").slice(-4), pk: sodium.to_base64(kp.publicKey, B), at: Date.now() }));
  push("otp request");
  const end = Date.now() + 5 * 60e3;
  while (Date.now() < end) {
    await sleep(5000);
    try { git("git pull -q --rebase"); } catch {}
    if (fs.existsSync("kama/otp.enc")) {
      const code = sodium.to_string(sodium.crypto_box_seal_open(sodium.from_base64(fs.readFileSync("kama/otp.enc", "utf8").trim(), B), kp.publicKey, kp.privateKey)).trim();
      fs.rmSync("kama/otp.enc"); fs.rmSync("kama/otp-request.json");
      push("otp used");
      return code;
    }
  }
  try { fs.rmSync("kama/otp-request.json"); push("otp timeout"); } catch {}
  throw new Error("OTP_TIMEOUT");
}

const accs = Object.entries(process.env).filter(([k, v]) => k.startsWith("KAMA_ACC_") && v);
const start = new Date(Date.now() - 60 * 864e5);
const out = { at: new Date().toISOString(), accounts: [] };
const status = { at: out.at, ok: true, banks: {} };
const msg = (t) => ({ INVALID_PASSWORD: "סיסמה שגויה — לעדכן בדף החיבור", CHANGE_PASSWORD: "הבנק מבקש להחליף סיסמה", INVALID_OTP: "קוד SMS שגוי או שפג תוקפו — לנסות שוב מהדף", TIMEOUT: "הבנק לא ענה בזמן", TWO_FACTOR_RETRIEVER_MISSING: "צריך קוד SMS — להיכנס לדף החיבור וללחוץ 'משיכה עכשיו'" }[t] || "נכשל (" + (t || "לא ידוע") + ")");
for (const [, v] of accs) {
  let cfg; try { cfg = JSON.parse(v); } catch { status.ok = false; continue; }
  const { companyId, ...creds } = cfg;
  if (state[companyId]) creds.otpLongTermToken = state[companyId];
  let otpErr = "";
  const otpCodeRetriever = async (hint) => { try { return await askOtp(companyId, hint); } catch (e) { otpErr = e.message; throw e; } finally { for (const f of ["kama/otp.enc", "kama/otp-request.json"]) { try { fs.rmSync(f); } catch {} } } };
  try {
    const full = process.env.KAMA_FULL === "true" || !state["full:" + companyId]; // פעם ראשונה לכל בנק: שנה אחורה
    const sc = createScraper({ companyId, startDate: full ? new Date(Date.now() - 365 * 864e5) : start, otpCodeRetriever });
    const r = await sc.scrape({ ...creds, otpCodeRetriever });
    if (r.success) {
      out.accounts.push({ companyId, accounts: r.accounts });
      if (r.persistentOtpToken) state[companyId] = r.persistentOtpToken;
      state["full:" + companyId] = 1;
      status.banks[companyId] = "תקין";
    } else {
      status.ok = false;
      status.banks[companyId] = otpErr === "OTP_NEEDED" ? msg("TWO_FACTOR_RETRIEVER_MISSING") : otpErr === "OTP_TIMEOUT" ? "לא הוקלד קוד SMS בזמן — לנסות שוב מהדף" : msg(r.errorType);
    }
  } catch (e) {
    status.ok = false;
    status.banks[companyId] = otpErr === "OTP_NEEDED" ? msg("TWO_FACTOR_RETRIEVER_MISSING") : "נכשל (שגיאה בהרצה)";
  }
}
fs.mkdirSync("data", { recursive: true });
if (out.accounts.length || !fs.existsSync("data/txns.enc")) fs.writeFileSync("data/txns.enc", sodium.to_base64(sodium.crypto_box_seal(sodium.from_string(JSON.stringify(out)), pk), B));
if (SK) { const n = sodium.randombytes_buf(24); const c = sodium.crypto_secretbox_easy(sodium.from_string(JSON.stringify(state)), n, SK); const all = new Uint8Array(24 + c.length); all.set(n); all.set(c, 24); fs.writeFileSync("data/state.enc", sodium.to_base64(all, B)); }
fs.writeFileSync("data/pulse.txt", out.at);
fs.writeFileSync("status.json", JSON.stringify(status, null, 1));
push("sync");
console.log("done", accs.length, "banks");
process.exit(0);
