export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST." });
  }

  const auth = req.headers.authorization;
  if (typeof auth !== "string" || !auth.toLowerCase().startsWith("bearer ")) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return res.status(500).json({ error: "Supabase URL or anon key is not configured on the server." });
  }

  try {
    const response = await fetch(supabaseUrl.replace(/\/$/, "") + "/functions/v1/glide-leads-dry-run", {
      method: "POST",
      headers: {
        Authorization: auth,
        apikey: anonKey,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(req.body || {})
    });
    const text = await response.text();
    res.status(response.status);
    res.setHeader("Content-Type", response.headers.get("content-type") || "application/json");
    return res.send(text);
  } catch (error) {
    console.error("Glide preview proxy failed:", error?.message || error);
    return res.status(502).json({ error: "Could not reach the Glide preview service." });
  }
}
