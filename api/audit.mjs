import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { handleAuditRequest } = require("./audit-handler.js");

function buildRequest(text) {
  const listeners = {};
  return {
    method: "POST",
    on(event, callback) {
      listeners[event] = callback;
      if (event === "data") queueMicrotask(() => callback(text));
      if (event === "end") queueMicrotask(() => callback());
    },
  };
}

export async function POST(request) {
  let statusCode = 200;
  const headers = new Headers();
  let responseBody = "";
  const req = buildRequest(await request.text());
  const res = {
    writeHead(code, values = {}) {
      statusCode = code;
      for (const [key, value] of Object.entries(values)) headers.set(key, value);
    },
    end(value = "") {
      responseBody = String(value);
    },
  };

  await handleAuditRequest(req, res);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(responseBody, { status: statusCode, headers });
}
