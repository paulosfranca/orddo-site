// Marca que o JS está ativo (habilita as animações de reveal).
document.documentElement.classList.add("js");

// ── Demo do produto em ação ───────────────────────────────────────
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const FLOW_LABELS = [
  "Visão executiva",
  "Sinais jurídicos",
  "Cenários",
  "Alocação",
];

const JOURNEY_DURATION = 18;

function initProductDemo(demo) {
  let active = 0;
  let timer = null;
  const steps = [...demo.querySelectorAll("[data-flow-index]")];
  const label = demo.querySelector("[data-flow-label]");
  let renderer = null;

  const select = (index, syncedByCanvas = false) => {
    active = index;
    steps.forEach((step) => {
      step.classList.toggle("is-active", Number(step.dataset.flowIndex) === active);
    });
    if (label) label.textContent = FLOW_LABELS[active];
    if (!syncedByCanvas) renderer?.setActive(active);
    demo.classList.add("built");
  };

  renderer = initIntelCanvas(demo.querySelector("[data-intel-canvas]"), (index) => select(index, true));

  steps.forEach((step) => {
    step.addEventListener("click", () => {
      if (timer) window.clearInterval(timer);
      timer = null;
      select(Number(step.dataset.flowIndex || 0));
    });
  });

  if (steps.length) {
    demo.addEventListener("mouseenter", () => {
      if (timer) window.clearInterval(timer);
      timer = null;
    });
  }

  select(0);
  if (!reduceMotion && steps.length) {
    timer = window.setInterval(() => select((active + 1) % FLOW_LABELS.length), 2200);
  }
}

function initIntelCanvas(canvas, onStageChange) {
  if (!canvas) return null;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return null;
  const board = canvas.closest(".intel-board");

  let width = 1;
  let height = 1;
  let active = 0;
  let visualActive = 0;
  let raf = 0;
  let startTime = 0;
  let lastFrameTime = 0;
  let announcedStage = -1;
  let lastAnnouncementTime = 0;

  const colors = {
    cream: "244,238,231",
    muted: "205,191,178",
    gold: "198,161,91",
    gold2: "217,189,131",
    wine: "106,32,50",
    ink: "8,5,6",
  };
  const cases = [
    [0.16, 0.34, 0.34, 0], [0.24, 0.62, 0.52, 1], [0.38, 0.44, 0.48, 2],
    [0.56, 0.30, 0.62, 3], [0.68, 0.56, 0.74, 4], [0.76, 0.38, 0.91, 5],
    [0.84, 0.66, 0.58, 6], [0.62, 0.72, 0.45, 7], [0.46, 0.64, 0.69, 8],
  ];

  const rgba = (name, alpha) => `rgba(${colors[name]},${alpha})`;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - 2 * t);
  const pulse = (time, offset = 0) => 0.5 + Math.sin(time + offset) * 0.5;
  const stageIndex = (progress) => clamp(Math.floor(progress * FLOW_LABELS.length), 0, FLOW_LABELS.length - 1);
  const stageLocal = (progress) => (progress * FLOW_LABELS.length) % 1;
  const focus = (index) => 0.28 + 0.72 * Math.max(0, 1 - Math.abs(visualActive - index) * 0.5);

  function resize() {
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    const area = cssWidth * cssHeight;
    const dprCap = area > 1200000 ? 1.75 : 2;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    const nextWidth = Math.max(1, Math.floor(cssWidth * dpr));
    const nextHeight = Math.max(1, Math.floor(cssHeight * dpr));
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    width = cssWidth;
    height = cssHeight;
  }

  function roundedRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function glowLine(x1, y1, x2, y2, color, alpha, lineWidth = 1) {
    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
    gradient.addColorStop(0, rgba(color, 0));
    gradient.addColorStop(0.45, rgba(color, alpha));
    gradient.addColorStop(1, rgba(color, 0));
    ctx.strokeStyle = gradient;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function glowCurve(x1, y1, cx, cy, x2, y2, color, alpha, lineWidth = 1) {
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cx, cy, x2, y2);
    ctx.stroke();
  }

  function layout() {
    const mobile = width < 680;
    return {
      mobile,
      docX: mobile ? width * 0.22 : width * 0.14,
      docY: mobile ? height * 0.22 : height * 0.38,
      lensX: mobile ? width * 0.50 : width * 0.43,
      lensY: mobile ? height * 0.39 : height * 0.50,
      lensR: clamp(Math.min(width, height) * (mobile ? 0.15 : 0.16), 78, 138),
      mapX: mobile ? width * 0.50 : width * 0.72,
      mapY: mobile ? height * 0.67 : height * 0.47,
      mapW: mobile ? width * 0.78 : clamp(width * 0.30, 300, 440),
      mapH: mobile ? height * 0.26 : clamp(height * 0.50, 300, 430),
    };
  }

  function drawBackground(time, l) {
    const g = ctx.createLinearGradient(0, 0, width, height);
    g.addColorStop(0, "#1a1113");
    g.addColorStop(0.52, "#080506");
    g.addColorStop(1, "#120d0f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(l.lensX, l.lensY, 0, l.lensX, l.lensY, Math.max(width, height) * 0.54);
    glow.addColorStop(0, rgba("gold2", 0.18 + pulse(time * 0.8) * 0.04));
    glow.addColorStop(0.34, rgba("wine", 0.11));
    glow.addColorStop(1, rgba("ink", 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    glowLine(width * 0.08, height * 0.72, width * 0.92, height * 0.27, "gold2", 0.08, 1.4);
    glowLine(width * 0.10, height * 0.28, width * 0.88, height * 0.70, "wine", 0.06, 1);
    ctx.restore();
  }

  function drawDocument(x, y, scale, rotation, hotLine, alpha) {
    const w = 92 * scale;
    const h = 122 * scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.globalAlpha = alpha;
    ctx.shadowColor = "rgba(0,0,0,0.38)";
    ctx.shadowBlur = 26 * scale;
    ctx.shadowOffsetY = 14 * scale;
    roundedRect(-w / 2, -h / 2, w, h, 10 * scale);
    const paper = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    paper.addColorStop(0, "rgba(244,238,231,0.82)");
    paper.addColorStop(1, "rgba(205,191,178,0.48)");
    ctx.fillStyle = paper;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(244,238,231,0.18)";
    ctx.stroke();
    for (let i = 0; i < 7; i += 1) {
      const yy = -h * 0.28 + i * h * 0.085;
      const lineW = w * (0.34 + ((i * 19) % 36) / 100);
      roundedRect(-w * 0.31, yy, lineW, 3 * scale, 99);
      ctx.fillStyle = i === hotLine ? rgba("gold2", 0.72) : "rgba(23,15,17,0.22)";
      ctx.fill();
    }
    ctx.restore();
  }

  function drawDocuments(time, l) {
    const scale = clamp(width / 1060, 0.76, 1.08);
    const opacity = 0.48 + focus(0) * 0.46;
    drawDocument(l.docX - 18 * scale, l.docY - 36 * scale, scale, -0.13, 2, opacity * 0.62);
    drawDocument(l.docX + 18 * scale, l.docY + 2 * scale, scale, 0.06, 4, opacity * 0.78);
    drawDocument(l.docX - 28 * scale, l.docY + 46 * scale, scale, -0.04, 5, opacity);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const scanY = l.docY - 80 * scale + ((time * 42) % (160 * scale));
    glowLine(l.docX - 84 * scale, scanY, l.docX + 86 * scale, scanY, "gold2", 0.36 + focus(1) * 0.22, 1.4);
    for (let i = 0; i < 12; i += 1) {
      const yy = l.docY - 68 * scale + i * 12 * scale;
      const isHot = i === 3 || i === 7 || i === 9;
      ctx.fillStyle = isHot ? rgba("gold2", 0.5 + pulse(time * 2.2, i) * 0.22) : rgba("cream", 0.08);
      ctx.beginPath();
      ctx.arc(l.docX + 72 * scale + Math.sin(time + i) * 4, yy, isHot ? 2.6 : 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function curvePoint(a, b, c, t) {
    const q = ease(t);
    return {
      x: (1 - q) * (1 - q) * a.x + 2 * (1 - q) * q * b.x + q * q * c.x,
      y: (1 - q) * (1 - q) * a.y + 2 * (1 - q) * q * b.y + q * q * c.y,
    };
  }

  function drawSignalStreams(time, l) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const start = { x: l.docX + (l.mobile ? 72 : 104), y: l.docY + (l.mobile ? 34 : 16) };
    const end = { x: l.lensX, y: l.lensY };
    for (let i = 0; i < 9; i += 1) {
      const lift = (i - 4) * (l.mobile ? 11 : 17);
      const control = { x: (start.x + end.x) * 0.5, y: l.lensY + lift - Math.sin(time * 0.7 + i) * 9 };
      const alpha = 0.05 + focus(1) * 0.08 + (i % 3 === 0 ? 0.04 : 0);
      glowCurve(start.x, start.y + lift * 0.55, control.x, control.y, end.x, end.y + lift * 0.18, i % 3 === 0 ? "gold2" : "cream", alpha, 0.9);
      const p = (time * 0.13 + i * 0.12) % 1;
      const dot = curvePoint({ x: start.x, y: start.y + lift * 0.55 }, control, { x: end.x, y: end.y + lift * 0.18 }, p);
      const dotAlpha = Math.sin(p * Math.PI) * (0.22 + focus(1) * 0.36);
      ctx.fillStyle = i % 3 === 0 ? rgba("gold2", dotAlpha) : rgba("cream", dotAlpha * 0.82);
      ctx.shadowColor = rgba("gold2", dotAlpha);
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, i % 3 === 0 ? 2.8 : 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawLens(time, l) {
    ctx.save();
    ctx.translate(l.lensX, l.lensY);
    ctx.globalCompositeOperation = "lighter";
    const pulseSize = pulse(time * 1.8) * 9;
    for (let i = 0; i < 4; i += 1) {
      ctx.strokeStyle = i % 2 ? rgba("cream", 0.12 + focus(2) * 0.04) : rgba("gold2", 0.18 + focus(2) * 0.08);
      ctx.lineWidth = i === 0 ? 1.4 : 0.9;
      ctx.beginPath();
      ctx.arc(0, 0, l.lensR * (0.44 + i * 0.18) + pulseSize * (i === 1 ? 1 : 0.35), 0, Math.PI * 2);
      ctx.stroke();
    }
    glowLine(-l.lensR * 0.78, 0, l.lensR * 0.78, 0, "cream", 0.16, 1);
    glowLine(0, -l.lensR * 0.78, 0, l.lensR * 0.78, "gold2", 0.12, 1);
    for (let i = 0; i < 10; i += 1) {
      const angle = i * 0.63 + time * 0.18;
      const radius = l.lensR * (0.22 + (i % 4) * 0.14);
      ctx.fillStyle = i % 3 === 0 ? rgba("gold2", 0.68) : rgba("cream", 0.34);
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.62, 1.7 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, l.lensR * 0.48);
    core.addColorStop(0, rgba("gold2", 0.82));
    core.addColorStop(0.38, rgba("gold", 0.24));
    core.addColorStop(1, rgba("wine", 0));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, l.lensR * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPriorityMap(time, l) {
    const x0 = l.mapX - l.mapW * 0.5;
    const y0 = l.mapY - l.mapH * 0.5;
    const hotIndex = 5;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = rgba("cream", 0.055);
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const x = x0 + (l.mapW * i) / 4;
      glowLine(x, y0 + l.mapH * 0.10, x, y0 + l.mapH * 0.68, "cream", 0.035, 1);
    }
    for (let i = 0; i <= 3; i += 1) {
      const y = y0 + l.mapH * (0.10 + i * 0.19);
      glowLine(x0, y, x0 + l.mapW, y, "cream", 0.035, 1);
    }

    cases.forEach((item, i) => {
      const [rx, ry, score] = item;
      const x = x0 + rx * l.mapW;
      const y = y0 + ry * l.mapH;
      const hot = i === hotIndex;
      const radius = 3 + score * 5 + (hot ? pulse(time * 2.6) * 4 : pulse(time * 1.3, i) * 1.2);
      const alpha = hot ? 0.86 : 0.22 + score * 0.38;
      if (hot) {
        const halo = ctx.createRadialGradient(x, y, 0, x, y, radius * 8);
        halo.addColorStop(0, rgba("gold2", 0.28));
        halo.addColorStop(1, rgba("gold2", 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(x, y, radius * 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = hot ? rgba("gold2", alpha) : rgba("cream", alpha);
      ctx.shadowColor = rgba(hot ? "gold2" : "cream", alpha * 0.6);
      ctx.shadowBlur = hot ? 22 : 8;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.font = `${l.mobile ? 11 : 12}px 'Space Grotesk', sans-serif`;
    ctx.textAlign = "left";
    ctx.shadowBlur = 0;
    ctx.fillStyle = rgba("cream", 0.42);
    ctx.fillText("onde", x0 + l.mapW * 0.02, y0 + l.mapH * 0.06);
    ctx.fillStyle = rgba("gold2", 0.78);
    ctx.fillText("prioridade alta", x0 + l.mapW * 0.62, y0 + l.mapH * 0.23);
    ctx.restore();
  }

  function drawAllocation(time, l) {
    const x0 = l.mapX - l.mapW * 0.5;
    const y0 = l.mapY + l.mapH * (l.mobile ? 0.10 : 0.12);
    const w = l.mapW * (l.mobile ? 0.84 : 0.42);
    const barH = l.mobile ? 8 : 9;
    const values = [0.78, 0.54, 0.34];
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.font = `${l.mobile ? 11 : 12}px 'Space Grotesk', sans-serif`;
    ctx.fillStyle = rgba("cream", 0.42);
    ctx.fillText("como", x0 + l.mapW * 0.02, y0 - 18);
    values.forEach((value, i) => {
      const y = y0 + i * (barH + 13);
      roundedRect(x0 + l.mapW * 0.16, y, w, barH, 99);
      ctx.fillStyle = rgba("cream", 0.09);
      ctx.fill();
      roundedRect(x0 + l.mapW * 0.16, y, w * (value + Math.sin(time * 0.8 + i) * 0.025), barH, 99);
      ctx.fillStyle = i === 0 ? rgba("gold2", 0.78) : rgba("cream", 0.28);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x0 + l.mapW * (0.12 + i * 0.012), y + barH * 0.5, i === 0 ? 4 : 2.7, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? rgba("gold2", 0.82) : rgba("cream", 0.32);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawTimeline(time, l) {
    const x0 = l.mapX - l.mapW * 0.5;
    const y = l.mapY + l.mapH * (l.mobile ? 0.42 : 0.38);
    const start = x0 + l.mapW * 0.10;
    const end = x0 + l.mapW * 0.88;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.font = `${l.mobile ? 11 : 12}px 'Space Grotesk', sans-serif`;
    ctx.fillStyle = rgba("cream", 0.42);
    ctx.fillText("quando", x0 + l.mapW * 0.02, y - 24);
    glowLine(start, y, end, y, "cream", 0.10, 1);
    for (let i = 0; i < 5; i += 1) {
      const x = lerp(start, end, i / 4);
      const hot = i === 1;
      ctx.fillStyle = hot ? rgba("gold2", 0.88) : rgba("cream", 0.22);
      ctx.shadowColor = rgba("gold2", hot ? 0.74 : 0.16);
      ctx.shadowBlur = hot ? 18 : 4;
      ctx.beginPath();
      ctx.arc(x, y, hot ? 6 + pulse(time * 2.2) * 2 : 3, 0, Math.PI * 2);
      ctx.fill();
      if (hot) {
        ctx.fillStyle = rgba("gold2", 0.78);
        ctx.fillText("agora", x - 15, y + 25);
      }
    }
    ctx.restore();
  }

  function drawDecision(time, l) {
    const x = l.mobile ? l.mapX + l.mapW * 0.18 : l.mapX + l.mapW * 0.28;
    const y = l.mobile ? l.mapY - l.mapH * 0.35 : l.mapY - l.mapH * 0.30;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const ring = 48 + pulse(time * 1.3) * 7;
    ctx.strokeStyle = rgba("gold2", 0.42 + focus(6) * 0.18);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(x, y, ring, -Math.PI * 0.78, Math.PI * 0.54);
    ctx.stroke();
    ctx.font = `700 ${l.mobile ? 44 : 58}px 'Inter Tight', sans-serif`;
    ctx.fillStyle = rgba("cream", 0.92);
    ctx.fillText("87", x - 32, y + 18);
    ctx.font = `${l.mobile ? 11 : 12}px 'Space Grotesk', sans-serif`;
    ctx.fillStyle = rgba("gold2", 0.78);
    ctx.fillText("prioridade", x + (l.mobile ? 30 : 42), y + 8);
    ctx.restore();
  }

  function drawDecisionStreams(time, l) {
    const start = { x: l.lensX + l.lensR * 0.62, y: l.lensY };
    const end = { x: l.mapX - l.mapW * 0.36, y: l.mapY - l.mapH * 0.18 };
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 8; i += 1) {
      const offset = (i - 3.5) * (l.mobile ? 8 : 13);
      const control = { x: lerp(start.x, end.x, 0.52), y: l.mobile ? lerp(start.y, end.y, 0.46) + offset : start.y + offset * 0.8 };
      glowCurve(start.x, start.y + offset * 0.38, control.x, control.y, end.x, end.y + offset, i % 3 === 0 ? "gold2" : "cream", 0.08 + focus(2) * 0.05, 1);
      const p = (time * 0.10 + i * 0.14) % 1;
      const dot = curvePoint({ x: start.x, y: start.y + offset * 0.38 }, control, { x: end.x, y: end.y + offset }, p);
      const a = Math.sin(p * Math.PI) * 0.34;
      ctx.fillStyle = i % 3 === 0 ? rgba("gold2", a) : rgba("cream", a * 0.7);
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, i % 3 === 0 ? 2.6 : 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawClarityWave(time, l) {
    const spread = (time * 0.18) % 1;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = rgba("gold2", (1 - spread) * 0.26);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(l.lensX, l.lensY, l.lensR * (0.72 + spread * 1.2), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawSimpleBackground(time) {
    const g = ctx.createLinearGradient(0, 0, width, height);
    g.addColorStop(0, "#1a1113");
    g.addColorStop(0.50, "#080506");
    g.addColorStop(1, "#120b0e");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    const bloom = ctx.createRadialGradient(width * 0.54, height * 0.46, 0, width * 0.54, height * 0.46, Math.max(width, height) * 0.56);
    bloom.addColorStop(0, rgba("gold2", 0.012 + pulse(time * 0.7) * 0.004));
    bloom.addColorStop(0.38, rgba("wine", 0.025));
    bloom.addColorStop(1, rgba("ink", 0));
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, width, height);
  }

  function drawSimpleDocumentStack(time, mobile) {
    const scale = mobile ? 0.64 : clamp(width / 1220, 0.82, 1.08);
    const x = mobile ? width * 0.22 : width * 0.15;
    const y = mobile ? height * 0.18 : height * 0.50;
    const opacity = mobile ? 0.34 : 0.58;
    drawDocument(x - 28 * scale, y - 42 * scale, scale * 0.98, -0.16, 3, opacity * 0.58);
    drawDocument(x + 18 * scale, y - 10 * scale, scale * 1.04, 0.055, 5, opacity * 0.86);
    drawDocument(x - 34 * scale, y + 48 * scale, scale, -0.045, 1, opacity * 0.78);

    const scanY = y - 78 * scale + ((time * 22) % (152 * scale));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    glowLine(x - 86 * scale, scanY, x + 92 * scale, scanY, "gold2", 0.18, 1);
    for (let i = 0; i < 5; i += 1) {
      const yy = y - 54 * scale + i * 22 * scale;
      const read = pulse(time * 1.1, i * 0.9);
      ctx.fillStyle = rgba(i === 2 ? "gold2" : "cream", 0.10 + read * 0.18);
      roundedRect(x + 42 * scale, yy, (42 + read * 42) * scale, 3 * scale, 99);
      ctx.fill();
    }
    ctx.restore();
  }

  function dataEntryPoint(time, stage, phase, panelX, panelY, panelW, panelH, mobile) {
    const points = mobile
      ? [[0.10, 0.30], [0.12, 0.40], [0.18, 0.49], [0.34, 0.78]]
      : [[0.03, 0.34], [0.07, 0.42], [0.13, 0.50], [0.34, 0.78]];
    const current = points[stage % points.length];
    const next = points[(stage + 1) % points.length];
    const travel = ease(clamp((phase - 0.12) / 0.76, 0, 1));
    const drift = mobile ? 2.5 : 4;
    return {
      x: panelX + panelW * lerp(current[0], next[0], travel) + Math.sin(time * 1.8) * drift,
      y: panelY + panelH * lerp(current[1], next[1], travel) + Math.cos(time * 1.4) * drift * 0.55,
      intensity: clamp(0.32 + ease(clamp(phase * 1.28, 0, 1)) * 0.52 + pulse(time * 2.4) * 0.14, 0, 1),
    };
  }

  function syncEntryPulse(time, stage, phase, panelX, panelY, panelW, panelH, mobile) {
    if (!board) return null;
    const point = dataEntryPoint(time, stage, phase, panelX, panelY, panelW, panelH, mobile);
    const entry = point.intensity * (stage >= 1 ? 1 : 0.78);
    board.style.setProperty("--entry-x", `${point.x}px`);
    board.style.setProperty("--entry-y", `${point.y}px`);
    board.style.setProperty("--entry-opacity", `${clamp(entry * 0.58, 0.12, 0.48)}`);
    board.style.setProperty("--entry-scale", `${0.72 + entry * 0.26 + pulse(time * 4.1) * 0.05}`);
    board.style.setProperty("--entry-ring", `${1 + entry * 0.5 + pulse(time * 3.6) * 0.18}`);
    return point;
  }

  function drawProcessingLayers(time, stage, phase, mobile, panelX, panelY, panelW, panelH, entry) {
    const originX = mobile ? width * 0.25 : width * 0.17;
    const originY = mobile ? height * 0.18 : height * 0.50;
    const hubX = mobile ? panelX + panelW * 0.32 : panelX - width * 0.10;
    const hubY = mobile ? panelY - height * 0.02 : panelY + panelH * 0.42;
    const entryX = entry?.x ?? panelX + panelW * 0.08;
    const entryY = entry?.y ?? panelY + panelH * 0.44;
    const stageEnergy = 0.34 + stage * 0.12 + pulse(time * 1.25) * 0.06;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const ribbon = ctx.createLinearGradient(originX + 90, originY, entryX, entryY);
    ribbon.addColorStop(0, "rgba(244,238,231,0.02)");
    ribbon.addColorStop(0.42, `rgba(217,189,131,${0.10 + stageEnergy * 0.08})`);
    ribbon.addColorStop(1, "rgba(217,189,131,0.04)");
    ctx.strokeStyle = ribbon;
    ctx.lineWidth = mobile ? 18 : 26;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(originX + 88, originY);
    ctx.bezierCurveTo(originX + width * 0.08, originY - height * 0.08, hubX - width * 0.06, hubY, hubX, hubY);
    ctx.bezierCurveTo(hubX + width * 0.08, hubY, entryX - width * 0.08, entryY, entryX, entryY);
    ctx.stroke();

    for (let i = 0; i < 3; i += 1) {
      const offset = (i - 1) * (mobile ? 11 : 17);
      glowLine(originX + 88, originY + offset, hubX, hubY + offset * 0.25, i === 1 ? "gold2" : "cream", i === 1 ? 0.14 : 0.065, i === 1 ? 1.5 : 1);
      glowLine(hubX, hubY + offset * 0.25, entryX, entryY + offset * 0.18, "gold2", i === 1 ? 0.16 : 0.075, i === 1 ? 1.6 : 1);
    }

    const slabW = mobile ? panelW * 0.48 : 210;
    const slabH = mobile ? 118 : 170;
    ctx.save();
    ctx.translate(hubX, hubY);
    ctx.rotate(mobile ? 0.015 : -0.035);
    roundedRect(-slabW * 0.5, -slabH * 0.5, slabW, slabH, mobile ? 16 : 20);
    const slabGradient = ctx.createLinearGradient(-slabW * 0.5, -slabH * 0.5, slabW * 0.5, slabH * 0.5);
    slabGradient.addColorStop(0, "rgba(244,238,231,0.035)");
    slabGradient.addColorStop(0.48, "rgba(217,189,131,0.13)");
    slabGradient.addColorStop(1, "rgba(106,32,50,0.10)");
    ctx.fillStyle = slabGradient;
    ctx.fill();
    ctx.strokeStyle = rgba("gold2", 0.16 + stageEnergy * 0.06);
    ctx.stroke();

    for (let i = 0; i < 4; i += 1) {
      const rowY = -slabH * 0.30 + i * slabH * 0.18;
      const rowW = slabW * (0.36 + ease(clamp(stage + phase - i * 0.28, 0, 1)) * 0.34);
      roundedRect(-slabW * 0.34, rowY, rowW, mobile ? 3 : 4, 99);
      ctx.fillStyle = i === 2 ? rgba("gold2", 0.34) : rgba("cream", 0.15);
      ctx.fill();
    }
    for (let i = 0; i < 3; i += 1) {
      const ring = (time * 0.18 + i * 0.33) % 1;
      ctx.strokeStyle = rgba("gold2", Math.sin(ring * Math.PI) * 0.16);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(slabW * 0.24, 0, (mobile ? 18 : 26) + ring * (mobile ? 28 : 42), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(slabW * 0.24, 0, mobile ? 5 : 7, 0, Math.PI * 2);
    ctx.fillStyle = rgba("gold2", 0.58);
    ctx.fill();
    ctx.restore();

    for (let i = 0; i < 6; i += 1) {
      const t = (time * (mobile ? 0.07 : 0.09) + i / 6) % 1;
      const x = t < 0.55
        ? lerp(originX + 96, hubX, ease(t / 0.55))
        : lerp(hubX, entryX, ease((t - 0.55) / 0.45));
      const y = t < 0.55
        ? lerp(originY, hubY, ease(t / 0.55))
        : lerp(hubY, entryY, ease((t - 0.55) / 0.45));
      const alpha = Math.sin(t * Math.PI) * (i % 2 === 0 ? 0.42 : 0.24);
      roundedRect(x - (i % 2 === 0 ? 9 : 5), y - 2, i % 2 === 0 ? 18 : 10, 4, 99);
      ctx.fillStyle = i % 2 === 0 ? rgba("gold2", alpha) : rgba("cream", alpha);
      ctx.fill();
    }

    if (!mobile) {
      const shadowCount = 2;
      for (let i = 0; i < shadowCount; i += 1) {
        const depth = i + 1;
        const layerW = 154 + depth * 36;
        const layerH = 42 + depth * 8;
        const lx = hubX - layerW * 0.5 - depth * 18;
        const ly = hubY - layerH * 0.5 + depth * 34;
        const layerAlpha = 0.03 + depth * 0.02;
        ctx.save();
        ctx.translate(lx + layerW * 0.5, ly + layerH * 0.5);
        ctx.rotate(-0.045 + depth * 0.018);
        roundedRect(-layerW * 0.5, -layerH * 0.5, layerW, layerH, mobile ? 10 : 14);
        const layerGradient = ctx.createLinearGradient(-layerW * 0.5, -layerH * 0.5, layerW * 0.5, layerH * 0.5);
        layerGradient.addColorStop(0, `rgba(244,238,231,${layerAlpha * 0.45})`);
        layerGradient.addColorStop(0.52, `rgba(217,189,131,${layerAlpha * 0.9})`);
        layerGradient.addColorStop(1, `rgba(106,32,50,${layerAlpha})`);
        ctx.fillStyle = layerGradient;
        ctx.fill();
        ctx.strokeStyle = rgba("gold2", 0.06 + layerAlpha);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();
  }

  function drawPanelDepth(panelX, panelY, panelW, panelH, time, stage, mobile) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i += 1) {
      const depth = i + 1;
      const insetX = depth * (mobile ? 8 : 14);
      const insetY = depth * (mobile ? 6 : 10);
      const alpha = 0.025 + depth * 0.012 + (stage >= 2 ? 0.012 : 0);
      roundedRect(panelX - insetX, panelY - insetY, panelW + insetX * 2, panelH + insetY * 2, mobile ? 18 : 24);
      ctx.fillStyle = `rgba(244,238,231,${alpha})`;
      ctx.fill();
      ctx.strokeStyle = rgba(depth === 2 ? "gold2" : "cream", 0.035 + alpha);
      ctx.stroke();
    }
    const wash = ctx.createRadialGradient(panelX + panelW * 0.18, panelY + panelH * 0.42, 0, panelX + panelW * 0.18, panelY + panelH * 0.42, panelW * 0.72);
    wash.addColorStop(0, rgba("gold2", 0.11 + pulse(time * 1.2) * 0.025));
    wash.addColorStop(0.38, rgba("wine", 0.07));
    wash.addColorStop(1, rgba("ink", 0));
    ctx.fillStyle = wash;
    ctx.fillRect(panelX - panelW * 0.18, panelY - panelH * 0.15, panelW * 1.32, panelH * 1.3);
    ctx.restore();
  }

  function drawPriorityRows(x, y, w, h, time, stage, phase, mobile, entry) {
    const rows = [
      { name: "Carteira A", score: 87, bar: 0.88, hot: true },
      { name: "Carteira B", score: 62, bar: 0.62 },
      { name: "Carteira C", score: 41, bar: 0.41 },
      { name: "Carteira D", score: 29, bar: 0.29 },
    ];
    const rowH = h * (mobile ? 0.145 : 0.155);
    const gap = mobile ? 9 : 12;
    const startY = y + h * 0.20;
    rows.forEach((row, i) => {
      const yy = startY + i * (rowH + gap);
      const selected = row.hot ? clamp(0.45 + (stage <= 1 ? ease(phase) * 0.34 : 0.18) + pulse(time * 2.1) * 0.12, 0, 1) : 0;
      const hotGlow = row.hot ? 0.06 + selected * 0.11 : 0;
      roundedRect(x, yy, w, rowH, mobile ? 10 : 14);
      ctx.fillStyle = row.hot
        ? `rgba(217,189,131,${0.075 + hotGlow})`
        : "rgba(244,238,231,0.035)";
      ctx.fill();
      if (row.hot) {
        const sheen = ctx.createLinearGradient(x, yy, x + w, yy + rowH);
        sheen.addColorStop(0, `rgba(244,238,231,${0.03 * selected})`);
        sheen.addColorStop(0.4, `rgba(217,189,131,${0.13 * selected})`);
        sheen.addColorStop(1, "rgba(106,32,50,0.02)");
        ctx.fillStyle = sheen;
        ctx.fill();
      }
      ctx.strokeStyle = row.hot ? rgba("gold2", 0.18 + selected * 0.18) : rgba("cream", 0.075);
      ctx.stroke();

      ctx.font = `600 ${mobile ? 12 : 14}px 'Space Grotesk', sans-serif`;
      ctx.fillStyle = row.hot ? rgba("cream", 0.86) : rgba("cream", 0.46);
      ctx.fillText(row.name, x + w * 0.055, yy + rowH * 0.56);

      const barX = x + w * (mobile ? 0.34 : 0.31);
      const barY = yy + rowH * 0.44;
      const barW = w * (mobile ? 0.34 : 0.42);
      roundedRect(barX, barY, barW, 6, 99);
      ctx.fillStyle = "rgba(244,238,231,0.075)";
      ctx.fill();
      roundedRect(barX, barY, barW * (row.bar + (row.hot ? Math.sin(time * 0.8) * 0.015 : 0)), 6, 99);
      ctx.fillStyle = row.hot ? rgba("gold2", 0.78) : rgba("cream", 0.24);
      ctx.fill();

      ctx.font = `700 ${mobile ? 18 : 22}px 'Inter Tight', sans-serif`;
      ctx.textAlign = "right";
      ctx.fillStyle = row.hot ? rgba("gold2", 0.9) : rgba("cream", 0.32);
      ctx.fillText(String(row.score), x + w * 0.94, yy + rowH * 0.62);
      ctx.textAlign = "left";
    });

    if (entry && stage <= 2) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = rgba("gold2", 0.18 + entry.intensity * 0.24);
      ctx.lineWidth = mobile ? 1 : 1.4;
      ctx.beginPath();
      ctx.arc(entry.x, entry.y, 16 + entry.intensity * 20, 0, Math.PI * 2);
      ctx.stroke();
      glowLine(entry.x - w * 0.18, entry.y, entry.x + w * 0.22, entry.y, "gold2", 0.18, 1.2);
      ctx.restore();
    }

    if (stage >= 1) {
      const ringX = x + w * 0.91;
      const ringY = startY + rowH * 0.50;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = rgba("gold2", 0.44);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(ringX, ringY, 24 + pulse(time * 1.8) * 5, -Math.PI * 0.8, Math.PI * 0.55);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawDecisionTiles(x, y, w, time, stage, mobile) {
    const tiles = [
      ["ONDE", "Carteira A"],
      ["COMO", "Força-tarefa"],
      ["QUANDO", "Agora"],
    ];
    const gap = mobile ? 8 : 12;
    const tileW = (w - gap * 2) / 3;
    const tileH = mobile ? 70 : 88;
    tiles.forEach((tile, i) => {
      const xx = x + i * (tileW + gap);
      const activeTile = stage >= i + 1;
      roundedRect(xx, y, tileW, tileH, mobile ? 10 : 14);
      ctx.fillStyle = activeTile ? "rgba(244,238,231,0.055)" : "rgba(244,238,231,0.026)";
      ctx.fill();
      ctx.strokeStyle = activeTile ? rgba("gold2", 0.16) : rgba("cream", 0.055);
      ctx.stroke();
      ctx.font = `600 ${mobile ? 9 : 10}px 'Space Grotesk', sans-serif`;
      ctx.fillStyle = rgba("gold2", activeTile ? 0.74 : 0.36);
      ctx.fillText(tile[0], xx + tileW * 0.12, y + tileH * 0.34);
      ctx.font = `700 ${mobile ? 14 : 18}px 'Inter Tight', sans-serif`;
      ctx.fillStyle = rgba("cream", activeTile ? 0.86 : 0.42);
      ctx.fillText(tile[1], xx + tileW * 0.12, y + tileH * 0.66);
    });
  }

  function drawSimpleFlow(time, mobile, panelX, panelY, panelW, panelH) {
    if (mobile) return;
    const startX = width * 0.25;
    const startY = height * 0.50;
    const endX = panelX - 28;
    const endY = panelY + panelH * 0.42;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    glowLine(startX, startY, endX, endY, "gold2", 0.12, 1);
    for (let i = 0; i < 3; i += 1) {
      const t = (time * 0.12 + i * 0.33) % 1;
      const x = lerp(startX, endX, ease(t));
      const y = lerp(startY, endY, ease(t));
      const alpha = Math.sin(t * Math.PI) * 0.42;
      ctx.fillStyle = i === 0 ? rgba("gold2", alpha) : rgba("cream", alpha * 0.62);
      ctx.beginPath();
      ctx.arc(x, y, i === 0 ? 2.8 : 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawOpenedPortfolio(panelX, panelY, panelW, panelH, time, stage, phase, mobile, entry) {
    const open = stage < 2
      ? ease(clamp((stage + phase - 1.55) / 0.45, 0, 1)) * 0.46
      : ease(clamp(phase * 1.15, 0, 1));
    if (open <= 0) return;
    const x = mobile ? panelX + panelW * 0.08 : panelX + panelW * 0.38;
    const y = mobile ? panelY + panelH * 0.42 : panelY + panelH * 0.26;
    const w = mobile ? panelW * 0.84 : panelW * 0.54;
    const h = mobile ? panelH * 0.32 : panelH * 0.38;

    ctx.save();
    ctx.globalAlpha = open;
    ctx.globalCompositeOperation = "lighter";
    if (entry) {
      glowLine(entry.x, entry.y, x + w * 0.12, y + h * 0.18, "gold2", 0.18 * entry.intensity, 1.2);
      for (let i = 0; i < 5; i += 1) {
        const fly = (phase + i * 0.16) % 1;
        const px = lerp(entry.x, x + w * (0.18 + i * 0.12), ease(fly));
        const py = lerp(entry.y, y + h * (0.32 + (i % 3) * 0.16), ease(fly));
        const alpha = Math.sin(fly * Math.PI) * open * 0.48;
        ctx.fillStyle = i === 0 ? rgba("gold2", alpha) : rgba("cream", alpha * 0.68);
        ctx.beginPath();
        ctx.arc(px, py, i === 0 ? 2.5 : 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.translate(0, (1 - open) * (mobile ? 18 : 26));
    roundedRect(x, y, w, h, mobile ? 12 : 16);
    const glass = ctx.createLinearGradient(x, y, x + w, y + h);
    glass.addColorStop(0, "rgba(217,189,131,0.11)");
    glass.addColorStop(0.52, "rgba(244,238,231,0.045)");
    glass.addColorStop(1, "rgba(106,32,50,0.10)");
    ctx.fillStyle = glass;
    ctx.fill();
    ctx.strokeStyle = rgba("gold2", 0.24);
    ctx.stroke();

    ctx.font = `600 ${mobile ? 9 : 10}px 'Space Grotesk', sans-serif`;
    ctx.fillStyle = rgba("gold2", 0.76);
    ctx.fillText("carteira aberta", x + w * 0.07, y + h * 0.18);
    ctx.font = `800 ${mobile ? 22 : 30}px 'Inter Tight', sans-serif`;
    ctx.fillStyle = rgba("cream", 0.88);
    ctx.fillText("A / 87", x + w * 0.07, y + h * 0.38);

    const processes = [
      ["Proc. 1842", "execução", 0.86],
      ["Proc. 2207", "acordo", 0.64],
      ["Proc. 0916", "prazo", 0.48],
    ];
    processes.forEach((item, i) => {
      const rowY = y + h * (0.52 + i * 0.15);
      const rowOpen = ease(clamp(open * 1.35 - i * 0.20, 0, 1));
      roundedRect(x + w * 0.07, rowY, w * 0.72 * rowOpen, mobile ? 18 : 22, 8);
      ctx.fillStyle = i === 0 ? "rgba(217,189,131,0.12)" : "rgba(244,238,231,0.045)";
      ctx.fill();
      if (i === 0 && stage >= 2) {
        ctx.strokeStyle = rgba("gold2", 0.16 + pulse(time * 2.6) * 0.16);
        ctx.stroke();
      }
      ctx.font = `600 ${mobile ? 9 : 11}px 'Space Grotesk', sans-serif`;
      ctx.fillStyle = i === 0 ? rgba("cream", 0.84) : rgba("cream", 0.50);
      ctx.fillText(item[0], x + w * 0.10, rowY + (mobile ? 13 : 15));
      ctx.fillStyle = i === 0 ? rgba("gold2", 0.74) : rgba("cream", 0.34);
      ctx.fillText(item[1], x + w * 0.44, rowY + (mobile ? 13 : 15));
      ctx.beginPath();
      ctx.arc(x + w * (0.82 + item[2] * 0.08), rowY + (mobile ? 9 : 11), i === 0 ? 4 : 2.6, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? rgba("gold2", 0.86) : rgba("cream", 0.36);
      ctx.fill();
    });

    if (stage >= 2) {
      const actionPulse = pulse(time * 2.1);
      roundedRect(x + w * 0.68, y + h * 0.08, w * 0.24, mobile ? 24 : 28, 99);
      ctx.fillStyle = `rgba(217,189,131,${0.12 + actionPulse * 0.05})`;
      ctx.fill();
      ctx.strokeStyle = rgba("gold2", 0.28);
      ctx.stroke();
      ctx.font = `700 ${mobile ? 9 : 10}px 'Space Grotesk', sans-serif`;
      ctx.fillStyle = rgba("gold2", 0.82);
      ctx.fillText("ACIONAR", x + w * 0.72, y + h * 0.08 + (mobile ? 16 : 18));
    }
    ctx.restore();
  }

  function drawInstitutionalDocumentVeil(time, mobile) {
    const baseX = mobile ? width * 0.18 : width * 0.13;
    const baseY = mobile ? height * 0.17 : height * 0.48;
    const planeW = mobile ? width * 0.26 : width * 0.15;
    const planeH = mobile ? height * 0.20 : height * 0.34;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 4; i += 1) {
      const depth = i / 3;
      const x = baseX + i * (mobile ? 16 : 30);
      const y = baseY - planeH * 0.5 + i * (mobile ? 10 : 18);
      const tilt = mobile ? -0.04 + depth * 0.028 : -0.09 + depth * 0.045;
      const alpha = 0.035 + depth * 0.045;

      ctx.save();
      ctx.translate(x + planeW * 0.5, y + planeH * 0.5);
      ctx.rotate(tilt);
      roundedRect(-planeW * 0.5, -planeH * 0.5, planeW, planeH, mobile ? 10 : 14);
      const g = ctx.createLinearGradient(-planeW * 0.5, -planeH * 0.5, planeW * 0.5, planeH * 0.5);
      g.addColorStop(0, `rgba(244,238,231,${alpha * 0.55})`);
      g.addColorStop(0.62, `rgba(217,189,131,${alpha * 0.9})`);
      g.addColorStop(1, `rgba(106,32,50,${alpha * 0.75})`);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = rgba("cream", 0.045 + alpha);
      ctx.stroke();

      for (let j = 0; j < 5; j += 1) {
        const lineW = planeW * (0.30 + pulse(time * 0.5, i + j) * 0.42);
        roundedRect(-planeW * 0.34, -planeH * 0.25 + j * planeH * 0.12, lineW, 2.2, 99);
        ctx.fillStyle = j === 2 ? rgba("gold2", 0.12 + depth * 0.16) : rgba("cream", 0.08 + depth * 0.08);
        ctx.fill();
      }
      ctx.restore();
    }

    const scan = (time * 0.12) % 1;
    glowLine(baseX - planeW * 0.08, baseY - planeH * 0.42 + scan * planeH * 0.84, baseX + planeW * 1.52, baseY - planeH * 0.46 + scan * planeH * 0.84, "gold2", 0.12, 1);
    ctx.restore();
  }

  function drawDecisionLens(time, stage, mobile, lensX, lensY, lensH) {
    const lensW = mobile ? width * 0.46 : width * 0.18;
    const activity = 0.48 + stage * 0.10 + pulse(time * 0.9) * 0.08;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const lens = ctx.createRadialGradient(lensX, lensY, 0, lensX, lensY, lensH * 0.62);
    lens.addColorStop(0, rgba("gold2", 0.10 + activity * 0.06));
    lens.addColorStop(0.46, rgba("cream", 0.035));
    lens.addColorStop(1, rgba("ink", 0));
    ctx.fillStyle = lens;
    ctx.beginPath();
    ctx.ellipse(lensX, lensY, lensW * 0.52, lensH * 0.52, mobile ? 0.06 : -0.05, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 3; i += 1) {
      const ring = (time * 0.10 + i * 0.34) % 1;
      ctx.strokeStyle = rgba("gold2", Math.sin(ring * Math.PI) * (0.08 + activity * 0.05));
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(lensX, lensY, lensW * (0.22 + ring * 0.34), lensH * (0.15 + ring * 0.32), mobile ? 0.06 : -0.05, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = rgba("gold2", 0.18);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(lensX, lensY, lensW * 0.28, lensH * 0.34, mobile ? 0.06 : -0.05, -Math.PI * 0.55, Math.PI * 0.72);
    ctx.stroke();
    ctx.restore();
  }

  function drawDecisionRibbon(time, mobile, sourceX, sourceY, lensX, lensY, fieldX, fieldY, fieldW) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const endX = fieldX + fieldW * 0.10;
    const endY = fieldY;

    const ribbon = ctx.createLinearGradient(sourceX, sourceY, endX, endY);
    ribbon.addColorStop(0, "rgba(244,238,231,0.015)");
    ribbon.addColorStop(0.48, "rgba(217,189,131,0.16)");
    ribbon.addColorStop(1, "rgba(217,189,131,0.035)");
    ctx.strokeStyle = ribbon;
    ctx.lineWidth = mobile ? 18 : 30;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(sourceX, sourceY);
    ctx.bezierCurveTo(lensX - width * 0.15, sourceY - height * 0.08, lensX - width * 0.08, lensY, lensX, lensY);
    ctx.bezierCurveTo(lensX + width * 0.08, lensY, endX - width * 0.08, endY, endX, endY);
    ctx.stroke();

    for (let i = 0; i < 3; i += 1) {
      const offset = (i - 1) * (mobile ? 10 : 18);
      glowLine(sourceX, sourceY + offset, lensX, lensY + offset * 0.20, i === 1 ? "gold2" : "cream", i === 1 ? 0.14 : 0.055, i === 1 ? 1.4 : 1);
      glowLine(lensX, lensY + offset * 0.20, endX, endY + offset * 0.16, "gold2", i === 1 ? 0.16 : 0.06, i === 1 ? 1.5 : 1);
    }

    for (let i = 0; i < 5; i += 1) {
      const t = (time * 0.08 + i * 0.20) % 1;
      const mid = t < 0.52 ? t / 0.52 : (t - 0.52) / 0.48;
      const x = t < 0.52 ? lerp(sourceX, lensX, ease(mid)) : lerp(lensX, endX, ease(mid));
      const y = t < 0.52 ? lerp(sourceY, lensY, ease(mid)) : lerp(lensY, endY, ease(mid));
      const alpha = Math.sin(t * Math.PI) * (i === 0 ? 0.30 : 0.18);
      roundedRect(x - 10, y - 2, i === 0 ? 20 : 13, 4, 99);
      ctx.fillStyle = i === 0 ? rgba("gold2", alpha) : rgba("cream", alpha);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPriorityField(fieldX, fieldY, fieldW, fieldH, time, stage, phase, mobile) {
    ctx.save();
    const focusOpen = ease(clamp(stage + phase - 1.35, 0, 1));
    roundedRect(fieldX, fieldY - fieldH * 0.5, fieldW, fieldH, mobile ? 18 : 24);
    const fieldGradient = ctx.createLinearGradient(fieldX, fieldY - fieldH * 0.5, fieldX + fieldW, fieldY + fieldH * 0.5);
    fieldGradient.addColorStop(0, "rgba(244,238,231,0.030)");
    fieldGradient.addColorStop(0.46, "rgba(217,189,131,0.075)");
    fieldGradient.addColorStop(1, "rgba(106,32,50,0.13)");
    ctx.fillStyle = fieldGradient;
    ctx.fill();
    ctx.strokeStyle = rgba("cream", 0.07);
    ctx.stroke();

    ctx.save();
    roundedRect(fieldX, fieldY - fieldH * 0.5, fieldW, fieldH, mobile ? 18 : 24);
    ctx.clip();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 10; i += 1) {
      const y = fieldY - fieldH * 0.38 + i * fieldH * 0.085;
      const amp = fieldH * (0.018 + i * 0.002);
      ctx.beginPath();
      for (let x = fieldX + fieldW * 0.08; x <= fieldX + fieldW * 0.92; x += fieldW / 34) {
        const t = (x - fieldX) / fieldW;
        const yy = y + Math.sin(t * Math.PI * 2.2 + time * 0.42 + i * 0.55) * amp;
        if (x === fieldX + fieldW * 0.08) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.strokeStyle = i === 6 ? rgba("gold2", 0.20 + focusOpen * 0.10) : rgba("cream", 0.045 + i * 0.004);
      ctx.lineWidth = i === 6 ? 1.4 : 0.8;
      ctx.stroke();
    }

    const nodes = [
      [0.28, 0.36, 0.50],
      [0.48, 0.55, 0.64],
      [0.66, 0.30, 0.42],
      [0.73, 0.68, 0.78],
      [0.41, 0.26, 0.34],
      [0.84, 0.44, 0.87],
    ];
    nodes.forEach((node, i) => {
      const hot = i === 5;
      const nx = fieldX + fieldW * node[0];
      const ny = fieldY - fieldH * 0.5 + fieldH * node[1];
      const score = node[2];
      ctx.beginPath();
      ctx.arc(nx, ny, hot ? 4 + focusOpen * 2 : 2.2, 0, Math.PI * 2);
      ctx.fillStyle = hot ? rgba("gold2", 0.62 + focusOpen * 0.24) : rgba("cream", 0.22 + score * 0.18);
      ctx.fill();
      if (hot) {
        ctx.strokeStyle = rgba("gold2", 0.20 + focusOpen * 0.22);
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(nx, ny, 24 + pulse(time * 1.4) * 10 + focusOpen * 18, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
    ctx.restore();

    const scoreX = fieldX + fieldW * 0.10;
    const scoreY = fieldY - fieldH * 0.33;
    ctx.font = `700 ${mobile ? 11 : 12}px 'Space Grotesk', sans-serif`;
    ctx.fillStyle = rgba("gold2", 0.68);
    ctx.fillText("prioridade crítica", scoreX, scoreY);
    ctx.font = `800 ${mobile ? 48 : 72}px 'Inter Tight', sans-serif`;
    ctx.fillStyle = rgba("cream", 0.90);
    ctx.fillText("87", scoreX, scoreY + (mobile ? 54 : 76));

    const reveal = focusOpen;
    if (reveal > 0.05) {
      const cardW = fieldW * (mobile ? 0.72 : 0.48);
      const cardH = mobile ? 96 : 118;
      const cardX = fieldX + fieldW * (mobile ? 0.16 : 0.44);
      const cardY = fieldY + fieldH * (mobile ? 0.04 : 0.12) + (1 - reveal) * 22;
      ctx.globalAlpha = reveal;
      roundedRect(cardX, cardY, cardW, cardH, mobile ? 14 : 18);
      ctx.fillStyle = "rgba(8,5,6,0.48)";
      ctx.fill();
      ctx.strokeStyle = rgba("gold2", 0.18);
      ctx.stroke();
      ctx.font = `600 ${mobile ? 10 : 11}px 'Space Grotesk', sans-serif`;
      ctx.fillStyle = rgba("gold2", 0.72);
      ctx.fillText("carteira em foco", cardX + cardW * 0.08, cardY + cardH * 0.24);
      ctx.font = `700 ${mobile ? 15 : 18}px 'Inter Tight', sans-serif`;
      ctx.fillStyle = rgba("cream", 0.84);
      ctx.fillText("alto impacto / curto prazo", cardX + cardW * 0.08, cardY + cardH * 0.50);
      const triad = ["onde", "como", "quando"];
      triad.forEach((label, i) => {
        const tx = cardX + cardW * (0.10 + i * 0.29);
        ctx.font = `600 ${mobile ? 9 : 10}px 'Space Grotesk', sans-serif`;
        ctx.fillStyle = rgba(i === 0 ? "gold2" : "cream", i === 0 ? 0.70 : 0.42);
        ctx.fillText(label, tx, cardY + cardH * 0.76);
      });
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function fieldPoint(u, v, layout, time) {
    const curve = Math.sin((u * 1.25 + time * 0.045) * Math.PI) * layout.curve;
    const taper = 0.62 + u * 0.58;
    return {
      x: layout.x + layout.w * u,
      y: layout.y + curve + (v - 0.5) * layout.h * taper,
    };
  }

  function drawUnifiedDecisionField(time, stage, phase, mobile) {
    const layout = mobile
      ? { x: width * 0.09, y: height * 0.48, w: width * 0.82, h: height * 0.54, curve: height * 0.055 }
      : { x: width * 0.10, y: height * 0.51, w: width * 0.80, h: height * 0.58, curve: height * 0.060 };
    const highlight = ease(clamp(stage + phase - 1.35, 0, 1));

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const aura = ctx.createRadialGradient(layout.x + layout.w * 0.72, layout.y, 0, layout.x + layout.w * 0.72, layout.y, layout.w * 0.44);
    aura.addColorStop(0, rgba("gold2", 0.14 + highlight * 0.045));
    aura.addColorStop(0.42, rgba("wine", 0.08));
    aura.addColorStop(1, rgba("ink", 0));
    ctx.fillStyle = aura;
    ctx.fillRect(layout.x - layout.w * 0.08, layout.y - layout.h * 0.72, layout.w * 1.16, layout.h * 1.42);

    for (let row = 0; row < 9; row += 1) {
      const v = 0.12 + row * 0.095;
      ctx.beginPath();
      for (let i = 0; i <= 54; i += 1) {
        const u = i / 54;
        const p = fieldPoint(u, v + Math.sin(u * Math.PI * 2 + time * 0.18 + row) * 0.012, layout, time);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = row === 5 ? rgba("gold2", 0.13 + highlight * 0.12) : rgba("cream", 0.035 + row * 0.004);
      ctx.lineWidth = row === 5 ? 1.3 : 0.8;
      ctx.stroke();
    }

    for (let col = 1; col < 8; col += 1) {
      const u = 0.09 + col * 0.105;
      ctx.beginPath();
      for (let i = 0; i <= 34; i += 1) {
        const v = 0.11 + i * 0.023;
        const p = fieldPoint(u + Math.sin(v * Math.PI * 2 + time * 0.10 + col) * 0.006, v, layout, time);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = rgba(col === 6 ? "gold2" : "cream", col === 6 ? 0.10 + highlight * 0.08 : 0.035);
      ctx.lineWidth = col === 6 ? 1.1 : 0.7;
      ctx.stroke();
    }

    const scan = (time * 0.055) % 1;
    const scanU = 0.10 + scan * 0.74;
    const scanA = Math.sin(scan * Math.PI);
    ctx.strokeStyle = rgba("gold2", scanA * 0.16);
    ctx.lineWidth = mobile ? 10 : 16;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i <= 18; i += 1) {
      const v = 0.18 + i * 0.036;
      const p = fieldPoint(scanU + Math.sin(v * Math.PI + time * 0.08) * 0.015, v, layout, time);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    const sourceArea = [
      [0.11, 0.31, 0.16],
      [0.16, 0.45, 0.24],
      [0.20, 0.58, 0.30],
      [0.25, 0.38, 0.38],
    ];
    sourceArea.forEach((n, i) => {
      const p = fieldPoint(n[0], n[1], layout, time);
      const w = mobile ? 36 : 54;
      const h = mobile ? 20 : 26;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(-0.09 + i * 0.035);
      roundedRect(-w * 0.5, -h * 0.5, w, h, mobile ? 6 : 7);
      ctx.fillStyle = rgba("cream", 0.025 + n[2] * 0.10);
      ctx.fill();
      ctx.strokeStyle = rgba("cream", 0.045 + n[2] * 0.08);
      ctx.stroke();
      roundedRect(-w * 0.30, -h * 0.10, w * (0.32 + n[2]), 2, 99);
      ctx.fillStyle = rgba(i === 2 ? "gold2" : "cream", 0.12 + n[2] * 0.20);
      ctx.fill();
      ctx.restore();
    });

    const nodes = [
      [0.42, 0.35, 0.35],
      [0.50, 0.58, 0.50],
      [0.58, 0.43, 0.48],
      [0.66, 0.64, 0.62],
      [0.72, 0.30, 0.55],
      [0.81, 0.47, 0.87],
    ];
    nodes.forEach((n, i) => {
      const p = fieldPoint(n[0], n[1], layout, time);
      const hot = i === 5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, hot ? 4 + highlight * 2 : 2.1, 0, Math.PI * 2);
      ctx.fillStyle = hot ? rgba("gold2", 0.62 + highlight * 0.25) : rgba("cream", 0.14 + n[2] * 0.20);
      ctx.fill();
      if (i > 0) {
        const prev = fieldPoint(nodes[i - 1][0], nodes[i - 1][1], layout, time);
        glowLine(prev.x, prev.y, p.x, p.y, hot ? "gold2" : "cream", hot ? 0.10 + highlight * 0.08 : 0.035, hot ? 1.2 : 0.8);
      }
      if (hot) {
        ctx.strokeStyle = rgba("gold2", 0.16 + highlight * 0.22);
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 24 + highlight * 26 + pulse(time * 1.2) * 7, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    const hotPoint = fieldPoint(0.81, 0.47, layout, time);
    ctx.font = `800 ${mobile ? 54 : 78}px 'Inter Tight', sans-serif`;
    ctx.fillStyle = rgba("cream", 0.88);
    ctx.fillText("87", hotPoint.x - (mobile ? 98 : 128), hotPoint.y + (mobile ? 18 : 24));
    ctx.font = `600 ${mobile ? 10 : 11}px 'Space Grotesk', sans-serif`;
    ctx.fillStyle = rgba("gold2", 0.70);
    ctx.fillText("prioridade crítica", hotPoint.x - (mobile ? 96 : 126), hotPoint.y - (mobile ? 28 : 42));

    if (highlight > 0.08) {
      const w = mobile ? layout.w * 0.58 : 230;
      const h = mobile ? 78 : 96;
      const x = hotPoint.x - w * 0.48;
      const y = hotPoint.y + (mobile ? 44 : 58) + (1 - highlight) * 18;
      ctx.globalAlpha = highlight;
      roundedRect(x, y, w, h, mobile ? 12 : 14);
      ctx.fillStyle = "rgba(8,5,6,0.42)";
      ctx.fill();
      ctx.strokeStyle = rgba("gold2", 0.16);
      ctx.stroke();
      ctx.font = `600 ${mobile ? 9 : 10}px 'Space Grotesk', sans-serif`;
      ctx.fillStyle = rgba("gold2", 0.68);
      ctx.fillText("onde / como / quando", x + w * 0.08, y + h * 0.34);
      ctx.font = `700 ${mobile ? 13 : 15}px 'Inter Tight', sans-serif`;
      ctx.fillStyle = rgba("cream", 0.78);
      ctx.fillText("alocar agora", x + w * 0.08, y + h * 0.66);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  function drawOfficePainField(x, y, w, h, time, mobile) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    const painGlow = ctx.createRadialGradient(x + w * 0.38, y + h * 0.50, 10, x + w * 0.38, y + h * 0.50, w * 0.78);
    painGlow.addColorStop(0, "rgba(106,32,50,0.18)");
    painGlow.addColorStop(1, "rgba(106,32,50,0)");
    ctx.fillStyle = painGlow;
    ctx.fillRect(x - w * 0.08, y - h * 0.12, w * 1.16, h * 1.24);

    const docs = [
      [-0.18, -0.23, -0.16, 0.55],
      [0.04, -0.18, 0.08, 0.70],
      [-0.05, 0.03, -0.04, 0.62],
      [0.18, 0.12, 0.14, 0.50],
      [-0.24, 0.21, 0.06, 0.48],
    ];
    docs.forEach((doc, i) => {
      const docW = w * (mobile ? 0.36 : 0.30);
      const docH = h * (mobile ? 0.34 : 0.44);
      const dx = x + w * (0.42 + doc[0]);
      const dy = y + h * (0.50 + doc[1]);
      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(doc[2]);
      roundedRect(-docW * 0.5, -docH * 0.5, docW, docH, mobile ? 7 : 9);
      const g = ctx.createLinearGradient(-docW * 0.5, -docH * 0.5, docW * 0.5, docH * 0.5);
      g.addColorStop(0, `rgba(244,238,231,${0.030 + doc[3] * 0.045})`);
      g.addColorStop(1, `rgba(106,32,50,${0.045 + doc[3] * 0.070})`);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = rgba("cream", 0.040 + doc[3] * 0.050);
      ctx.stroke();
      for (let row = 0; row < 6; row += 1) {
        const lineW = docW * (0.30 + pulse(time * 0.45, row + i) * 0.42);
        roundedRect(-docW * 0.30, -docH * 0.27 + row * docH * 0.095, lineW, 2, 99);
        ctx.fillStyle = row === 1 || row === 4 ? rgba("wine", 0.16 + doc[3] * 0.10) : rgba("cream", 0.06 + doc[3] * 0.06);
        ctx.fill();
      }
      ctx.restore();
    });

    const fragments = [
      [0.13, 0.22, "prazo"], [0.66, 0.28, "valor"], [0.20, 0.69, "status"],
      [0.72, 0.62, "risco"], [0.52, 0.78, "peças"],
    ];
    fragments.forEach((fragment, i) => {
      const bx = x + w * fragment[0] + Math.sin(time * 0.7 + i) * 4;
      const by = y + h * fragment[1] + Math.cos(time * 0.5 + i) * 3;
      roundedRect(bx, by, mobile ? 42 : 54, mobile ? 16 : 18, 99);
      ctx.fillStyle = i % 2 ? "rgba(106,32,50,0.18)" : "rgba(244,238,231,0.045)";
      ctx.fill();
      ctx.strokeStyle = i % 2 ? rgba("wine", 0.20) : rgba("cream", 0.07);
      ctx.stroke();
      ctx.font = `600 ${mobile ? 8 : 9}px 'Space Grotesk', sans-serif`;
      ctx.fillStyle = rgba(i % 2 ? "gold2" : "muted", 0.54);
      ctx.fillText(fragment[2], bx + (mobile ? 9 : 11), by + (mobile ? 11 : 12));
    });

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 7; i += 1) {
      const sx = x + w * (0.12 + pulse(time * 0.34, i) * 0.62);
      const sy = y + h * (0.18 + pulse(time * 0.42, i + 3) * 0.62);
      ctx.beginPath();
      ctx.arc(sx, sy, 1.2 + pulse(time * 1.3, i) * 1.8, 0, Math.PI * 2);
      ctx.fillStyle = rgba(i % 3 === 0 ? "wine" : "cream", 0.12);
      ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  }

  function drawOrddoOrganizingField(x, y, w, h, time, stage, phase, mobile) {
    const active = ease(clamp(stage + phase - 0.40, 0, 1));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const coreX = x + w * 0.50;
    const coreY = y + h * 0.47;
    const coreR = mobile ? h * 0.12 : h * 0.16;
    const halo = ctx.createRadialGradient(coreX, coreY, 4, coreX, coreY, w * 0.48);
    halo.addColorStop(0, `rgba(217,189,131,${0.22 + active * 0.12})`);
    halo.addColorStop(0.45, "rgba(106,32,50,0.07)");
    halo.addColorStop(1, "rgba(8,5,6,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(x - w * 0.08, y - h * 0.12, w * 1.16, h * 1.24);

    for (let i = 0; i < 4; i += 1) {
      const yy = y + h * (0.22 + i * 0.16);
      const startX = x + w * 0.05;
      const endX = x + w * 0.95;
      glowLine(startX, yy + Math.sin(time * 0.4 + i) * 3, coreX - coreR * 0.95, coreY, "cream", 0.035 + active * 0.015, 0.8);
      glowLine(coreX + coreR * 0.95, coreY, endX, yy, "gold2", 0.060 + active * 0.050, 1.0);
    }

    ctx.beginPath();
    ctx.arc(coreX, coreY, coreR + pulse(time * 1.2) * 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(8,5,6,0.38)";
    ctx.fill();
    ctx.strokeStyle = rgba("gold2", 0.18 + active * 0.16);
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.font = `800 ${mobile ? 13 : 16}px 'Inter Tight', sans-serif`;
    ctx.fillStyle = rgba("cream", 0.82);
    ctx.textAlign = "center";
    ctx.fillText("orddo", coreX, coreY + (mobile ? 4 : 5));
    ctx.textAlign = "left";

    const rows = [
      ["processo", 0.34], ["valor", 0.58], ["fase", 0.44], ["prioridade", 0.74],
    ];
    rows.forEach((row, i) => {
      const rowX = x + w * 0.58;
      const rowY = y + h * (0.20 + i * 0.16);
      const rowW = w * (0.20 + row[1] * 0.23 * active);
      roundedRect(rowX, rowY, rowW, mobile ? 17 : 22, 99);
      ctx.fillStyle = "rgba(244,238,231,0.050)";
      ctx.fill();
      ctx.strokeStyle = i === 3 ? rgba("gold2", 0.18 + active * 0.18) : rgba("cream", 0.055);
      ctx.stroke();
      ctx.font = `600 ${mobile ? 8 : 9}px 'Space Grotesk', sans-serif`;
      ctx.fillStyle = rgba(i === 3 ? "gold2" : "muted", 0.56 + active * 0.16);
      ctx.fillText(row[0], rowX + (mobile ? 8 : 10), rowY + (mobile ? 11 : 14));
    });

    for (let i = 0; i < 8; i += 1) {
      const t = (time * 0.10 + i * 0.125) % 1;
      const side = t < 0.52;
      const local = side ? ease(t / 0.52) : ease((t - 0.52) / 0.48);
      const px = side ? lerp(x + w * 0.05, coreX, local) : lerp(coreX, x + w * 0.92, local);
      const py = side
        ? lerp(y + h * (0.23 + (i % 4) * 0.15), coreY, local)
        : lerp(coreY, y + h * (0.23 + (i % 4) * 0.15), local);
      ctx.beginPath();
      ctx.arc(px, py, side ? 2.0 : 2.8, 0, Math.PI * 2);
      ctx.fillStyle = rgba(side ? "cream" : "gold2", side ? 0.16 : 0.35);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawExecutiveDashboard(x, y, w, h, time, stage, phase, mobile) {
    const show = ease(clamp(stage + phase - 1.20, 0, 1));
    ctx.save();
    roundedRect(x, y + (1 - show) * 18, w, h, mobile ? 16 : 20);
    const card = ctx.createLinearGradient(x, y, x + w, y + h);
    card.addColorStop(0, "rgba(244,238,231,0.040)");
    card.addColorStop(0.44, "rgba(217,189,131,0.080)");
    card.addColorStop(1, "rgba(106,32,50,0.130)");
    ctx.fillStyle = card;
    ctx.fill();
    ctx.strokeStyle = rgba("gold2", 0.12 + show * 0.10);
    ctx.stroke();

    ctx.font = `700 ${mobile ? 9 : 10}px 'Space Grotesk', sans-serif`;
    ctx.fillStyle = rgba("gold2", 0.70);
    ctx.fillText("Score de prioridade", x + w * 0.08, y + h * 0.16);
    ctx.font = `800 ${mobile ? 42 : 64}px 'Inter Tight', sans-serif`;
    ctx.fillStyle = rgba("cream", 0.90);
    ctx.fillText("87", x + w * 0.08, y + h * 0.42);

    const meterX = x + w * 0.08;
    const meterY = y + h * 0.56;
    roundedRect(meterX, meterY, w * 0.70, mobile ? 5 : 6, 99);
    ctx.fillStyle = rgba("cream", 0.08);
    ctx.fill();
    roundedRect(meterX, meterY, w * (0.70 * (0.44 + show * 0.43)), mobile ? 5 : 6, 99);
    ctx.fillStyle = rgba("gold2", 0.58);
    ctx.fill();

    const rows = [
      ["Ação A", 0.82, "agora"],
      ["Ação B", 0.58, "semana"],
      ["Ação C", 0.36, "monitorar"],
    ];
    rows.forEach((row, i) => {
      const rowY = y + h * (0.66 + i * 0.095);
      ctx.font = `600 ${mobile ? 8 : 9}px 'Space Grotesk', sans-serif`;
      ctx.fillStyle = rgba("cream", 0.52);
      ctx.fillText(row[0], x + w * 0.08, rowY);
      roundedRect(x + w * 0.28, rowY - (mobile ? 7 : 8), w * 0.32, mobile ? 4 : 5, 99);
      ctx.fillStyle = rgba("cream", 0.08);
      ctx.fill();
      roundedRect(x + w * 0.28, rowY - (mobile ? 7 : 8), w * 0.32 * row[1] * show, mobile ? 4 : 5, 99);
      ctx.fillStyle = i === 0 ? rgba("gold2", 0.56) : rgba("cream", 0.20);
      ctx.fill();
      ctx.font = `600 ${mobile ? 9 : 10}px 'Space Grotesk', sans-serif`;
      ctx.fillStyle = rgba(i === 0 ? "gold2" : "muted", i === 0 ? 0.70 : 0.48);
      ctx.fillText(row[2], x + w * 0.66, rowY);
    });

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const chartX = x + w * 0.68;
    const chartY = y + h * 0.27;
    const chartR = mobile ? 28 : 38;
    ctx.strokeStyle = rgba("cream", 0.08);
    ctx.lineWidth = mobile ? 5 : 7;
    ctx.beginPath();
    ctx.arc(chartX, chartY, chartR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = rgba("gold2", 0.24 + show * 0.24);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(chartX, chartY, chartR + pulse(time * 1.4) * 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(chartX, chartY, chartR, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 1.55 * show);
    ctx.strokeStyle = rgba("gold2", 0.70);
    ctx.lineWidth = mobile ? 5 : 7;
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  function drawDashboardMetric(x, y, label, value, accent, mobile) {
    ctx.font = `600 ${mobile ? 8 : 10}px 'Space Grotesk', sans-serif`;
    ctx.fillStyle = rgba("muted", 0.46);
    ctx.fillText(label, x, y);
    ctx.font = `800 ${mobile ? 20 : 28}px 'Inter Tight', sans-serif`;
    ctx.fillStyle = rgba(accent ? "gold2" : "cream", accent ? 0.88 : 0.82);
    ctx.fillText(value, x, y + (mobile ? 24 : 34));
  }

  function drawDashboardChart(x, y, w, h, time, mobile) {
    const values = [0.26, 0.34, 0.43, 0.36, 0.52, 0.44, 0.66, 0.45, 0.47, 0.54, 0.61, 0.57, 0.60, 0.53, 0.72, 0.61, 0.72, 0.42, 0.35, 0.28, 0.18, 0.46, 0.52, 0.70, 0.74, 0.67, 0.55];
    const points = values.map((value, i) => {
      const drift = Math.sin(time * 0.36 + i * 0.72) * 0.018;
      return {
        x: x + (w * i) / (values.length - 1),
        y: y + h - h * clamp(value + drift, 0.08, 0.86),
      };
    });

    ctx.strokeStyle = rgba("cream", 0.026);
    ctx.lineWidth = 1;
    for (let i = 0; i < 2; i += 1) {
      const gy = y + h * (0.28 + i * 0.44);
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy);
      ctx.stroke();
    }

    ctx.beginPath();
    points.forEach((point, i) => {
      if (i === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    const area = ctx.createLinearGradient(x, y, x, y + h);
    area.addColorStop(0, "rgba(217,189,131,0.20)");
    area.addColorStop(1, "rgba(217,189,131,0.015)");
    ctx.fillStyle = area;
    ctx.fill();

    ctx.beginPath();
    points.forEach((point, i) => {
      if (i === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    const stroke = ctx.createLinearGradient(x, y, x + w, y);
    stroke.addColorStop(0, "rgba(244,238,231,0.34)");
    stroke.addColorStop(0.5, "rgba(217,189,131,0.86)");
    stroke.addColorStop(1, "rgba(106,32,50,0.82)");
    ctx.strokeStyle = stroke;
    ctx.lineWidth = mobile ? 1.4 : 1.8;
    ctx.stroke();

    const hot = points[14];

    ctx.beginPath();
    ctx.arc(hot.x, hot.y, mobile ? 3 : 4, 0, Math.PI * 2);
    ctx.fillStyle = rgba("gold2", 0.88);
    ctx.fill();
    ctx.strokeStyle = rgba("gold2", 0.18);
    ctx.lineWidth = 12 + pulse(time * 1.4) * 6;
    ctx.stroke();
  }

  function drawDashboardRows(x, y, w, title, rows, mobile) {
    ctx.font = `700 ${mobile ? 10 : 12}px 'Inter Tight', sans-serif`;
    ctx.fillStyle = rgba("cream", 0.78);
    ctx.fillText(title, x, y);
    rows.forEach((row, i) => {
      const rowY = y + (mobile ? 28 : 34) + i * (mobile ? 23 : 29);
      const fill = i === 0 ? "rgba(217,189,131,0.12)" : "rgba(244,238,231,0.045)";
      roundedRect(x, rowY - (mobile ? 13 : 16), w * row[1], mobile ? 18 : 22, 6);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.font = `600 ${mobile ? 8 : 9}px 'Space Grotesk', sans-serif`;
      ctx.fillStyle = rgba("cream", i === 0 ? 0.72 : 0.48);
      ctx.fillText(row[0], x + 10, rowY);
      ctx.textAlign = "right";
      ctx.fillStyle = rgba(i === 0 ? "gold2" : "muted", i === 0 ? 0.76 : 0.52);
      ctx.fillText(row[2], x + w, rowY);
      ctx.textAlign = "left";
    });
  }

  function drawPriorityCard(x, y, w, h, time, mobile) {
    roundedRect(x, y, w, h, mobile ? 14 : 18);
    const card = ctx.createLinearGradient(x, y, x + w, y + h);
    card.addColorStop(0, "rgba(244,238,231,0.090)");
    card.addColorStop(0.52, "rgba(217,189,131,0.095)");
    card.addColorStop(1, "rgba(106,32,50,0.155)");
    ctx.fillStyle = card;
    ctx.fill();
    ctx.strokeStyle = rgba("gold2", 0.17);
    ctx.stroke();

    ctx.font = `700 ${mobile ? 9 : 10}px 'Space Grotesk', sans-serif`;
    ctx.fillStyle = rgba("gold2", 0.72);
    ctx.fillText("Score de prioridade", x + w * 0.09, y + h * 0.20);
    ctx.font = `900 ${mobile ? 42 : 56}px 'Inter Tight', sans-serif`;
    ctx.fillStyle = rgba("cream", 0.92);
    ctx.fillText("87", x + w * 0.09, y + h * 0.52);

    const meterX = x + w * 0.09;
    const meterY = y + h * 0.63;
    roundedRect(meterX, meterY, w * 0.78, mobile ? 5 : 6, 99);
    ctx.fillStyle = rgba("cream", 0.08);
    ctx.fill();
    roundedRect(meterX, meterY, w * 0.69, mobile ? 5 : 6, 99);
    ctx.fillStyle = rgba("gold2", 0.66);
    ctx.fill();

    ctx.font = `600 ${mobile ? 8 : 9}px 'Space Grotesk', sans-serif`;
    ctx.fillStyle = rgba("muted", 0.50);
    ctx.fillText("Prioridade alta", x + w * 0.09, y + h * 0.82);
  }

  function drawInstitutionalDashboard(time, mobile) {
    const panelW = mobile ? width * 0.92 : Math.min(width * 0.88, 1100);
    const panelH = mobile ? Math.min(height * 0.86, 520) : Math.min(height * 0.84, 560);
    const panelX = (width - panelW) / 2;
    const panelY = mobile ? height * 0.07 : height * 0.07;
    const pad = mobile ? Math.max(14, width * 0.04) : 34;

    ctx.save();
    roundedRect(panelX, panelY, panelW, panelH, mobile ? 18 : 24);
    const panel = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY + panelH);
    panel.addColorStop(0, "rgba(244,238,231,0.052)");
    panel.addColorStop(0.52, "rgba(217,189,131,0.038)");
    panel.addColorStop(1, "rgba(106,32,50,0.118)");
    ctx.fillStyle = panel;
    ctx.fill();
    roundedRect(panelX + panelW - pad - (mobile ? 92 : 126), panelY + (mobile ? 22 : 30), mobile ? 92 : 126, mobile ? 24 : 30, 7);
    ctx.fillStyle = "rgba(244,238,231,0.105)";
    ctx.fill();
    ctx.font = `700 ${mobile ? 8 : 10}px 'Space Grotesk', sans-serif`;
    ctx.fillStyle = rgba("cream", 0.62);
    ctx.fillText("Últimos 30 dias", panelX + panelW - pad - (mobile ? 78 : 106), panelY + (mobile ? 36 : 50));

    ctx.strokeStyle = "rgba(217,189,131,0.065)";
    ctx.beginPath();
    ctx.moveTo(panelX + pad, panelY + (mobile ? 66 : 78));
    ctx.lineTo(panelX + panelW - pad, panelY + (mobile ? 66 : 78));
    ctx.stroke();

    const metricY = panelY + (mobile ? 74 : 116);
    if (mobile) {
      const colW = (panelW - pad * 2) / 2;
      drawDashboardMetric(panelX + pad, metricY, "Ativos", "14,8k", true, mobile);
      drawDashboardMetric(panelX + pad + colW, metricY, "Em análise", "416", false, mobile);
      drawDashboardMetric(panelX + pad, metricY + 48, "Carteira", "R$ 82M", false, mobile);
    } else {
      const metricGap = panelW * 0.22;
      drawDashboardMetric(panelX + pad, metricY, "Ativos monitorados", "14,8k", true, mobile);
      drawDashboardMetric(panelX + pad + metricGap, metricY, "Em análise", "416", false, mobile);
      drawDashboardMetric(panelX + pad + metricGap * 2, metricY, "Valor da carteira", "R$ 82M", false, mobile);
    }

    const chartX = panelX + pad;
    const chartY = panelY + (mobile ? 166 : 155);
    const chartW = mobile ? panelW - pad * 2 : panelW * 0.58;
    const chartH = mobile ? Math.min(panelH * 0.22, 88) : panelH * 0.30;
    drawDashboardChart(chartX, chartY, chartW, chartH, time, mobile);

    ctx.font = `600 ${mobile ? 8 : 10}px 'Space Grotesk', sans-serif`;
    ctx.fillStyle = rgba("muted", 0.42);
    ctx.fillText("D-30", chartX, chartY + chartH + 20);
    ctx.textAlign = "right";
    ctx.fillText("Hoje", chartX + chartW, chartY + chartH + 20);
    ctx.textAlign = "left";

    if (mobile) {
      const cardY = chartY + chartH + 34;
      const cardH = clamp(panelY + panelH - pad - cardY, 76, 116);
      drawPriorityCard(panelX + pad, cardY, panelW - pad * 2, cardH, time, mobile);
    } else {
      const cardX = panelX + panelW * 0.70;
      const cardY = chartY;
      const cardW = panelW * 0.24;
      const cardH = chartH;
      ctx.strokeStyle = "rgba(244,238,231,0.055)";
      ctx.beginPath();
      ctx.moveTo(cardX - 26, chartY - 10);
      ctx.lineTo(cardX - 26, chartY + chartH + 10);
      ctx.stroke();
      drawPriorityCard(cardX, cardY, cardW, cardH, time, mobile);
      const rowsY = panelY + panelH - 116;
      drawDashboardRows(panelX + pad, rowsY, panelW * 0.40, "Carteiras", [
        ["JEC", 0.82, "R$ 18M"],
        ["Massificado cível", 0.56, "R$ 11M"],
        ["Tributário", 0.42, "R$ 7M"],
      ], mobile);
      drawDashboardRows(panelX + panelW * 0.52, rowsY, panelW * 0.40, "Sinais", [
        ["Viabilidade da tese", 0.72, "alta"],
        ["Expectativa de direito", 0.50, "90d"],
      ], mobile);
    }

    ctx.restore();
  }

  function drawBeforeAfterProcess(time, stage, phase, mobile) {
    drawInstitutionalDashboard(time, mobile);
  }

  function drawSimpleExecutiveScene(time, stage, phase) {
    const mobile = width < 680;
    drawSimpleBackground(time);
    drawBeforeAfterProcess(time, stage, phase, mobile);

    const vignette = ctx.createRadialGradient(width * 0.5, height * 0.5, Math.min(width, height) * 0.2, width * 0.5, height * 0.5, Math.max(width, height) * 0.76);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.44)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  function drawFrame(now) {
    if (!reduceMotion && lastFrameTime && now - lastFrameTime < 32) {
      raf = requestAnimationFrame(drawFrame);
      return;
    }
    lastFrameTime = now;
    resize();
    if (!startTime) startTime = now;
    const time = (now - startTime) / 1000;
    const progress = (time % JOURNEY_DURATION) / JOURNEY_DURATION;
    const currentStage = reduceMotion ? active : stageIndex(progress);
    const phase = reduceMotion ? 1 : stageLocal(progress);
    if (currentStage !== announcedStage && (announcedStage < 0 || now - lastAnnouncementTime > 1700)) {
      announcedStage = currentStage;
      lastAnnouncementTime = now;
      onStageChange?.(currentStage);
    }
    visualActive = lerp(visualActive, currentStage, reduceMotion ? 1 : 0.12);
    ctx.clearRect(0, 0, width, height);
    drawSimpleExecutiveScene(time, currentStage, phase);

    if (!reduceMotion) raf = requestAnimationFrame(drawFrame);
  }

  requestAnimationFrame(drawFrame);
  window.addEventListener("resize", resize, { passive: true });

  return {
    setActive(index) {
      active = clamp(index, 0, FLOW_LABELS.length - 1);
      if (reduceMotion) requestAnimationFrame(drawFrame);
    },
  };
}

const demoEl = document.querySelector("[data-demo]");
if (demoEl) {
  if (reduceMotion) {
    initProductDemo(demoEl);
  } else if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { initProductDemo(demoEl); io.disconnect(); } });
    }, { threshold: 0.2 });
    io.observe(demoEl);
  } else {
    initProductDemo(demoEl);
  }
}

// ── Gradient.js-style WebGL mesh gradient ───────────────────────
class Gradient {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: false }) || canvas.getContext("experimental-webgl", { antialias: true, alpha: true, premultipliedAlpha: false });
    this.raf = 0;
    this.start = performance.now();
  }

  init() {
    if (!this.gl) {
      this.canvas.classList.add("is-fallback");
      return;
    }

    const gl = this.gl;
    const vertexShader = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;
    const fragmentShader = `
      precision highp float;
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec3 u_color0;
      uniform vec3 u_color1;
      uniform vec3 u_color2;
      uniform vec3 u_color3;
      varying vec2 v_uv;

      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
        m = m * m;
        m = m * m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
        vec3 g;
        g.x = a0.x * x0.x + h.x * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.52;
        mat2 rotate = mat2(0.86, -0.50, 0.50, 0.86);
        for (int i = 0; i < 5; i++) {
          value += amplitude * snoise(p);
          p = rotate * p * 1.82 + 0.17;
          amplitude *= 0.52;
        }
        return value;
      }

      float band(float x, float lo, float hi, float edge) {
        return smoothstep(lo - edge, lo + edge, x) * smoothstep(hi + edge, hi - edge, x);
      }

      vec4 over(vec4 base, vec3 color, float alpha) {
        alpha = clamp(alpha, 0.0, 1.0);
        float outA = alpha + base.a * (1.0 - alpha);
        vec3 outC = (color * alpha + base.rgb * base.a * (1.0 - alpha)) / max(outA, 0.0001);
        return vec4(outC, outA);
      }

      void main() {
        vec2 uv = v_uv;
        float aspect = u_resolution.x / max(u_resolution.y, 1.0);
        vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
        float t = u_time * 0.42;

        float angle = -0.72;
        mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
        vec2 r = rot * (p + vec2(0.06, -0.02));
        float s = clamp((r.x + 1.62) / 3.24, 0.0, 1.0);
        float q = s * s * (3.0 - 2.0 * s);
        float center = mix(0.48, -0.38, q) + 0.12 * sin((s - 0.08) * 3.14159);
        center += 0.035 * sin(t + s * 6.28318) + 0.018 * sin(t * 1.7 - s * 4.4);
        float width = 0.66 - 0.20 * s + 0.07 * sin(s * 3.14159) + 0.018 * sin(t * 1.15 + s * 5.1);
        float y = (r.y - center) / max(width, 0.001);
        float taper = smoothstep(0.015, 0.095, s) * smoothstep(1.0, 0.865, s);

        vec4 acc = vec4(0.0);
        float fibers = (0.5 + 0.5 * sin(s * 230.0 + y * 34.0 - t * 13.0)) * 0.040;
        fibers += (0.5 + 0.5 * sin(s * 154.0 + y * 22.0 + t * 7.4 + 1.6)) * 0.026;
        float sheen = smoothstep(0.12, 0.0, abs(fract(s * 1.15 - t * 0.18) - 0.50));
        vec3 ice = vec3(0.78, 0.90, 1.0);
        vec3 lavender = vec3(0.80, 0.76, 1.0);
        vec3 peach = vec3(1.0, 0.62, 0.18);
        vec3 amber = vec3(1.0, 0.76, 0.16);
        vec3 salmon = vec3(1.0, 0.48, 0.42);
        vec3 hotPink = vec3(1.0, 0.36, 0.82);

        float lower = band(y, -1.08, 0.06, 0.020) * taper;
        vec3 lowerColor = mix(ice, lavender, smoothstep(-1.0, 0.08, y));
        lowerColor = mix(lowerColor, hotPink, smoothstep(0.22, 0.94, s) * smoothstep(-0.50, 0.12, y) * 0.58);
        lowerColor = mix(lowerColor, u_color1, smoothstep(0.0, 0.24, s) * 0.28);
        acc = over(acc, lowerColor + vec3(fibers * 0.68), lower * 0.68);

        float main = band(y, -0.08, 0.78, 0.018) * taper;
        vec3 mainColor = mix(peach, u_color3, smoothstep(0.08, 0.46, s));
        mainColor = mix(mainColor, amber, smoothstep(0.20, 0.58, y) * 0.48);
        mainColor = mix(mainColor, salmon, smoothstep(0.56, 0.98, s) * smoothstep(0.44, 0.94, y) * 0.30);
        acc = over(acc, mainColor + vec3(fibers * 1.05) + vec3(0.22, 0.13, 0.015) * sheen, main * 0.95);

        float topVeil = band(y, 0.56, 1.16, 0.024) * taper * smoothstep(0.38, 0.62, s);
        vec3 veilColor = mix(hotPink, salmon, smoothstep(0.18, 0.72, y));
        veilColor = mix(veilColor, amber, smoothstep(0.48, 1.0, s) * 0.28);
        acc = over(acc, veilColor + vec3(fibers * 0.52), topVeil * 0.54);

        vec2 vf = p;
        float foldX = 0.54 + 0.085 * sin((vf.y + 0.24) * 2.05 + t * 0.70) + 0.030 * cos(vf.y * 4.2 - t * 1.9);
        float foldYMask = smoothstep(-0.58, -0.10, vf.y) * smoothstep(0.84, 0.34, vf.y);
        float foldD = abs(vf.x - foldX);
        float foldGlow = smoothstep(0.145, 0.0, foldD) * foldYMask;
        float foldCore = smoothstep(0.040, 0.0, foldD) * foldYMask;
        vec3 foldGlowColor = mix(amber, hotPink, 0.46);
        acc = over(acc, foldGlowColor, foldGlow * 0.58);
        acc = over(acc, mix(u_color0, amber, 0.50), foldCore * 0.94);

        float rightPlane = smoothstep(0.0, 0.075, vf.x - foldX) * smoothstep(0.42, 0.70, vf.y + vf.x * 0.2) * foldYMask;
        vec3 rightColor = mix(hotPink, salmon, smoothstep(0.0, 0.9, vf.y + 0.4));
        rightColor = mix(rightColor, u_color0, smoothstep(0.48, 0.82, vf.y + 0.46) * 0.42);
        acc = over(acc, rightColor + vec3(fibers * 0.42), rightPlane * 0.34);

        float crease = smoothstep(0.012, 0.0, abs(vf.x - (foldX - 0.048))) * foldYMask;
        acc.rgb += vec3(0.16, 0.13, 0.055) * crease * acc.a;

        acc.rgb = pow(acc.rgb, vec3(0.94));
        gl_FragColor = acc;
      }
    `;

    const program = this.createProgram(vertexShader, fragmentShader);
    if (!program) {
      this.canvas.classList.add("is-fallback");
      return;
    }

    gl.useProgram(program);
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.program = program;
    this.locations = {
      position: gl.getAttribLocation(program, "a_position"),
      time: gl.getUniformLocation(program, "u_time"),
      resolution: gl.getUniformLocation(program, "u_resolution"),
      colors: [
        gl.getUniformLocation(program, "u_color0"),
        gl.getUniformLocation(program, "u_color1"),
        gl.getUniformLocation(program, "u_color2"),
        gl.getUniformLocation(program, "u_color3"),
      ],
    };

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this.locations.position);
    gl.vertexAttribPointer(this.locations.position, 2, gl.FLOAT, false, 0, 0);
    this.setColors();
    window.addEventListener("resize", () => this.resize(), { passive: true });
    this.canvas.classList.add("is-webgl");
    this.render = this.render.bind(this);
    this.render();
  }

  createProgram(vertexSource, fragmentSource) {
    const gl = this.gl;
    const vertex = this.compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = this.compile(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) return null;
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return null;
    }
    return program;
  }

  compile(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  }

  cssColorToRgb(value) {
    if (value.startsWith("#")) {
      const hex = value.slice(1);
      const full = hex.length === 3 ? hex.split("").map((ch) => ch + ch).join("") : hex;
      const int = Number.parseInt(full.slice(0, 6), 16);
      return [(int >> 16) & 255, (int >> 8) & 255, int & 255].map((v) => v / 255);
    }
    const match = value.match(/rgba?\(([^)]+)\)/);
    if (!match) return [1, 1, 1];
    return match[1].split(",").slice(0, 3).map((part) => Number.parseFloat(part) / 255);
  }

  setColors() {
    const css = getComputedStyle(this.canvas);
    const read = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
    const colors = [
      this.cssColorToRgb(read("--gradient-color-1", "#6f55ff")),
      this.cssColorToRgb(read("--gradient-color-2", "#bfe7ff")),
      this.cssColorToRgb(read("--gradient-color-3", "#ff8a00")),
      this.cssColorToRgb(read("--gradient-color-4", "#ff4fb8")),
    ];
    colors.forEach((color, index) => this.gl.uniform3fv(this.locations.colors[index], color));
  }

  resize() {
    const gl = this.gl;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    gl.uniform2f(this.locations.resolution, width, height);
  }

  render(now = performance.now()) {
    const gl = this.gl;
    this.resize();
    gl.uniform1f(this.locations.time, (now - this.start) / 1000);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.raf = requestAnimationFrame(this.render);
  }
}

function setHeroVariant() {
  const params = new URLSearchParams(window.location.search);
  const variant = (params.get("hero") || "").toLowerCase();
  const proposal = (params.get("proposal") || params.get("theme") || "").toLowerCase();
  const classes = {
    clean: "hero-test-clean",
    "sem-bolinhas": "hero-test-clean",
    subtle: "hero-test-subtle",
    sutil: "hero-test-subtle",
  };
  const isSoberProposal = ["sober", "sobrio", "sóbrio"].includes(proposal);

  document.body.classList.remove("hero-test-clean", "hero-test-subtle", "proposal-sober");
  if (isSoberProposal) {
    document.body.classList.add("proposal-sober", "hero-test-clean");
    return;
  }
  if (classes[variant]) document.body.classList.add(classes[variant]);
}

setHeroVariant();

function initDecisionHero(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  let width = 1;
  let height = 1;
  let raf = 0;
  const palette = {
    paper: "246,244,239",
    muted: "215,206,193",
    gold: "184,140,74",
    wine: "123,34,59",
    violet: "77,59,122",
    ink: "23,18,20",
  };
  const rgba = (name, alpha) => `rgba(${palette[name]},${alpha})`;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const pulse = (time, offset = 0) => 0.5 + Math.sin(time + offset) * 0.5;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nextWidth = Math.max(1, Math.floor(rect.width * dpr));
    const nextHeight = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    width = rect.width;
    height = rect.height;
  }

  function roundedRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function drawGrid(time) {
    const gap = width < 760 ? 54 : 72;
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.strokeStyle = rgba("paper", 0.055);
    ctx.lineWidth = 1;
    for (let x = width * 0.42; x < width + gap; x += gap) {
      ctx.beginPath();
      ctx.moveTo(x + Math.sin(time * 0.16 + x * 0.01) * 2, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height + gap; y += gap) {
      ctx.beginPath();
      ctx.moveTo(width * 0.38, y);
      ctx.lineTo(width, y + Math.cos(time * 0.12 + y * 0.012) * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDocument(x, y, w, h, index, time) {
    ctx.save();
    ctx.globalAlpha = 0.88;
    roundedRect(x, y, w, h, 10);
    ctx.fillStyle = rgba("paper", 0.13);
    ctx.fill();
    ctx.strokeStyle = rgba("paper", 0.24);
    ctx.stroke();

    ctx.fillStyle = rgba(index % 2 ? "gold" : "muted", 0.76);
    roundedRect(x + 16, y + 16, w * 0.34, 4, 99);
    ctx.fill();

    for (let i = 0; i < 5; i += 1) {
      const hot = (index + i) % 4 === 0;
      const lineWidth = w * (0.42 + ((i * 17 + index * 7) % 28) / 100);
      ctx.fillStyle = hot ? rgba("gold", 0.68 + pulse(time * 1.2, i + index) * 0.18) : rgba("paper", 0.26);
      roundedRect(x + 16, y + 34 + i * 13, lineWidth, 3, 99);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawConnection(start, end, time, index) {
    const controlX = lerp(start.x, end.x, 0.58);
    const controlY = lerp(start.y, end.y, 0.5) + Math.sin(time * 0.5 + index) * 10;
    const gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
    gradient.addColorStop(0, rgba("paper", 0));
    gradient.addColorStop(0.42, rgba(index % 2 ? "gold" : "violet", 0.34));
    gradient.addColorStop(1, rgba("paper", 0));

    ctx.save();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(controlX, controlY, end.x, end.y);
    ctx.stroke();

    const t = (time * 0.075 + index * 0.17) % 1;
    const q = t * t * (3 - 2 * t);
    const x = (1 - q) * (1 - q) * start.x + 2 * (1 - q) * q * controlX + q * q * end.x;
    const y = (1 - q) * (1 - q) * start.y + 2 * (1 - q) * q * controlY + q * q * end.y;
    ctx.fillStyle = rgba(index % 2 ? "gold" : "paper", 0.62 * Math.sin(t * Math.PI));
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawDecisionPanel(x, y, w, h, time) {
    ctx.save();
    roundedRect(x, y, w, h, 18);
    ctx.fillStyle = rgba("ink", 0.52);
    ctx.fill();
    ctx.strokeStyle = rgba("paper", 0.24);
    ctx.stroke();

    ctx.fillStyle = rgba("paper", 0.78);
    ctx.font = "600 12px Inter, sans-serif";
    ctx.fillText("prioridade da carteira", x + 24, y + 34);

    const rows = [
      ["probabilidade", 0.82, "gold"],
      ["tempo estimado", 0.64, "violet"],
      ["risco processual", 0.38, "wine"],
      ["valor esperado", 0.76, "gold"],
    ];
    rows.forEach(([label, value, color], index) => {
      const yy = y + 68 + index * 42;
      ctx.fillStyle = rgba("muted", 0.52);
      ctx.font = "500 11px Inter, sans-serif";
      ctx.fillText(label, x + 24, yy);
      roundedRect(x + 24, yy + 10, w - 48, 5, 99);
      ctx.fillStyle = rgba("paper", 0.1);
      ctx.fill();
      roundedRect(x + 24, yy + 10, (w - 48) * (value + pulse(time * 0.8, index) * 0.025), 5, 99);
      ctx.fillStyle = rgba(color, 0.58);
      ctx.fill();
    });

    const score = 74 + Math.round(pulse(time * 0.6) * 4);
    ctx.fillStyle = rgba("paper", 0.9);
    ctx.font = "800 42px Inter Tight, sans-serif";
    ctx.fillText(String(score), x + 24, y + h - 32);
    ctx.fillStyle = rgba("gold", 0.78);
    ctx.font = "600 12px Inter, sans-serif";
    ctx.fillText("SCORE", x + 88, y + h - 42);
    ctx.restore();
  }

  function draw(time = 0) {
    resize();
    ctx.clearRect(0, 0, width, height);

    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, "rgba(17,14,15,0.04)");
    bg.addColorStop(0.5, "rgba(123,34,59,0.16)");
    bg.addColorStop(1, "rgba(77,59,122,0.34)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    drawGrid(time);

    const mobile = width < 760;
    const docW = mobile ? 132 : clamp(width * 0.105, 132, 172);
    const docH = docW * 0.72;
    const startX = mobile ? width * 0.52 : width * 0.58;
    const startY = mobile ? height * 0.18 : height * 0.18;
    const docs = [
      [startX, startY + docH * 0.1],
      [startX + docW * 0.82, startY + docH * 0.9],
      [startX + docW * 0.16, startY + docH * 1.78],
      [startX + docW * 1.22, startY + docH * 2.54],
      [startX + docW * 0.28, startY + docH * 3.34],
    ];
    const panelW = mobile ? Math.min(width * 0.38, 250) : clamp(width * 0.18, 250, 330);
    const panelH = mobile ? 230 : 270;
    const panelX = mobile ? width * 0.58 : width - panelW - width * 0.055;
    const panelY = mobile ? height * 0.43 : height * 0.34;

    docs.forEach(([x, y], index) => {
      drawDocument(x, y, docW, docH, index, time);
      drawConnection(
        { x: x + docW, y: y + docH * 0.5 },
        { x: panelX + 18, y: panelY + 52 + index * 34 },
        time,
        index
      );
    });

    drawDecisionPanel(panelX, panelY, panelW, panelH, time);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const sheen = ctx.createRadialGradient(width * 0.82, height * 0.18, 0, width * 0.82, height * 0.18, width * 0.44);
    sheen.addColorStop(0, rgba("gold", 0.1 + pulse(time * 0.35) * 0.04));
    sheen.addColorStop(0.55, rgba("violet", 0.07));
    sheen.addColorStop(1, rgba("paper", 0));
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    if (!reduceMotion) {
      raf = requestAnimationFrame((next) => draw(next / 1000));
    }
  }

  window.addEventListener("resize", () => draw(performance.now() / 1000), { passive: true });
  draw(performance.now() / 1000);
  return () => cancelAnimationFrame(raf);
}

requestAnimationFrame(() => {
  const isSoberProposal = document.body.classList.contains("proposal-sober");
  document.querySelectorAll("[data-gradient]").forEach((canvas) => new Gradient(canvas).init());
  if (!isSoberProposal) {
    document.querySelectorAll("[data-trianglify]").forEach(initTrianglifyCanvas);
  }
  if (isSoberProposal) {
    document.querySelectorAll("[data-decision-hero]").forEach(initDecisionHero);
  }
  if (!document.body.classList.contains("hero-test-clean") && !document.body.classList.contains("hero-test-subtle")) {
    document.querySelectorAll("[data-nova]").forEach(initNovaCanvas);
  }
  document.querySelectorAll("[data-spotlight]").forEach(initSpotlight);
  initParallaxPanels();
});

function resizeCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    return { width: rect.width, height: rect.height, dpr, resized: true };
  }
  return { width: rect.width, height: rect.height, dpr, resized: false };
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((ch) => ch + ch).join("") : value;
  const int = Number.parseInt(full.slice(0, 6), 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function mixRgb(from, to, amount) {
  return from.map((channel, index) => Math.round(channel + (to[index] - channel) * amount));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function cssRgb(color, alpha = 1) {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

function initTrianglifyCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const palette = ["#160016", "#24133a", "#6432ff", "#c03bff", "#e39b00", "#f5c66a"].map(hexToRgb);
  let seed = 1327;
  let triangles = [];
  let metrics = resizeCanvas(canvas);

  function build() {
    metrics = resizeCanvas(canvas);
    const random = seededRandom(seed);
    const cell = metrics.width < 680 ? 74 : 112;
    const cols = Math.ceil(metrics.width / cell) + 3;
    const rows = Math.ceil(metrics.height / cell) + 3;
    const points = [];

    for (let y = 0; y < rows; y += 1) {
      const row = [];
      for (let x = 0; x < cols; x += 1) {
        row.push({
          x: (x - 1) * cell + (random() - 0.5) * cell * 0.54,
          y: (y - 1) * cell + (random() - 0.5) * cell * 0.54,
        });
      }
      points.push(row);
    }

    triangles = [];
    for (let y = 0; y < rows - 1; y += 1) {
      for (let x = 0; x < cols - 1; x += 1) {
        const a = points[y][x];
        const b = points[y][x + 1];
        const c = points[y + 1][x];
        const d = points[y + 1][x + 1];
        const split = (x + y + Math.floor(random() * 2)) % 2 === 0;
        const makeTriangle = (p1, p2, p3) => {
          const centerX = (p1.x + p2.x + p3.x) / 3;
          const centerY = (p1.y + p2.y + p3.y) / 3;
          triangles.push({
            points: [p1, p2, p3],
            x: centerX / metrics.width,
            y: centerY / metrics.height,
            noise: random(),
          });
        };
        if (split) {
          makeTriangle(a, b, c);
          makeTriangle(b, d, c);
        } else {
          makeTriangle(a, b, d);
          makeTriangle(a, d, c);
        }
      }
    }
  }

  function triangleColor(triangle, time) {
    const orbital = Math.sin(triangle.x * 4.8 - triangle.y * 3.4 + time * 0.34) * 0.12;
    const diagonal = triangle.x * 0.58 + (1 - triangle.y) * 0.26 + triangle.noise * 0.18 + orbital;
    const index = clamp(diagonal, 0, 0.999) * (palette.length - 1);
    const low = Math.floor(index);
    return mixRgb(palette[low], palette[low + 1], index - low);
  }

  function draw(now = performance.now()) {
    const size = resizeCanvas(canvas);
    if (size.resized) build();
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.lineWidth = 0.65;

    const time = now / 1000;
    triangles.forEach((triangle) => {
      const color = triangleColor(triangle, time);
      ctx.beginPath();
      ctx.moveTo(triangle.points[0].x, triangle.points[0].y);
      ctx.lineTo(triangle.points[1].x, triangle.points[1].y);
      ctx.lineTo(triangle.points[2].x, triangle.points[2].y);
      ctx.closePath();
      ctx.fillStyle = cssRgb(color, 0.74);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 248, 234, 0.045)";
      ctx.stroke();
    });

    requestAnimationFrame(draw);
  }

  canvas.closest(".hero")?.addEventListener("click", () => {
    seed += 97;
    build();
  });

  build();
  draw();
}

function initNovaCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let particles = [];
  let metrics = resizeCanvas(canvas);
  const amber = hexToRgb("#e39b00");
  const gold = hexToRgb("#f5c66a");
  const violet = hexToRgb("#6432ff");
  const magenta = hexToRgb("#c03bff");

  function randomDirection(random) {
    const z = random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(1 - z * z);
    return {
      x: Math.cos(angle) * radius,
      y: z,
      z: Math.sin(angle) * radius,
    };
  }

  function build() {
    metrics = resizeCanvas(canvas);
    const random = seededRandom(4021);
    const count = metrics.width < 700 ? 1150 : Math.min(3400, Math.floor((metrics.width * metrics.height) / 390));
    particles = [];

    for (let i = 0; i < count; i += 1) {
      const inCore = i < count * 0.34;
      let x;
      let y;
      let z;
      if (inCore) {
        const direction = randomDirection(random);
        const radius = 5.8 + random() * 2.8;
        x = direction.x * radius;
        y = direction.y * radius * 0.7;
        z = direction.z * radius;
      } else {
        const inner = 8.8;
        const outer = 28;
        const radius = Math.sqrt(outer * outer * random() + inner * inner * (1 - random()));
        const angle = random() * Math.PI * 2;
        x = Math.cos(angle) * radius;
        y = (random() - 0.5) * 2.8;
        z = Math.sin(angle) * radius;
      }

      particles.push({
        x,
        y,
        z,
        size: 0.55 + random() * 1.7,
        phaseA: random() * Math.PI * 2,
        phaseB: random() * Math.PI * 2,
        speed: 0.11 + random() * 0.22,
        amp: 0.09 + random() * 0.72,
        tone: inCore ? random() * 0.42 : 0.38 + random() * 0.62,
      });
    }
  }

  function rotateY(point, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: point.x * cos - point.z * sin,
      y: point.y,
      z: point.x * sin + point.z * cos,
    };
  }

  function draw(now = performance.now()) {
    const size = resizeCanvas(canvas);
    if (size.resized) build();
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.globalCompositeOperation = "lighter";

    const time = now / 1000;
    const centerX = size.width * (size.width < 720 ? 0.66 : 0.69);
    const centerY = size.height * (size.width < 720 ? 0.43 : 0.47);
    const scale = Math.min(size.width, size.height) * (size.width < 720 ? 0.046 : 0.055);
    const rotation = -0.42 + time * 0.045;

    const halo = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.min(size.width, size.height) * 0.42);
    halo.addColorStop(0, "rgba(227, 155, 0, 0.07)");
    halo.addColorStop(0.22, "rgba(100, 50, 255, 0.11)");
    halo.addColorStop(0.52, "rgba(192, 59, 255, 0.045)");
    halo.addColorStop(1, "rgba(22, 0, 22, 0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, size.width, size.height);

    particles.forEach((particle) => {
      const flow = {
        x: particle.x + Math.cos(particle.phaseB + time * particle.speed * 0.92) * particle.amp * 1.02,
        y: particle.y + Math.cos(particle.phaseA + time * particle.speed * 1.18) * particle.amp * 0.56,
        z: particle.z + Math.sin(particle.phaseB + time * particle.speed * 0.84) * particle.amp * 1.02,
      };
      const rotated = rotateY(flow, rotation);
      const camera = 34;
      const perspective = camera / (camera + rotated.z);
      const x = centerX + rotated.x * scale * perspective;
      const y = centerY + rotated.y * scale * perspective;
      if (x < -20 || x > size.width + 20 || y < -20 || y > size.height + 20) return;

      const glow = clamp(0.11 + perspective * 0.34, 0.1, 0.52);
      const base = particle.tone < 0.52
        ? mixRgb(amber, gold, particle.tone / 0.52)
        : mixRgb(violet, magenta, (particle.tone - 0.52) / 0.48);
      const radius = particle.size * perspective * (size.width < 720 ? 0.86 : 1.0);

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = cssRgb(base, glow);
      ctx.fill();
    });

    ctx.globalCompositeOperation = "source-over";
    requestAnimationFrame(draw);
  }

  build();
  draw();
}

function initSpotlight(container) {
  const cards = Array.from(container.children);
  if (!cards.length || window.matchMedia("(pointer: coarse)").matches) return;

  function update(event) {
    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

    cards.forEach((card) => {
      const cardRect = card.getBoundingClientRect();
      card.style.setProperty("--mouse-x", `${event.clientX - cardRect.left}px`);
      card.style.setProperty("--mouse-y", `${event.clientY - cardRect.top}px`);
    });
  }

  container.addEventListener("pointermove", update, { passive: true });
}

function initParallaxPanels() {
  const panels = Array.from(document.querySelectorAll("[data-parallax-panel]"));
  if (!panels.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let ticking = false;
  function update() {
    const viewport = window.innerHeight || document.documentElement.clientHeight;
    panels.forEach((panel) => {
      const rect = panel.getBoundingClientRect();
      const start = viewport;
      const end = viewport * 0.22;
      const progress = clamp((start - rect.top) / (start - end), 0, 1);
      panel.style.setProperty("--parallax-progress", progress.toFixed(3));
    });
    ticking = false;
  }

  function requestUpdate() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  update();
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate, { passive: true });
}

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
  navToggle.setAttribute("aria-label", isOpen ? "Fechar menu" : "Abrir menu");
});

navMenu?.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) {
    navMenu.classList.remove("is-open");
    document.body.classList.remove("menu-open");
    navToggle?.setAttribute("aria-expanded", "false");
    navToggle?.setAttribute("aria-label", "Abrir menu");
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

leadForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!leadForm.checkValidity()) {
    feedback.textContent = "Preencha os campos obrigatórios para enviar sua mensagem.";
    feedback.classList.add("is-error");
    leadForm.reportValidity();
    return;
  }

  const submitButton = leadForm.querySelector(".form-submit");
  const originalLabel = submitButton?.textContent || "";
  const data = new FormData(leadForm);
  data.set("_subject", `Novo contato pelo site OrddO - ${formValue(data, "empresa")}`);

  feedback.textContent = "Enviando sua mensagem...";
  feedback.classList.remove("is-error");

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Enviando...";
  }

  try {
    const response = await fetch(leadForm.action, {
      method: "POST",
      body: data,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error("Form submission failed");
    }

    feedback.textContent = "Mensagem enviada. Retornaremos pelo e-mail informado.";
    leadForm.reset();
  } catch (error) {
    feedback.textContent =
      "Não conseguimos enviar agora. Escreva para contato@orddo.com.br.";
    feedback.classList.add("is-error");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalLabel;
    }
  }
});
