const header = document.querySelector("[data-header]");
const navToggle = document.querySelector("[data-nav-toggle]");
const navMenu = document.querySelector("[data-nav-menu]");
const leadForm = document.querySelector("[data-lead-form]");
const feedback = document.querySelector("[data-form-feedback]");

function setHeaderState() {
  header?.classList.toggle("is-scrolled", window.scrollY > 12);
}

setHeaderState();
window.addEventListener("scroll", setHeaderState, { passive: true });

navToggle?.addEventListener("click", () => {
  const isOpen = navMenu.classList.toggle("is-open");
  document.body.classList.toggle("menu-open", isOpen);
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

navMenu?.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) {
    navMenu.classList.remove("is-open");
    document.body.classList.remove("menu-open");
    navToggle?.setAttribute("aria-expanded", "false");
  }
});

const revealItems = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

function formValue(formData, key) {
  return String(formData.get(key) || "").trim();
}

leadForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!leadForm.checkValidity()) {
    feedback.textContent = "Preencha os campos obrigatórios para iniciar a análise.";
    feedback.classList.add("is-error");
    leadForm.reportValidity();
    return;
  }

  const data = new FormData(leadForm);
  const payload = {
    nome: formValue(data, "nome"),
    email: formValue(data, "email"),
    telefone: formValue(data, "telefone"),
    perfil: formValue(data, "perfil"),
    processo: formValue(data, "processo"),
    tribunal: formValue(data, "tribunal"),
    advogado: formValue(data, "advogado") || "Não informado",
    valor: formValue(data, "valor") || "Não informado",
  };

  const subject = encodeURIComponent(`Análise inicial OrddO - ${payload.processo}`);
  const body = encodeURIComponent(
    [
      "Olá, OrddO.",
      "",
      "Gostaria de iniciar uma análise inicial de elegibilidade.",
      "",
      `Nome: ${payload.nome}`,
      `E-mail: ${payload.email}`,
      `Telefone: ${payload.telefone}`,
      `Perfil: ${payload.perfil}`,
      `Número do processo: ${payload.processo}`,
      `Tribunal/estado: ${payload.tribunal}`,
      `Advogado: ${payload.advogado}`,
      `Valor aproximado: ${payload.valor}`,
      "",
      "Declaro que autorizei contato para esta análise inicial.",
    ].join("\n")
  );

  feedback.textContent =
    "Perfeito. Abrindo o envio por e-mail com os dados informados.";
  feedback.classList.remove("is-error");

  window.location.href = `mailto:contato@orddo.com.br?subject=${subject}&body=${body}`;
});
