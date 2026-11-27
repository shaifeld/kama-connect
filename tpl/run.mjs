// מושך תנועות מהבנקים, מצפין במפתח הציבורי, ושומר. לא מדפיס תנועות או פרטי כניסה.
import fs from "fs";
import { createScraper } from "israeli-bank-scrapers";
import sodium from "libsodium-wrappers";
await sodium.ready;
const pk = sodium.from_base64(fs.readFileSync("kama/public.key", "utf8").trim(), sodium.base64_variants.ORIGINAL);
const accs = Object.entries(process.env).filter(([k, v]) => k.startsWith("KAMA_ACC_") && v);
const start = new Date(Date.now() - 60 * 864e5);
const out = { at: new Date().toISOString(), accounts: [] };
const status = { at: out.at, ok: true, banks: {} };
for (const [k, v] of accs) {
  let cfg; try { cfg = JSON.parse(v); } catch { status.banks[k] = "פרטים לא תקינים"; status.ok = false; continue; }
  const { companyId, ...creds } = cfg;
  try {
    const sc = createScraper({ companyId, startDate: start, combineInstallments: false, showBrowser: false, args: ["--no-sandbox"] });
    const r = await sc.scrape(creds);
    if (r.success) { out.accounts.push({ companyId, accounts: r.accounts }); status.banks[companyId] = "תקין"; }
    else { status.ok = false; status.banks[companyId] = r.errorType === "INVALID_PASSWORD" ? "סיסמה שגויה — לעדכן בדף ההקמה" : r.errorType === "CHANGE_PASSWORD" ? "הבנק מבקש להחליף סיסמה" : "נכשל (" + (r.errorType || "לא ידוע") + ")"; }
  } catch (e) { status.ok = false; status.banks[companyId] = "נכשל (שגיאה בהרצה)"; }
}
fs.mkdirSync("data", { recursive: true });
const sealed = sodium.crypto_box_seal(sodium.from_string(JSON.stringify(out)), pk);
fs.writeFileSync("data/txns.enc", sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL));
fs.writeFileSync("data/pulse.txt", out.at);
fs.writeFileSync("status.json", JSON.stringify(status, null, 1));
console.log("done", accs.length, "banks");
process.exit(0);
