// Comportamiento general: aparición al hacer scroll, navbar (sección activa), tema claro/oscuro
// y resplandor de las tarjetas.

const root = document.documentElement;

// Idioma de la página (<html lang="es|en">) y textos que genera el JavaScript
const LANG = root.lang === 'en' ? 'en' : 'es';
const TEXT = {
  es: { themeToLight: 'Cambiar a tema claro', themeToDark: 'Cambiar a tema oscuro' },
  en: { themeToLight: 'Switch to light theme', themeToDark: 'Switch to dark theme' },
}[LANG];

// 1. Animaciones de aparición al hacer scroll
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal, .card, .timeline-item, .skill-group, .cert')
  .forEach((el) => revealObserver.observe(el));

// 2. Navbar: sombra al hacer scroll y sección activa
const nav = document.getElementById('nav');
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-item');
const lastSectionId = sections[sections.length - 1].id;
let currentId = sections[0].id;
let shownId = null;

function setActive(id) {
  if (id === shownId) return;
  shownId = id;
  navLinks.forEach((link) => {
    const on = link.dataset.link === id;
    link.classList.toggle('active', on);
    if (on) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

// Sección activa: la que cruza una franja fina al 35% de la altura de la ventana.
// IntersectionObserver evita leer posiciones (layout) en cada evento de scroll.
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      currentId = entry.target.id;
      setActive(currentId);
    }
  });
}, { rootMargin: '-35% 0px -64% 0px' });
sections.forEach((sec) => sectionObserver.observe(sec));

// El scroll solo gestiona la sombra y el final de página (limitado a un cálculo por frame)
let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
    const atBottom = window.innerHeight + window.scrollY >= root.scrollHeight - 4;
    setActive(atBottom ? lastSectionId : currentId);
    ticking = false;
  });
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// 3. Botón de tema claro / oscuro (recuerda la elección)
const themeToggle = document.getElementById('themeToggle');

function updateThemeLabel() {
  const isLight = root.getAttribute('data-theme') === 'light';
  themeToggle.setAttribute('aria-label', isLight ? TEXT.themeToDark : TEXT.themeToLight);
}
updateThemeLabel();

themeToggle.addEventListener('click', () => {
  const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  root.setAttribute('data-theme', next);
  try { localStorage.setItem('theme', next); } catch (e) { /* sin almacenamiento */ }
  updateThemeLabel();
});

// 4. Resplandor de las tarjetas que sigue al mouse (solo dispositivos con hover)
if (window.matchMedia('(hover: hover)').matches) {
  document.querySelectorAll('.card').forEach((card) => {
    let frame = 0;
    card.addEventListener('mousemove', (e) => {
      if (frame) return;
      const { clientX, clientY } = e;
      frame = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${clientX - rect.left}px`);
        card.style.setProperty('--my', `${clientY - rect.top}px`);
        frame = 0;
      });
    });
  });
}

// 5. Cambio de idioma (ES / EN): lleva a la misma sección en el otro idioma y recuerda la elección
const langSwitch = document.getElementById('langSwitch');
if (langSwitch) {
  // Con file:// (abrir el archivo directamente) una carpeta no carga su index.html
  const base = langSwitch.getAttribute('href') + (location.protocol === 'file:' ? 'index.html' : '');
  const syncHref = () => {
    const section = typeof shownId === 'string' && shownId !== 'inicio' ? '#' + shownId : '';
    langSwitch.setAttribute('href', base + section);
  };
  syncHref();
  ['pointerenter', 'focus', 'touchstart'].forEach((ev) => langSwitch.addEventListener(ev, syncHref, { passive: true }));
  langSwitch.addEventListener('click', () => {
    syncHref();
    try { localStorage.setItem('lang', langSwitch.getAttribute('hreflang')); } catch (e) { /* sin almacenamiento */ }
  });
}
