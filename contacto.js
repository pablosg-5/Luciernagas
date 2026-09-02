const contactForm = document.querySelector(".contact-form");
const formStatus = document.querySelector(".form-status");

if (contactForm && formStatus) {
  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = contactForm.querySelector('button[type="submit"]');
    const formData = new FormData(contactForm);
    const payload = Object.fromEntries(formData.entries());

    formStatus.textContent = "";
    formStatus.className = "form-status";
    submitButton.disabled = true;
    submitButton.textContent = "Enviando...";

    try {
      const response = await fetch(contactForm.action, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "No se ha podido enviar el formulario.");
      }

      contactForm.reset();
      formStatus.textContent = "Consulta enviada. Lucía os responderá muy pronto.";
      formStatus.classList.add("success");
    } catch (error) {
      formStatus.textContent =
        error.message || "Ha ocurrido un error. Inténtalo de nuevo en unos minutos.";
      formStatus.classList.add("error");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Enviar consulta";
    }
  });
}
