const siteHeader = document.querySelector(".site-header");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function updateHeaderBrand() {
  if (!siteHeader) {
    return;
  }

  if (siteHeader.classList.contains("brand-always-visible")) {
    siteHeader.classList.remove("at-top");
    return;
  }

  siteHeader.classList.toggle("at-top", window.scrollY < 12);
}

function revealContent() {
  const revealItems = document.querySelectorAll("[data-reveal]");

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      rootMargin: "0px 0px -12% 0px",
      threshold: 0.18,
    },
  );

  revealItems.forEach((item) => observer.observe(item));
}

function enableParallax() {
  if (reduceMotion) {
    return;
  }

  const parallaxItems = document.querySelectorAll("[data-parallax]");
  let ticking = false;

  function update() {
    const viewportHeight = window.innerHeight || 1;

    parallaxItems.forEach((item) => {
      const rect = item.getBoundingClientRect();
      const progress = (rect.top + rect.height * 0.5 - viewportHeight * 0.5) / viewportHeight;
      const offset = Math.max(-18, Math.min(18, progress * -18));
      item.style.setProperty("--parallax-y", `${offset}px`);
    });

    ticking = false;
  }

  function requestUpdate() {
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  }

  update();
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
}

updateHeaderBrand();
revealContent();
enableParallax();
window.addEventListener("scroll", updateHeaderBrand, { passive: true });
