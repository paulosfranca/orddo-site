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

function formChecked(formData, key) {
  return formData.get(key) === "on";
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function isValidBrazilianPhone(value) {
  const digits = onlyDigits(value);
  return digits.length === 10 || digits.length === 11;
}

function isValidCnj(value) {
  return /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/.test(String(value || "").trim());
}

function validatePayload(payload) {
  if (!isValidEmail(payload.email)) {
    return "Informe um e-mail válido.";
  }

  if (!isValidBrazilianPhone(payload.telefone)) {
    return "Informe um telefone válido com DDD.";
  }

  if (!isValidCnj(payload.numero_cnj)) {
    return "Informe o número do processo no formato 0000000-00.0000.0.00.0000.";
  }

  return "";
}

function formatPhone(value) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCnj(value) {
  const digits = onlyDigits(value).slice(0, 20);
  const parts = [
    digits.slice(0, 7),
    digits.slice(7, 9),
    digits.slice(9, 13),
    digits.slice(13, 14),
    digits.slice(14, 16),
    digits.slice(16, 20),
  ];

  let formatted = parts[0];
  if (parts[1]) formatted += `-${parts[1]}`;
  if (parts[2]) formatted += `.${parts[2]}`;
  if (parts[3]) formatted += `.${parts[3]}`;
  if (parts[4]) formatted += `.${parts[4]}`;
  if (parts[5]) formatted += `.${parts[5]}`;
  return formatted;
}

function applyInputMask(input, formatter) {
  input?.addEventListener("input", () => {
    input.value = formatter(input.value);
  });
}

function buildMailtoUrl(payload) {
  const subject = encodeURIComponent(`Análise inicial OrddO - ${payload.numero_cnj}`);
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
      `Número do processo: ${payload.numero_cnj}`,
      `Tribunal/estado: ${payload.tribunal}`,
      `Advogado: ${payload.advogado_informado || "Não informado"}`,
      `Valor aproximado: ${payload.valor_informado || "Não informado"}`,
      "",
      "Declaro que autorizei contato para esta análise inicial.",
    ].join("\n")
  );

  return `mailto:contato@orddo.com.br?subject=${subject}&body=${body}`;
}

function setFormLoading(isLoading) {
  const submit = leadForm?.querySelector(".form-submit");
  if (submit instanceof HTMLButtonElement) {
    submit.disabled = isLoading;
    submit.textContent = isLoading ? "Enviando..." : "Iniciar análise gratuita";
  }
}

async function sendLead(endpoint, payload) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Falha no envio: ${response.status}`);
  }

  return response;
}

applyInputMask(document.querySelector("#telefone"), formatPhone);
applyInputMask(document.querySelector("#processo"), formatCnj);

leadForm?.addEventListener("submit", async (event) => {
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
    numero_cnj: formValue(data, "processo"),
    tribunal: formValue(data, "tribunal"),
    advogado_informado: formValue(data, "advogado"),
    valor_informado: formValue(data, "valor"),
    consentimento_contato: formChecked(data, "contato"),
    aceite_privacidade: formChecked(data, "privacidade"),
    canal: "site",
    origem: "inbound",
    status: "novo",
  };

  const validationError = validatePayload(payload);
  if (validationError) {
    feedback.textContent = validationError;
    feedback.classList.add("is-error");
    return;
  }

  const endpoint = leadForm.dataset.endpoint?.trim();

  if (!endpoint) {
    feedback.textContent =
      "Perfeito. Abrindo o envio por e-mail com os dados informados.";
    feedback.classList.remove("is-error");
    window.location.href = buildMailtoUrl(payload);
    return;
  }

  try {
    setFormLoading(true);
    feedback.textContent = "Enviando seus dados para análise inicial...";
    feedback.classList.remove("is-error");

    await sendLead(endpoint, payload);

    feedback.textContent =
      "Recebemos sua solicitação. Nossa equipe fará a triagem inicial e retornará pelos contatos informados.";
    feedback.classList.remove("is-error");
    leadForm.reset();
  } catch (error) {
    feedback.textContent =
      "Não conseguimos concluir o envio automático. Vamos abrir o e-mail com os dados preenchidos.";
    feedback.classList.add("is-error");
    window.location.href = buildMailtoUrl(payload);
  } finally {
    setFormLoading(false);
  }
});
