const { supabaseUrl, supabaseAnonKey, supabaseConfigured } = require("../lib/supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "只接受 GET" });
    return;
  }
  res.status(200).json({
    ok: true,
    supabaseUrl: supabaseUrl(),
    supabaseAnonKey: supabaseAnonKey(),
    configured: supabaseConfigured(),
  });
};
