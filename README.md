# Portfolio — Jaider Betancur

Personal developer portfolio built as a **static site**: plain HTML, CSS and JavaScript, with no frameworks and no build step. Designed to be published on **GitHub Pages**.

> The site content is written in Spanish.

## Structure

```
portfolio/
├── index.html          # Site structure and content (HTML)
├── 404.html            # Error page (GitHub Pages serves it automatically; its CSS is inline on purpose)
├── README.md
├── .gitignore
└── assets/
    ├── css/
    │   └── styles.css                                       # All styles (color variables at the top)
    ├── js/
    │   ├── main.js                                          # Scroll reveal, navbar, light/dark theme, card glow
    │   ├── hero-lines.js                                    # Animated WebGL lines in the hero
    │   ├── particles.js                                     # Background particles (tsParticles)
    │   └── avatar.js                                        # 3D-flip avatar with a WebGL particle sphere
    ├── cv/
    │   ├── jaider-betancur-ingeniero-software-cv-2026.pdf   # File served by the "Descargar CV" button
    │   └── cv.md                                            # Plain-text source of the CV
    ├── images/
    │   └── avatar.jpg                                       # Hero photo
    └── icons/                                               # SVG logos grouped by category
        ├── backend/       ├── frontend/      ├── ai/
        ├── cloud/         ├── database/      ├── architecture/
        └── management/
```

`index.html` and `404.html` must stay in the repository root. The scripts are plain files (not ES modules) loaded in the order `main → hero-lines → particles → avatar`, so the site also works when `index.html` is opened by double-clicking it.

## Run locally

Nothing to install. From this folder:

```bash
python3 -m http.server 8000
```

then open <http://localhost:8000>. Opening `index.html` directly in the browser also works.

> `404.html` is only served automatically on GitHub Pages; a regular local server shows its own error page.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repository, go to **Settings → Pages**.
3. Under *Build and deployment*, choose **Deploy from a branch**, branch `main`, folder `/ (root)`.
4. Wait a minute or two: the site goes live at `https://<username>.github.io/<repository>/`.

If the repository is named `<username>.github.io`, the site is served from the domain root. In that case, in `404.html` change `var SITE_ROOT = null;` to `var SITE_ROOT = '/';` so the "Volver al inicio" button points to the right place.

## Where to change things

| What you want to change | Where |
|---|---|
| Colors and fonts | `:root` variables at the top of `assets/css/styles.css` (`--bg`, `--accent`, …). The light theme lives in `[data-theme="light"]` |
| Hero text and the availability badge | `<section id="inicio">`; the badge texts have a comment next to them |
| Experience, education and skills | Their sections in the HTML (`#experiencia`, `#habilidades`, `#educacion`) |
| Versions shown on hover (Java, Angular) | `data-tip` attribute of the matching `<li class="skill-item">` |
| A new skill icon | Save the SVG in `assets/icons/<category>/` and add a `<li class="skill-item">` |
| Downloadable CV | Replace the PDF in `assets/cv/`; if the file name changes, update the button's `href` |
| Photo | Replace `assets/images/avatar.jpg` (600×600 px or larger is ideal) |
| Email, GitHub and LinkedIn | `#contacto` section (the email appears in two rows of the HTML) |
| Footer (`OpenToWork · Only Remote`) | `<footer>` at the end of the HTML |
| Styles of a section | Its numbered block in `assets/css/styles.css`; the responsive rules are at the end of the file |
| Behavior / effects | The matching file in `assets/js/` (see the structure above) |

## Sections and effects

- **Projects** is commented out. To show it, search for `PROYECTOS_OCULTO` and remove the three comments (navbar, section and contact directory).
- **Animated hero lines (WebGL):** turn them off from the console with `destroyHeroLines()`, or remove the `<script src="assets/js/hero-lines.js">` tag from the HTML.
- **3D-flip avatar and particle sphere:** `assets/js/avatar.js`, function `initCrystalBall()`; the particle count is the `COUNT` constant.
- **Background particles (tsParticles):** `assets/js/particles.js`, the `options` object inside `initSectionParticles()`.
- All effects respect `prefers-reduced-motion` and are disabled on screens narrower than 900 px.

## External dependencies

- **tsParticles 2.12.0** from jsDelivr, pinned to an exact version with Subresource Integrity (SRI). If it fails to load, the site keeps working without that background.
- **Google Fonts**: Inter and JetBrains Mono.

There are no other dependencies: no `npm`, no build step.

Only one tiny inline script remains in the `<head>` of `index.html`: it applies the saved theme before the first paint (this avoids a theme flash), so it was not moved to a file.

## Icon credits

Logos belong to their respective owners and are shown only to indicate technologies I know.

- [Simple Icons](https://simpleicons.org) (CC0): most brand logos.
- [Devicon](https://devicon.dev) (MIT): Angular, SQL Server, MySQL, PostgreSQL, Redis and Azure DevOps.
- [SVG Logos](https://github.com/gilbarbara/logos): Java, Kiro and Figma.
- [IcePanel](https://icon.icepanel.io): AWS service icons.
- [Lucide](https://lucide.dev) (ISC): concept icons (REST, CI/CD, SOLID…) and the navbar icons.

## Privacy

The PDF and `assets/cv/cv.md` include a phone number. Published repositories and sites expose them, so remove it from both if you do not want it to be public.
