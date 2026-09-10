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
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".xml": "application/xml; charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  setSecurityHeaders(res);

  if (req.method === "POST" && req.url === "/api/contact") {
    return handleContact(req, res);
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD, POST" });
    return res.end("Metodo no permitido");
  }

  const redirectTarget = redirectFor(req.url);
  if (redirectTarget) {
    res.writeHead(301, {
      "Cache-Control": "no-cache",
      Location: redirectTarget,
    });
    return res.end();
  }

  const staticFile = resolveStaticFile(req.url);

  if (staticFile.error) {
    res.writeHead(staticFile.statusCode);
    return res.end(staticFile.error);
  }

  fs.stat(staticFile.filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      res.writeHead(404);
      return res.end("No encontrado");
    }

    fs.readFile(staticFile.filePath, (readError, content) => {
      if (readError) {
        res.writeHead(404);
        return res.end("No encontrado");
      }

      res.writeHead(200, {
        "Cache-Control": cacheControlFor(staticFile.filePath),
        "Content-Type": mimeTypes[path.extname(staticFile.filePath).toLowerCase()] || "application/octet-stream",
      });
      if (req.method === "HEAD") {
        return res.end();
      }
      return res.end(content);
    });
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
  const rateLimitKey = getClientIp(req);
  if (isRateLimited(rateLimitKey)) {
    return sendJson(res, 429, {
      error: "Demasiados intentos. Intentalo de nuevo en unos minutos.",
    });
  }

  const contentType = req.headers["content-type"] || "";
  if (!isSupportedContentType(contentType)) {
    return sendJson(res, 415, { error: "Formato de formulario no soportado." });
  }

  if (!hasAllowedOrigin(req)) {
    return sendJson(res, 403, { error: "Origen no permitido." });
  }

  let body = "";
  let bodyTooLarge = false;

  req.on("data", (chunk) => {
    if (bodyTooLarge) {
      return;
    }
    body += chunk;
    if (Buffer.byteLength(body) > CONTACT_BODY_LIMIT_BYTES) {
      bodyTooLarge = true;
      sendJson(res, 413, { error: "El formulario es demasiado largo." });
    }
  });

  req.on("end", async () => {
    if (bodyTooLarge) {
      return;
    }

    try {
      const payload = parseBody(body, contentType);
      await sendContactEmail(payload);
      sendJson(res, 200, { ok: true });
    } catch (error) {
      if (!error.statusCode || error.statusCode >= 500) {
        console.error(error);
      }
      sendJson(res, error.statusCode || 500, {
        error: error.publicMessage || "No se ha podido enviar el formulario.",
      });
    }
  });

  req.on("error", () => {
    if (!res.headersSent) {
      sendJson(res, 400, { error: "No se ha podido leer el formulario." });
    }
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
}

const CONTACT_BODY_LIMIT_BYTES = 24 * 1024;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_MAX_BUCKETS = 1000;
const contactAttempts = new Map();

const publicRootFiles = new Set([
  "aviso-legal.html",
  "coordinacion-dia-b.html",
  "contacto.html",
  "contacto.js",
  "cookies.html",
  "creacion-contenido.html",
  "index.html",
  "nav.js",
  "organizacion-integral.html",
  "papeleria-regalos.html",
  "portfolio.html",
  "privacidad.html",
  "qa.html",
  "robots.txt",
  "sitemap.xml",
  "styles.css",
]);

const publicAssetFiles = new Set([
  "assets/Contacto.jpeg",
  "assets/logo-luciernaga-icon-transparent.png",
  "assets/logo-luciernagas-transparent.png",
  "assets/logo-luciernagas-wordmark-transparent.png",
]);

const privatePathSegments = new Set([
  ".agents",
  ".git",
  "api",
  "lib",
  "nbproject",
  "node_modules",
  "tmp",
]);

const securityHeaders = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "connect-src 'self'",
    "font-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
  ].join("; "),
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function setSecurityHeaders(res) {
  for (const [header, value] of Object.entries(securityHeaders)) {
    res.setHeader(header, value);
  }

  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}

function resolveStaticFile(url) {
  let pathname;

  try {
    pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
  } catch (error) {
    return { error: "Solicitud no valida", statusCode: 400 };
  }

  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.resolve(root, relativePath);
  const relativeToRoot = path.relative(root, filePath);

  if (
    !relativeToRoot ||
    relativeToRoot.startsWith("..") ||
    path.isAbsolute(relativeToRoot) ||
    relativeToRoot.includes("\0")
  ) {
    return { error: "Acceso denegado", statusCode: 403 };
  }

  const publicPath = relativeToRoot.split(path.sep).join("/");
  const pathSegments = publicPath.split("/");

  if (
    pathSegments.some((segment) => segment.startsWith(".") || privatePathSegments.has(segment)) ||
    !isPublicPath(publicPath)
  ) {
    return { error: "No encontrado", statusCode: 404 };
  }

  return { filePath };
}

function redirectFor(url) {
  let pathname;

  try {
    pathname = new URL(url, "http://localhost").pathname;
  } catch (error) {
    return null;
  }

  if (pathname === "/servicios" || pathname === "/servicios/" || pathname === "/servicios.html") {
    return "/organizacion-integral.html";
  }

  return null;
}

function isPublicPath(publicPath) {
  return (
    publicRootFiles.has(publicPath) ||
    publicAssetFiles.has(publicPath) ||
    publicPath.startsWith("assets/editorial/") ||
    publicPath.startsWith("assets/gallery/")
  );
}

function cacheControlFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html" || ext === ".xml" || ext === ".txt") {
    return "no-cache";
  }
  return "public, max-age=604800";
}

function getClientIp(req) {
  if (process.env.TRUST_PROXY === "true") {
    const forwardedFor = req.headers["x-forwarded-for"];
    const candidate = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    if (candidate) {
      return candidate.split(",")[0].trim();
    }
  }

  return req.socket.remoteAddress || "unknown";
}

function isRateLimited(key) {
  const now = Date.now();
  cleanupRateLimitBuckets(now);

  const bucket = contactAttempts.get(key) || [];
  const recentAttempts = bucket.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);

  if (recentAttempts.length >= RATE_LIMIT_MAX_ATTEMPTS) {
    contactAttempts.set(key, recentAttempts);
    return true;
  }

  recentAttempts.push(now);
  if (!contactAttempts.has(key) && contactAttempts.size >= RATE_LIMIT_MAX_BUCKETS) {
    const oldestKey = contactAttempts.keys().next().value;
    contactAttempts.delete(oldestKey);
  }
  contactAttempts.set(key, recentAttempts);
  return false;
}

function cleanupRateLimitBuckets(now) {
  for (const [key, timestamps] of contactAttempts.entries()) {
    const recentAttempts = timestamps.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
    if (recentAttempts.length) {
      contactAttempts.set(key, recentAttempts);
    } else {
      contactAttempts.delete(key);
    }
  }
}

function isSupportedContentType(contentType) {
  return (
    !contentType ||
    contentType.includes("application/json") ||
    contentType.includes("application/x-www-form-urlencoded")
  );
}

function parseBody(body, contentType) {
  if (!body) {
    return {};
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(body));
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    error.statusCode = 400;
    error.publicMessage = "El formulario no tiene un formato valido.";
    throw error;
  }
}

function hasAllowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) {
    return true;
  }

  return (
    origin === "https://luciernagasweddings.com" ||
    origin === "https://www.luciernagasweddings.com" ||
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:")
  );
}
