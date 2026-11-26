// kama-connect: מחליף קוד OAuth של גיטהאב במפתח גישה.
// סודות (בהגדרות קלאודפלייר בלבד): GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
// לא שומר, לא מדפיס ליומנים, ומקבל פניות רק מדף ההקמה.
const ORIGIN = "https://shaifeld.github.io";
const REDIRECT = "https://shaifeld.github.io/kama-connect/";

const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "600",
  "Vary": "Origin",
};

function reply(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export default {
  async fetch(req, env) {
    if (req.headers.get("Origin") !== ORIGIN) return reply({ error: "forbidden" }, 403);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST") return reply({ error: "method" }, 405);

    let code;
    try {
      const body = await req.json();
      code = body && body.code;
    } catch (e) {
      return reply({ error: "bad_json" }, 400);
    }
    if (typeof code !== "string" || !/^[A-Za-z0-9_-]{10,64}$/.test(code)) {
      return reply({ error: "bad_code" }, 400);
    }

    const r = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!data.access_token) return reply({ error: data.error || "exchange_failed" }, 400);
    return reply({ access_token: data.access_token, scope: data.scope || "" }, 200);
  },
};
