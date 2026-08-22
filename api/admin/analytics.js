const { getSession } = require("../../lib/auth");
const {
  isAnalyticsAdmin,
  loadAnalyticsBundle,
  buildDashboard,
  upsertCohort,
  listCohorts,
} = require("../../lib/analytics");

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

async function requireAdmin(req, res) {
  const user = await getSession(req);
  if (!user) {
    res.status(401).json({ ok: false, error: "請先登入" });
    return null;
  }
  const allowed = await isAnalyticsAdmin(user);
  if (!allowed) {
    res.status(403).json({ ok: false, error: "沒有權限查看分析後台" });
    return null;
  }
  return user;
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  try {
    const adminUser = await requireAdmin(req, res);
    if (!adminUser) return;
    if (req.method === "POST") {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const cohort = await upsertCohort({
        slug: body.slug,
        name: body.name,
        startDate: body.startDate || body.start_date,
        endDate: body.endDate || body.end_date,
        userIds: body.userIds || body.user_ids,
      });
      res.status(200).json({ ok: true, data: cohort });
      return;
    }
    if (req.method !== "GET") {
      res.status(405).json({ ok: false, error: "只接受 GET 或 POST" });
      return;
    }
    if (String(req.query?.probe || "") === "1") {
      res.status(200).json({ ok: true, admin: true });
      return;
    }
    const bundle = await loadAnalyticsBundle();
    const data = buildDashboard(bundle, { cohort: req.query?.cohort || "all" });
    const cohorts = await listCohorts();
    res.status(200).json({ ok: true, data: { ...data, cohorts: data.cohorts.length ? data.cohorts : [{ slug: "all", name: "全部使用者" }, ...cohorts] } });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error && error.message ? error.message : error) });
  }
};
