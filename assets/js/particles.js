// Partículas conectadas (tsParticles) de las secciones intermedias. Requiere el script de tsParticles del <head>.

// 7. Partículas conectadas (tsParticles) en las secciones intermedias.
//    No se inicializan con prefers-reduced-motion ni en pantallas < 900 px.
function initSectionParticles() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.innerWidth < 900) return;
  if (typeof tsParticles === 'undefined') return;   // CDN no disponible: la página sigue igual

  const options = {
    fullScreen: { enable: false },                   // el canvas vive dentro de cada sección
    background: { color: { value: 'transparent' } },
    fpsLimit: 60,
    detectRetina: true,
    particles: {
      number: { value: 50, density: { enable: true, area: 800 } },
      color: { value: '#A795FF' },
      links: { enable: true, distance: 150, color: '#7C5CFF', opacity: 0.2, width: 1 },
      move: { enable: true, speed: 1, direction: 'none', outModes: { default: 'out' } },
      size: { value: { min: 1, max: 2.5 } },
      opacity: { value: { min: 0.15, max: 0.4 } },
    },
    interactivity: {
      events: {
        onHover: { enable: true, mode: 'grab' },
        onClick: { enable: true, mode: 'push' },
      },
      modes: {
        grab: { distance: 140, links: { opacity: 0.6 } },
        push: { quantity: 4 },
      },
    },
  };

  // Cada sección anima solo mientras está en pantalla (ahorra CPU/batería)
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const c = entry.target._tsContainer;
          if (!c) return;
          if (entry.isIntersecting) c.play(); else c.pause();
        });
      }, { rootMargin: '100px 0px' })
    : null;

  document.querySelectorAll('.particles-bg').forEach((el) => {
    tsParticles.load(el.id, JSON.parse(JSON.stringify(options)))
      .then((container) => {
        if (!container) return;
        el._tsContainer = container;
        if (io) io.observe(el);
      })
      .catch(() => { /* sin partículas, sin errores visibles */ });
  });
}

// La librería se carga con "defer": se espera a que el documento termine de analizarse
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSectionParticles);
} else {
  initSectionParticles();
}
