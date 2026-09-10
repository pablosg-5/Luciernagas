const siteHeader = document.querySelector(".site-header");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.documentElement.classList.add("js");

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

function enableTestimonials() {
  const testimonialItems = [...document.querySelectorAll("[data-testimonial-group]")];
  const previousButton = document.querySelector("[data-testimonial-prev]");
  const nextButton = document.querySelector("[data-testimonial-next]");

  if (!testimonialItems.length || !previousButton || !nextButton) {
    return;
  }

  const groups = [...new Set(testimonialItems.map((item) => item.dataset.testimonialGroup))];
  const mobileTestimonials = window.matchMedia("(max-width: 560px)");
  let activeIndex = 0;

  function showGroup(index) {
    activeIndex = (index + groups.length) % groups.length;
    const activeGroup = groups[activeIndex];
    const visibleLimit = mobileTestimonials.matches ? 2 : 4;
    const activeItems = testimonialItems.filter((item) => item.dataset.testimonialGroup === activeGroup);

    testimonialItems.forEach((item) => {
      const isActive = item.dataset.testimonialGroup === activeGroup && activeItems.indexOf(item) < visibleLimit;
      item.hidden = !isActive;
      item.classList.toggle("is-active", isActive);
    });
  }

  previousButton.addEventListener("click", () => showGroup(activeIndex - 1));
  nextButton.addEventListener("click", () => showGroup(activeIndex + 1));
  mobileTestimonials.addEventListener("change", () => showGroup(activeIndex));
  showGroup(0);
}

function enableServiceDropdown() {
  const dropdowns = [...document.querySelectorAll(".nav-dropdown")];

  if (!dropdowns.length) {
    return;
  }

  function closeDropdown(dropdown) {
    const trigger = dropdown.querySelector(".nav-dropdown-trigger");
    dropdown.classList.remove("is-open");
    if (trigger) {
      trigger.setAttribute("aria-expanded", "false");
    }
  }

  function closeAllDropdowns(exceptDropdown) {
    dropdowns.forEach((dropdown) => {
      if (dropdown !== exceptDropdown) {
        closeDropdown(dropdown);
      }
    });
  }

  dropdowns.forEach((dropdown) => {
    const trigger = dropdown.querySelector(".nav-dropdown-trigger");
    const submenuLinks = dropdown.querySelectorAll(".nav-submenu a");

    if (!trigger) {
      return;
    }

    trigger.setAttribute("aria-expanded", "false");

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = !dropdown.classList.contains("is-open");
      closeAllDropdowns(dropdown);
      dropdown.classList.toggle("is-open", willOpen);
      trigger.setAttribute("aria-expanded", String(willOpen));
    });

    submenuLinks.forEach((link) => {
      link.addEventListener("click", () => closeDropdown(dropdown));
    });
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".nav-dropdown")) {
      closeAllDropdowns();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllDropdowns();
    }
  });
}

updateHeaderBrand();
revealContent();
enableParallax();
enableTestimonials();
enableServiceDropdown();
window.addEventListener("scroll", updateHeaderBrand, { passive: true });
