const { sendContactEmail } = require("../lib/resend-contact");

module.exports = async function handler(req, res) {
  setApiSecurityHeaders(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Metodo no permitido." });
  }

  try {
    const contentType = req.headers["content-type"] || "";
    if (!isSupportedContentType(contentType)) {
      return res.status(415).json({ error: "Formato de formulario no soportado." });
    }

    if (!hasAllowedOrigin(req)) {
      return res.status(403).json({ error: "Origen no permitido." });
    }

    const payload = await getPayload(req, contentType);
    await sendContactEmail(payload);
    return res.status(200).json({ ok: true });
  } catch (error) {
    if (!error.statusCode || error.statusCode >= 500) {
      console.error(error);
    }
    return res.status(error.statusCode || 500).json({
      error: error.publicMessage || "No se ha podido enviar el formulario.",
    });
  }
};

const CONTACT_BODY_LIMIT_BYTES = 24 * 1024;

function setApiSecurityHeaders(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

async function getPayload(req, contentType) {
  if (typeof req.body === "string") {
    return parseBody(req.body, contentType);
  }

  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  return readBody(req, contentType);
}

function readBody(req, contentType) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > CONTACT_BODY_LIMIT_BYTES) {
        const error = new Error("Payload demasiado grande.");
        error.statusCode = 413;
        error.publicMessage = "El formulario es demasiado largo.";
        reject(error);
        req.destroy(error);
      }
    });

    req.on("end", () => {
      try {
        resolve(parseBody(body, contentType));
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
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
