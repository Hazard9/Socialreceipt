/* Minimal zero-dependency static file server for local/CI test runs.
   Serves the repo root so tests hit real index.html / success.html /
   sw.js / manifest.json exactly as Netlify would (functions are mocked
   in the Playwright tests via page.route, not served here). */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PORT = process.env.PORT || 8787;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".toml": "text/plain; charset=utf-8",
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.join(ROOT, urlPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback, mirrors netlify.toml's /* -> /index.html rule
      fs.readFile(path.join(ROOT, "index.html"), (err2, fallback) => {
        if (err2) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": MIME[".html"] });
        res.end(fallback);
      });
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
});

if (require.main === module) {
  server.listen(PORT, () => console.log("Test server on http://localhost:" + PORT));
}

module.exports = server;
