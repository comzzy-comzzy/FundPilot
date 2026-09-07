import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDemoEngine, type PolicyConfig } from "@fundpilot/core";
import { createAdapter } from "@fundpilot/binance";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const PORT = Number(process.env.FUNDPILOT_PORT || 3847);

const wallet = createAdapter("demo");
const engine = createDemoEngine(wallet);

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  const data = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(data);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function contentType(file: string): string {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

async function handleApi(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
  const method = req.method || "GET";
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  try {
    if (method === "GET" && url.pathname === "/api/balances") {
      return sendJson(res, 200, await engine.getBalances());
    }
    if (method === "GET" && url.pathname === "/api/queue") {
      return sendJson(res, 200, engine.listQueue());
    }
    if (method === "GET" && url.pathname === "/api/audit") {
      return sendJson(res, 200, engine.listAudit());
    }
    if (method === "GET" && url.pathname === "/api/policies") {
      return sendJson(res, 200, engine.getPolicy());
    }
    if (method === "GET" && url.pathname.startsWith("/api/explain/")) {
      const id = url.pathname.split("/").pop()!;
      return sendJson(res, 200, engine.explainDecision(id));
    }
    if (method === "POST" && url.pathname === "/api/propose") {
      const body = JSON.parse((await readBody(req)) || "{}") as { text?: string };
      return sendJson(res, 200, await engine.proposePayment(body.text || ""));
    }
    if (method === "POST" && url.pathname.startsWith("/api/approve/")) {
      const id = url.pathname.split("/").pop()!;
      return sendJson(res, 200, engine.approveDecision(id));
    }
    if (method === "POST" && url.pathname.startsWith("/api/execute/")) {
      const id = url.pathname.split("/").pop()!;
      return sendJson(res, 200, await engine.executeAllowed(id));
    }
    if (method === "POST" && url.pathname === "/api/policies") {
      const body = JSON.parse((await readBody(req)) || "{}") as Partial<PolicyConfig>;
      return sendJson(res, 200, engine.setPolicy(body));
    }
    return sendJson(res, 404, { error: "Not found" });
  } catch (e) {
    return sendJson(res, 400, {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  if (url.pathname.startsWith("/api/")) {
    return handleApi(req, res, url);
  }

  let filePath = path.join(
    publicDir,
    url.pathname === "/" ? "index.html" : url.pathname
  );
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(publicDir, "index.html");
  }
  const data = fs.readFileSync(filePath);
  res.writeHead(200, { "Content-Type": contentType(filePath) });
  res.end(data);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`FundPilot operator at http://127.0.0.1:${PORT}`);
});
