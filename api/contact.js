const { sendContactEmail } = require("../lib/resend-contact");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Metodo no permitido." });
  }

  try {
    const payload =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || (await readJsonBody(req));
    await sendContactEmail(payload);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || 500).json({
      error: error.publicMessage || "No se ha podido enviar el formulario.",
    });
  }
};

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Payload demasiado grande."));
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}
