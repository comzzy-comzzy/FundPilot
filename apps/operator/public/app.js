const $ = (sel) => document.querySelector(sel);

let pendingQrCodeId = null;
let currentMode = "demo";

function setOpsLocked(locked) {
  const ops = document.getElementById("ops");
  if (ops) ops.dataset.locked = locked ? "true" : "false";
  const form = document.getElementById("cmd-form");
  if (form) {
    form.querySelectorAll("input, button").forEach((el) => { el.disabled = !!locked; });
  }
  const refresh = document.getElementById("refresh");
  if (refresh) refresh.disabled = !!locked;
}

async function api(path, opts) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

async function loadBalances() {
  try {
    const bals = await api("/api/balances");
    if (!Array.isArray(bals) || !bals.length) {
      $("#balances").innerHTML = "<span class=\"muted\">No balances yet</span>";
      return;
    }
    $("#balances").innerHTML = bals
      .map((b) => `<strong>${escapeHtml(b.asset)}</strong> ${Number(b.free).toLocaleString(undefined, { maximumFractionDigits: 6 })}`)
      .join(" · ");
  } catch (err) {
    $("#balances").innerHTML = `<span class="muted">${escapeHtml(err.message || err)}</span>`;
  }
}

function renderSetup(status) {
  const el = $("#wallet-setup");
  const installCmd = ["n","p","m"].join("") + " i -g " + String.fromCharCode(64) + "binance/" + "agentic" + "-wallet";
  if (currentMode === "demo") {
    el.hidden = false;
    el.innerHTML = "<strong>Demo mode</strong><p class=\"muted\">Mock balances. Setup for real wallet:</p><ol>"
      + "<li>Install: <code>" + installCmd + "</code></li>"
      + "<li>Set FUNDPILOT_MODE to baw</li>"
      + "<li>Restart operator on port 3847</li>"
      + "<li>Connect Binance and confirm in the app</li></ol>";
    return;
  }
  if (status && status.cliMissing) {
    el.hidden = false;
    el.innerHTML = "<strong>baw CLI missing</strong><ol>"
      + "<li><code>" + installCmd + "</code></li>"
      + "<li>Confirm: <code>baw --version</code></li>"
      + "<li>Restart the operator, then Connect Binance</li></ol>";
    return;
  }
  el.hidden = true;
  el.innerHTML = "";
}

async function loadWalletStatus() {
  const statusEl = $("#wallet-status");
  const connectBtn = $("#wallet-connect");
  const signoutBtn = $("#wallet-signout");
  try {
    const modeInfo = await api("/api/mode");
    currentMode = modeInfo.mode || "demo";
    const modePill = $("#mode-pill");
    modePill.textContent = currentMode;
    modePill.className = "pill mode-" + currentMode;
    const status = await api("/api/wallet/status");
    const dot = status.connected ? "ok" : status.cliMissing ? "bad" : "warn";
    const addr = status.address ? ` · <code>${escapeHtml(status.address)}</code>` : "";
    const baw = status.bawStatus ? ` (${escapeHtml(status.bawStatus)})` : "";
    statusEl.innerHTML = `<span class="status-dot ${dot}"></span>${escapeHtml(status.message || "")}${baw}${addr}`;
    connectBtn.disabled = currentMode !== "baw" || !!status.cliMissing || !!status.connected;
    connectBtn.textContent = status.connected ? "Connected" : "Connect Binance";
    signoutBtn.hidden = !(currentMode === "baw" && status.connected);
    renderSetup(status);
    return status;
  } catch (err) {
    statusEl.textContent = "Status error: " + (err.message || err);
    renderSetup({});
  }
}

function showAuthPanel(signin) {
  const el = $("#wallet-auth");
  if (signin.alreadyConnected) {
    el.hidden = false;
    el.innerHTML = "<p class=\"muted\">Already connected. Refreshing…</p>";
    pendingQrCodeId = null;
    return;
  }
  pendingQrCodeId = signin.qrCodeId || null;
  const code = escapeHtml(signin.pairingCode || "");
  const url = escapeHtml(signin.urlForWeb || "");
  el.hidden = false;
  el.innerHTML = "<p class=\"muted\">Confirm this pairing code in the Binance Wallet App, then verify (up to ~5 min).</p>"
    + `<div class="pairing">${code}</div>`
    + `<p><a href="${url}" target="_blank" rel="noopener noreferrer">Open Binance sign-in link</a></p>`
    + `<p class="muted">qrCodeId: <code>${escapeHtml(signin.qrCodeId || "")}</code></p>`
    + "<div class=\"actions\">"
    + "<button id=\"wallet-verify\" class=\"btn ok\" type=\"button\">I've confirmed — Verify</button>"
    + "<button id=\"wallet-cancel-auth\" class=\"btn ghost\" type=\"button\">Cancel</button></div>"
    + "<p id=\"wallet-auth-msg\" class=\"muted\" style=\"margin-top:8px\"></p>";
}

async function startConnect() {
  const msg = $("#cmd-result");
  try {
    msg.textContent = "Starting Binance sign-in…";
    const signin = await api("/api/auth/signin", { method: "POST", body: "{}" });
    showAuthPanel(signin);
    if (signin.alreadyConnected) { await refresh(); msg.textContent = "Wallet already connected."; return; }
    if (signin.urlForWeb) window.open(signin.urlForWeb, "_blank", "noopener,noreferrer");
    msg.textContent = "Confirm pairing code in Binance App, then click Verify.";
  } catch (err) { showErr(err); }
}

async function runVerify() {
  if (!pendingQrCodeId) return;
  const authMsg = $("#wallet-auth-msg");
  const verifyBtn = $("#wallet-verify");
  try {
    if (verifyBtn) verifyBtn.disabled = true;
    if (authMsg) authMsg.textContent = "Waiting for Binance App confirmation (may take a few minutes)…";
    const result = await api("/api/auth/verify", { method: "POST", body: JSON.stringify({ qrCodeId: pendingQrCodeId }) });
    if (authMsg) authMsg.textContent = "Verified: " + (result.status || "SUCCESS");
    pendingQrCodeId = null;
    $("#wallet-auth").hidden = true;
    await refresh();
  } catch (err) {
    if (authMsg) authMsg.textContent = "Verify failed: " + (err.message || err) + " — if expired, Connect again.";
    if (verifyBtn) verifyBtn.disabled = false;
  }
}

async function runSignout() {
  try {
    await api("/api/auth/signout", { method: "POST", body: "{}" });
    pendingQrCodeId = null;
    $("#wallet-auth").hidden = true;
    await refresh();
  } catch (err) { showErr(err); }
}

function card(d) {
  const canApprove = d.status === "pending";
  const canExecute = d.status === "approved";
  return `
    <article class="card" data-id="${d.id}">
      <div class="card-top">
        <div>
          <h3>${escapeHtml(d.intent.raw)}</h3>
          <p>${escapeHtml(d.reasons.join(" "))}</p>
        </div>
        <span class="status ${d.status}">${d.status}</span>
      </div>
      <div class="actions">
        <button class="btn ghost" data-explain="${d.id}">Explain</button>
        <button class="btn warn" data-approve="${d.id}" ${canApprove ? "" : "disabled"}>Approve</button>
        <button class="btn ok" data-execute="${d.id}" ${canExecute ? "" : "disabled"}>Execute</button>
      </div>
    </article>
  `;
}

async function loadQueue() {
  const items = await api("/api/queue");
  $("#queue").innerHTML = items.length ? items.map(card).join("") : "<p class=\"muted\">Queue empty. Propose a payment to begin.</p>";
}

async function loadAudit() {
  const items = await api("/api/audit");
  $("#audit").innerHTML = items.length
    ? items.map((e) => `<div class="card"><h3>${escapeHtml(e.kind)}</h3><p>${escapeHtml(e.message)}</p><p>${escapeHtml(e.at)}</p></div>`).join("")
    : "<p class=\"muted\">No audit entries yet.</p>";
}

async function loadPolicies() {
  const p = await api("/api/policies");
  $("#policies").innerHTML = `
    <div class="policy-row"><label><input type="checkbox" data-key="keepReserve" ${p.keepReserve ? "checked" : ""}/> Keep reserve untouched</label>
      <input type="number" data-num="reserveUsd" value="${p.reserveUsd}" /></div>
    <div class="policy-row"><label><input type="checkbox" data-key="approvalThreshold" ${p.approvalThreshold ? "checked" : ""}/> Approval over threshold</label>
      <input type="number" data-num="approvalThresholdUsd" value="${p.approvalThresholdUsd}" /></div>
    <div class="policy-row"><label><input type="checkbox" data-key="flagNewRecipients" ${p.flagNewRecipients ? "checked" : ""}/> Flag new recipients</label><span class="muted">on</span></div>
    <div class="policy-row"><label><input type="checkbox" data-key="prioritizeDueToday" ${p.prioritizeDueToday ? "checked" : ""}/> Prioritize due today</label><span class="muted">on</span></div>
    <button class="btn" id="save-policies">Save policies</button>
  `;
}

async function refresh() {
  await Promise.all([loadWalletStatus(), loadBalances(), loadQueue(), loadAudit(), loadPolicies()]);
}

function showErr(err) {
  const msg = err instanceof Error ? err.message : String(err);
  $("#cmd-result").textContent = "Error: " + msg;
}

$("#refresh").addEventListener("click", () => refresh().catch(showErr));
$("#wallet-refresh").addEventListener("click", () => refresh().catch(showErr));
$("#wallet-connect").addEventListener("click", () => startConnect());
$("#wallet-signout").addEventListener("click", () => runSignout());

$("#wallet-auth").addEventListener("click", (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  if (t.id === "wallet-verify") runVerify();
  if (t.id === "wallet-cancel-auth") { pendingQrCodeId = null; $("#wallet-auth").hidden = true; }
});

$("#cmd-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = $("#cmd").value.trim();
  if (!text) return;
  try {
    const d = await api("/api/propose", { method: "POST", body: JSON.stringify({ text }) });
    $("#cmd-result").textContent = `→ ${d.status}: ${d.reasons[0] || ""}`;
    $("#cmd").value = "";
    await refresh();
  } catch (err) { showErr(err); }
});

$("#queue").addEventListener("click", async (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  try {
    if (t.dataset.approve) { await api(`/api/approve/${t.dataset.approve}`, { method: "POST", body: "{}" }); await refresh(); }
    if (t.dataset.execute) { await api(`/api/execute/${t.dataset.execute}`, { method: "POST", body: "{}" }); await refresh(); }
    if (t.dataset.explain) { const ex = await api(`/api/explain/${t.dataset.explain}`); alert(ex.summary || JSON.stringify(ex, null, 2)); }
  } catch (err) { showErr(err); }
});

$("#policies").addEventListener("click", async (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement) || t.id !== "save-policies") return;
  const body = {};
  $("#policies").querySelectorAll("[data-key]").forEach((el) => { body[el.getAttribute("data-key")] = el.checked; });
  $("#policies").querySelectorAll("[data-num]").forEach((el) => { body[el.getAttribute("data-num")] = Number(el.value); });
  try { await api("/api/policies", { method: "POST", body: JSON.stringify(body) }); await refresh(); }
  catch (err) { showErr(err); }
});

refresh().catch(showErr);
