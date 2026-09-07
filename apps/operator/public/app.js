const $ = (sel) => document.querySelector(sel);

async function api(path, opts) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function money(n) {
  return "$" + Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

async function loadBalances() {
  const bals = await api("/api/balances");
  $("#balances").innerHTML = bals
    .map((b) => `<strong>${b.asset}</strong> ${Number(b.free).toLocaleString(undefined, { maximumFractionDigits: 6 })}`)
    .join(" · ");
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

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function loadQueue() {
  const items = await api("/api/queue");
  $("#queue").innerHTML = items.length
    ? items.map(card).join("")
    : '<p class="muted">Queue empty. Propose a payment to begin.</p>';
}

async function loadAudit() {
  const items = await api("/api/audit");
  $("#audit").innerHTML = items.length
    ? items
        .map(
          (e) =>
            `<div class="card"><h3>${escapeHtml(e.kind)}</h3><p>${escapeHtml(e.message)}</p><p>${escapeHtml(e.at)}</p></div>`
        )
        .join("")
    : '<p class="muted">No audit entries yet.</p>';
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
  await Promise.all([loadBalances(), loadQueue(), loadAudit(), loadPolicies()]);
}

$("#refresh").addEventListener("click", () => refresh().catch(showErr));

$("#cmd-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = $("#cmd").value.trim();
  if (!text) return;
  try {
    const d = await api("/api/propose", { method: "POST", body: JSON.stringify({ text }) });
    $("#cmd-result").textContent = `→ ${d.status}: ${d.reasons[0] || ""}`;
    $("#cmd").value = "";
    await refresh();
  } catch (err) {
    showErr(err);
  }
});

$("#queue").addEventListener("click", async (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  try {
    if (t.dataset.approve) {
      await api(`/api/approve/${t.dataset.approve}`, { method: "POST", body: "{}" });
      await refresh();
    }
    if (t.dataset.execute) {
      await api(`/api/execute/${t.dataset.execute}`, { method: "POST", body: "{}" });
      await refresh();
    }
    if (t.dataset.explain) {
      const ex = await api(`/api/explain/${t.dataset.explain}`);
      alert(ex.summary || JSON.stringify(ex, null, 2));
    }
  } catch (err) {
    showErr(err);
  }
});

$("#policies").addEventListener("click", async (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement) || t.id !== "save-policies") return;
  const body = {};
  $("#policies").querySelectorAll("[data-key]").forEach((el) => {
    body[el.getAttribute("data-key")] = el.checked;
  });
  $("#policies").querySelectorAll("[data-num]").forEach((el) => {
    body[el.getAttribute("data-num")] = Number(el.value);
  });
  try {
    await api("/api/policies", { method: "POST", body: JSON.stringify(body) });
    await refresh();
  } catch (err) {
    showErr(err);
  }
});

function showErr(err) {
  const msg = err instanceof Error ? err.message : String(err);
  $("#cmd-result").textContent = "Error: " + msg;
}

refresh().catch(showErr);
