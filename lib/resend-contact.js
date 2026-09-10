const RESEND_ENDPOINT = "https://api.resend.com/emails";
const TO_EMAIL = "info@luciernagasweddings.com";

function clean(value) {
  return String(value || "").trim();
}

function cleanLimited(value, maxLength) {
  return clean(value).slice(0, maxLength);
}

function escapeHtml(value) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function validateContactPayload(payload = {}) {
  const nombre = cleanLimited(payload.nombre, 100);
  const email = cleanLimited(payload.email, 254).toLowerCase();
  const fecha = cleanLimited(payload.fecha, 80);
  const mensaje = cleanLimited(payload.mensaje, 4000);
  const website = clean(payload.website);
  const privacidad = clean(payload.privacidad);

  if (website) {
    const error = new Error("Honeypot completado.");
    error.statusCode = 400;
    error.publicMessage = "No se ha podido enviar el formulario.";
    throw error;
  }

  if (!nombre || !email || !fecha || !mensaje) {
    const error = new Error("Faltan campos obligatorios.");
    error.statusCode = 400;
    error.publicMessage = "Completa nombre, email, fecha prevista y mensaje.";
    throw error;
  }

  if (!privacidad) {
    const error = new Error("Informacion de privacidad no confirmada.");
    error.statusCode = 400;
    error.publicMessage = "Confirma que has leido la informacion sobre proteccion de datos.";
    throw error;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const error = new Error("Email no valido.");
    error.statusCode = 400;
    error.publicMessage = "Introduce un email valido.";
    throw error;
  }

  if (mensaje.length < 10) {
    const error = new Error("Mensaje demasiado breve.");
    error.statusCode = 400;
    error.publicMessage = "Cuentanos un poco mas para poder responderos bien.";
    throw error;
  }

  return { nombre, email, fecha, mensaje };
}

async function sendContactEmail(payload) {
  const data = validateContactPayload(payload);
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || apiKey.includes("pon-aqui")) {
    const error = new Error("RESEND_API_KEY no configurada.");
    error.statusCode = 500;
    error.publicMessage = "El envio aun no esta configurado.";
    throw error;
  }

  const subject = `Nueva consulta de ${data.nombre} - Luciernagas Weddings`;
  const html = `
    <h1>Nueva consulta desde la web</h1>
    <p><strong>Nombre del cliente:</strong> ${escapeHtml(data.nombre)}</p>
    <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
    <p><strong>Fecha prevista:</strong> ${escapeHtml(data.fecha)}</p>
    <p><strong>Mensaje:</strong></p>
    <p>${escapeHtml(data.mensaje).replace(/\n/g, "<br>")}</p>
  `;
  const text = [
    "Nueva consulta desde la web",
    "",
    `Nombre del cliente: ${data.nombre}`,
    `Email: ${data.email}`,
    `Fecha prevista: ${data.fecha}`,
    "",
    "Mensaje:",
    data.mensaje,
  ].join("\n");

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "LuciernagasWeddings/1.0",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "Luciernagas Weddings <noreply@luciernagasweddings.com>",
      to: [TO_EMAIL],
      reply_to: data.email,
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    const error = new Error(`Resend error: ${details}`);
    error.statusCode = 502;
    error.publicMessage = "No se ha podido enviar el email ahora mismo.";
    throw error;
  }
}

module.exports = {
  sendContactEmail,
  validateContactPayload,
};
