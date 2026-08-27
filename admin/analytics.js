const charts = { dau: null, retention: null, feature: null };
let current = null;

function pct(value) {
  return `${((Number(value) || 0) * 100).toFixed(1)}%`;
}

function authHeaders(token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function getAccessToken() {
  try {
    const response = await fetch("/api/config");
    const config = await response.json();
    if (!config.supabaseUrl || !window.supabase) return "";
    const createClient = window.supabase.createClient;
    const client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "nichi-auth" },
    });
    if (window.NichiAuthStorage && client.auth) {
      try {
        await window.NichiAuthStorage.restore?.(client);
      } catch {
        /* ignore */
      }
    }
    const { data } = await client.auth.getSession();
    if (data && data.session) return data.session.access_token;
    const backup = window.NichiAuthStorage && window.NichiAuthStorage.readSessionBackup
      ? window.NichiAuthStorage.readSessionBackup()
      : "";
    if (!backup) return "";
    const parsed = JSON.parse(backup);
    if (parsed && parsed.access_token && parsed.refresh_token) {
      const restored = await client.auth.setSession({
        access_token: parsed.access_token,
        refresh_token: parsed.refresh_token,
      });
      return restored.data && restored.data.session ? restored.data.session.access_token : parsed.access_token;
    }
    return parsed && parsed.access_token ? parsed.access_token : "";
  } catch {
    return "";
  }
}

function mark(ok) {
  return ok ? '<span class="admin-ok">是</span>' : '<span class="admin-no">否</span>';
}

function featureNames(features) {
  const map = {
    quick: "快速復盤",
    deep: "深度復盤",
    body: "身體覺察",
    thinking: "深度思考",
    execution: "執行力",
    weekly: "週報",
    monthly: "月報",
    manifestation: "顯化力",
    history: "歷史",
  };
  return Object.keys(map)
    .filter((key) => features && features[key])
    .map((key) => map[key])
    .join("、") || "—";
}

function renderKpis(kpis) {
  const items = [
    [kpis.signups || 0, "總註冊人數"],
    [kpis.activeToday || 0, "今日活躍"],
    [kpis.activeLast7 || 0, "近 7 日活躍"],
    [kpis.activeLast30 || 0, "近 30 日活躍"],
    [kpis.firstReview || 0, "完成第一次復盤"],
    [pct(kpis.d7Retention), "D7 Retention"],
    [pct(kpis.d30Retention), "D30 Retention"],
    [kpis.paid || 0, "付費訂閱人數"],
  ];
  document.getElementById("kpiGrid").innerHTML = items
    .map(([value, label]) => `<article class="admin-kpi"><strong>${value}</strong><span>${label}</span></article>`)
    .join("");
}

function renderFunnel(funnel) {
  document.getElementById("funnelList").innerHTML = (funnel || [])
    .map((layer, index) => {
      const extra = index === 0
        ? ""
        : `<em>上一層 ${pct(layer.fromPrev)} · 總註冊 ${pct(layer.fromSignup)}</em>`;
      return `<li><div><strong>${layer.count || 0}</strong> ${layer.label}</div>${extra}</li>`;
    })
    .join("");
}

function renderPlusConversion(layers) {
  const el = document.getElementById("plusFunnelList");
  if (!el) return;
  el.innerHTML = (layers || [])
    .map((layer, index) => {
      const extra = index === 0 ? "" : `<em>↓ 上一層轉換 ${pct(layer.fromPrev)}</em>`;
      return `<li><div><strong>${layer.users || 0}</strong> 人　${layer.label}</div>${extra}</li>`;
    })
    .join("");
}

function renderFeatures(features) {
  document.getElementById("featureList").innerHTML = (features || [])
    .map((item) => `
      <article class="admin-feature">
        <strong>${item.label}</strong>
        <span>${item.users || 0} 人使用 · 共完成 ${item.uses || 0} 次 · ${pct(item.ofActive)} 活躍使用者曾使用</span>
      </article>
    `)
    .join("");
}

function renderWindows(windows) {
  document.getElementById("windowList").innerHTML = (windows || [])
    .map((item) => `<li>${item.windowDays} 日活躍留存（至少 ${item.minActiveDays} 個 Active Days）：${item.users || 0} 人（${pct(item.rate)}）</li>`)
    .join("");
}

function renderUsers(users) {
  const body = document.querySelector("#userTable tbody");
  if (!users || !users.length) {
    body.innerHTML = `<tr><td colspan="12">這個範圍目前沒有使用者。</td></tr>`;
    return;
  }
  body.innerHTML = users
    .map((user) => `
      <tr>
        <td>${user.emailMasked || "—"}</td>
        <td>${user.signupDate || "—"}</td>
        <td>${user.trialStartedAt || "—"}</td>
        <td>${user.totalActiveDays || 0}</td>
        <td>${user.lastActiveDate || "—"}</td>
        <td>${user.totalReviews || 0}</td>
        <td>${featureNames(user.features)}</td>
        <td>${mark(user.d3)}</td>
        <td>${mark(user.d7)}</td>
        <td>${mark(user.d14)}</td>
        <td>${mark(user.d30)}</td>
        <td>${user.paid ? "訂閱中" : user.trialStatus || "—"}</td>
      </tr>
    `)
    .join("");
}

function drawLine(id, labels, values, key) {
  const ctx = document.getElementById(id);
  if (!ctx || !window.Chart) return;
  if (charts[key]) charts[key].destroy();
  charts[key] = new window.Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{ data: values, borderColor: "#9c8879", backgroundColor: "rgba(156,136,121,0.16)", fill: true, tension: 0.35, pointRadius: 2 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
}

function drawBars(id, labels, values, key) {
  const ctx = document.getElementById(id);
  if (!ctx || !window.Chart) return;
  if (charts[key]) charts[key].destroy();
  charts[key] = new window.Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: "#c4b3a3", borderRadius: 8 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
}

function renderDashboard(data) {
  current = data || {};
  const kpis = current.kpis || {};
  renderKpis(kpis);
  renderFunnel(current.funnel || []);
  renderPlusConversion(current.plusConversion || []);
  renderFeatures(current.features || []);
  renderWindows((current.retention && current.retention.activeWindows) || []);
  renderUsers(current.users || []);
  const dau = current.dau || [];
  drawLine("dauChart", dau.map((item) => item.date.slice(5)), dau.map((item) => item.users), "dau");
  const dayN = (current.retention && current.retention.dayN) || [];
  drawBars("retentionChart", dayN.map((item) => `D${item.day}`), dayN.map((item) => item.users), "retention");
  const features = current.features || [];
  drawBars("featureChart", features.map((item) => item.label), features.map((item) => item.users), "feature");
  const select = document.getElementById("cohortSelect");
  const options = current.cohorts || [{ slug: "all", name: "全部使用者" }];
  const chosen = current.cohort || "all";
  select.innerHTML = options.map((item) => `<option value="${item.slug}" ${item.slug === chosen ? "selected" : ""}>${item.name}</option>`).join("");
}

async function loadDashboard(cohort) {
  const status = document.getElementById("adminStatus");
  const body = document.getElementById("adminBody");
  const token = await getAccessToken();
  if (!token) {
    status.textContent = "請先回到 ING 用 Google 登入，再開啟這個頁面。";
    body.hidden = true;
    return;
  }
  const qs = cohort && cohort !== "all" ? `?cohort=${encodeURIComponent(cohort)}` : "";
  const response = await fetch(`/api/admin/analytics${qs}`, { headers: authHeaders(token) });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 403) {
    status.textContent = "這個帳號沒有分析後台權限。";
    body.hidden = true;
    return;
  }
  if (!response.ok || !payload.ok) {
    status.textContent = payload.error || "目前無法載入分析。";
    body.hidden = true;
    return;
  }
  status.textContent = `資料以 Asia/Taipei 計算。更新於 ${new Date(payload.data.generatedAt).toLocaleString("zh-TW")}`;
  body.hidden = false;
  renderDashboard(payload.data);
}

document.getElementById("cohortSelect").addEventListener("change", (event) => {
  loadDashboard(event.target.value).catch(() => {});
});

document.getElementById("cohortForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const token = await getAccessToken();
  const userIds = String(form.userIds.value || "")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const response = await fetch("/api/admin/analytics", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      name: form.name.value,
      slug: form.slug.value,
      startDate: form.startDate.value,
      endDate: form.endDate.value,
      userIds,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  document.getElementById("adminStatus").textContent = payload.ok ? "Cohort 已儲存。" : payload.error || "儲存失敗";
  if (payload.ok) loadDashboard(form.slug.value).catch(() => {});
});

loadDashboard("all").catch(() => {
  document.getElementById("adminStatus").textContent = "載入失敗。沒有資料時也會顯示 0，不會中斷。";
});
