const _cache = {};

async function loadTranslations(lang) {
    if (_cache[lang]) return _cache[lang];
    const res = await fetch(`i18n/${lang}.json`);
    _cache[lang] = await res.json();
    return _cache[lang];
}

function applyTranslations(t) {
    // Text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const val = t[el.dataset.i18n];
        if (val !== undefined) el.textContent = val;
    });

    // HTML content (for descriptions with <b> tags)
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const val = t[el.dataset.i18nHtml];
        if (val !== undefined) el.innerHTML = val;
    });

    // Attributes (data-i18n-attr="attr:key")
    document.querySelectorAll('[data-i18n-attr]').forEach(el => {
        const [attr, key] = el.dataset.i18nAttr.split(':');
        const val = t[key];
        if (val !== undefined) el.setAttribute(attr, val);
    });

    // Href (for CV download links that differ per language)
    document.querySelectorAll('[data-i18n-href]').forEach(el => {
        const val = t[el.dataset.i18nHref];
        if (val !== undefined) el.href = val;
    });

    // Meta tags
    const setMeta = (sel, val) => document.querySelector(sel)?.setAttribute('content', val);
    if (t['meta.description']) setMeta('meta[name="description"]', t['meta.description']);
    if (t['og.description'])   setMeta('meta[property="og:description"]', t['og.description']);
    if (t['og.url'])           setMeta('meta[property="og:url"]', t['og.url']);
    if (t['twitter.description']) setMeta('meta[name="twitter:description"]', t['twitter.description']);

    // Phone reveal button — reset text if not yet revealed
    const phone = document.getElementById('phone-display');
    if (phone && phone.dataset.revealed !== 'true') {
        phone.textContent = t['contact.phone.reveal'] || '';
    }
}

async function setLanguage(lang) {
    document.documentElement.lang = lang;
    localStorage.setItem('portfolio-lang', lang);
    const t = await loadTranslations(lang);
    applyTranslations(t);
    document.querySelectorAll('[data-lang]').forEach(btn => {
        btn.classList.toggle('fw-bold', btn.dataset.lang === lang);
        btn.classList.toggle('text-white', btn.dataset.lang === lang);
        btn.classList.toggle('text-white-50', btn.dataset.lang !== lang);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('portfolio-lang') || 'fr';
    setLanguage(saved);

    document.querySelectorAll('[data-lang]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.preventDefault();
            setLanguage(btn.dataset.lang);
        });
    });
});
