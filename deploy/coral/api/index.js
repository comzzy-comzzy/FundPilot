
const state = globalThis.__fp || (globalThis.__fp = {
  queue: [], audit: [],
  policies: { reserveUsd: 1000, approvalThresholdUsd: 500, flagNewRecipients: true, prioritizeDueToday: true },
  balances: [
    { asset: "USDT", free: 1800.23, locked: 0 },
    { asset: "BNB", free: 2.5, locked: 0 },
    { asset: "BTC", free: 0.15, locked: 0 },
  ],
  seq: 1,
});
function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(body, null, 2));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
function parseAmount(text) {
  const m = String(text || "").match(/\$?\s*([0-9]+(?:\.[0-9]+)?)/);
  return m ? Number(m[1]) : 0;
}
module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return json(res, 204, {});
  const url = new URL(req.url || "/", "http://x");
  let path = url.pathname || "/";
  if (path.startsWith("/api/")) path = path.slice(4);
  if (!path.startsWith("/")) path = "/" + path;
  try {
    if (req.method === "GET" && path === "/mode")
      return json(res, 200, { mode: "demo", note: "Vercel demo. Live baw Agent OS needs a host with Binance CLI." });
    if (req.method === "GET" && path === "/wallet/status")
      return json(res, 200, { connected: true, mode: "demo", address: "demo-binance-0xFUNDPILOT", message: "Demo wallet on Vercel — propose works now. Live Connect needs Agent OS host." });
    if (req.method === "GET" && path === "/balances") return json(res, 200, state.balances);
    if (req.method === "GET" && path === "/queue") return json(res, 200, state.queue);
    if (req.method === "GET" && path === "/audit") return json(res, 200, state.audit);
    if (req.method === "GET" && path === "/policies") return json(res, 200, state.policies);
    if (req.method === "POST" && path.startsWith("/auth/"))
      return json(res, 400, { error: "Live Binance Connect needs Agent OS (baw) host. This coral deploy runs demo so everyone can try propose → queue → approve.", mode: "demo" });
    if (req.method === "POST" && path === "/propose") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const text = body.text || "";
      const amount = parseAmount(text);
      const id = "d" + state.seq++;
      const needsApproval = amount >= state.policies.approvalThresholdUsd;
      const reason = needsApproval ? `Over approval threshold ($${state.policies.approvalThresholdUsd}).` : "Within policy — ready to execute in demo.";
      const item = { id, text, amount, status: needsApproval ? "pending" : "approved",
        intent: { raw: text }, reasons: [reason], reason,
        createdAt: new Date().toISOString() };
      state.queue.unshift(item);
      state.audit.unshift({ id: "a"+state.seq++, type: "propose", decisionId: id, at: item.createdAt, detail: item.reason });
      return json(res, 200, item);
    }
    if (req.method === "POST" && path.startsWith("/approve/")) {
      const id = path.split("/").pop();
      const item = state.queue.find((q) => q.id === id);
      if (!item) return json(res, 404, { error: "not found" });
      item.status = "approved";
      state.audit.unshift({ id: "a"+state.seq++, type: "approve", decisionId: id, at: new Date().toISOString(), detail: "User approved" });
      return json(res, 200, item);
    }
    if (req.method === "POST" && path.startsWith("/execute/")) {
      const id = path.split("/").pop();
      const item = state.queue.find((q) => q.id === id);
      if (!item) return json(res, 404, { error: "not found" });
      if (item.status !== "approved") return json(res, 400, { error: "not approved" });
      item.status = "executed";
      state.audit.unshift({ id: "a"+state.seq++, type: "execute", decisionId: id, at: new Date().toISOString(), detail: "Demo execute (no on-chain)" });
      return json(res, 200, item);
    }
    if (req.method === "POST" && path === "/policies") {
      Object.assign(state.policies, JSON.parse((await readBody(req)) || "{}"));
      return json(res, 200, state.policies);
    }
    return json(res, 404, { error: "not found", path });
  } catch (e) {
    return json(res, 500, { error: String(e && e.message ? e.message : e) });
  }
};
