const http = require("http");
const fs = require("fs");
const path = require("path");
const {
  handleBibliographyRequest,
  handleConceptTreeRequest,
  handleExplainRequest,
  handleHealthRequest,
  handleTaxonomyRequest,
} = require("./api/shared");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(res, 404, { error: "File not found." });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/health") {
    handleHealthRequest(req, res);
    return;
  }

  if (url.pathname === "/api/taxonomy") {
    handleTaxonomyRequest(req, res);
    return;
  }

  if (url.pathname === "/api/bibliography") {
    handleBibliographyRequest(req, res);
    return;
  }

  if (url.pathname === "/api/concepts") {
    handleConceptTreeRequest(req, res);
    return;
  }

  if (url.pathname === "/api/explain") {
    handleExplainRequest(req, res);
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.join(ROOT, requested);

  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { error: "Forbidden." });
    return;
  }

  serveFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Knowledge Atlas running at http://localhost:${PORT}`);
});
