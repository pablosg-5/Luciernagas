const http = require("http");
const fs = require("fs");
const path = require("path");
const { sendContactEmail } = require("./lib/resend-contact");

loadEnv();

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/contact") {
    return handleContact(req, res);
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD, POST" });
    return res.end("Metodo no permitido");
  }

  const requestedPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const filePath = path.normalize(path.join(root, requestedPath === "/" ? "index.html" : requestedPath));

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    return res.end("Acceso denegado");
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      return res.end("No encontrado");
    }

    res.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    });
    if (req.method === "HEAD") {
      return res.end();
    }
    return res.end(content);
  });
});

server.listen(port, () => {
  console.log(`Luciernagas Weddings en http://127.0.0.1:${port}`);
});

function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");

    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function handleContact(req, res) {
  let body = "";

  req.on("data", (chunk) => {
    body += chunk;
    if (body.length > 1024 * 1024) {
      req.destroy();
    }
  });

  req.on("end", async () => {
    try {
      const payload = body ? JSON.parse(body) : {};
      await sendContactEmail(payload);
      sendJson(res, 200, { ok: true });
    } catch (error) {
      console.error(error);
      sendJson(res, error.statusCode || 500, {
        error: error.publicMessage || "No se ha podido enviar el formulario.",
      });
    }
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
}
