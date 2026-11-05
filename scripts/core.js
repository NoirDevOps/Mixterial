(function (global) {
  'use strict';

  const BASE = 'https://noirdevops.github.io/Mixterial/';
  const CSS_COMPONENTS_BASE = BASE + 'styling/components/';
  const THEMES_BASE = BASE + 'styling/themes/basic/';
  const JS_MODULES_BASE = BASE + 'scripts/modules/';

  const CSS_FILES = [
    'variables.css',
    'reset.css',
    'animations.css',
    'badges.css',
    'bars.css',
    'buttons.css',
    'cards.css',
    'colour-picker.css',
    'containers.css',
    'loaders.css',
    'menus.css',
    'sliders.css',
    'tables.css',
    'text.css',
    'toggles.css',
    'forms.css',
    'icons.css',
    'navigation.css',
    'feedback.css',
    'grid.css',
    'avatars.css',
    'chips.css',
    'progress.css',
    'lists.css',
    'accordion.css',
    'code.css',
    'user-experience.css',
    'print.css'
  ];

  const THEMES = {
    light: THEMES_BASE + 'light.css',
    dark: THEMES_BASE + 'dark.css',
    midnight: THEMES_BASE + 'midnight.css',
    amoled: THEMES_BASE + 'amoled.css'
  };

  const THEME_ATTR = 'data-mxt-theme';
  const THEME_STORAGE_KEY = 'mxt-theme';
  const THEME_TRANSITION_CLASS = 'mxt-theme-transitioning';
  const THEME_TRANSITION_MS = 240;
  const DEFAULT_THEME = 'light';

  const MXT = global.Mixterial || {};
  let currentTheme = null;
  let themeTransitionTimer = null;
  let bootPromise = null;
  const loadedLinks = {};

  function readStoredTheme() {
    try {
      const v = global.localStorage.getItem(THEME_STORAGE_KEY);
      if (v && THEMES[v]) return v;
    } catch (e) {}
    return null;
  }

  function storeTheme(name) {
    try {
      global.localStorage.setItem(THEME_STORAGE_KEY, name);
    } catch (e) {}
  }

  function applyThemeAttribute(name) {
    const root = document.documentElement;
    if (!root) return;
    if (name === DEFAULT_THEME) {
      root.removeAttribute(THEME_ATTR);
    } else {
      root.setAttribute(THEME_ATTR, name);
    }
    if (document.body) {
      if (name === DEFAULT_THEME) {
        document.body.removeAttribute(THEME_ATTR);
      } else {
        document.body.setAttribute(THEME_ATTR, name);
      }
    }
  }

  function bootThemeSync() {
    const root = document.documentElement;
    if (!root) {
      currentTheme = DEFAULT_THEME;
      return DEFAULT_THEME;
    }
    const attrTheme = root.getAttribute(THEME_ATTR);
    const stored = readStoredTheme();
    let chosen = DEFAULT_THEME;
    if (stored) chosen = stored;
    else if (attrTheme && THEMES[attrTheme]) chosen = attrTheme;
    currentTheme = chosen;
    applyThemeAttribute(chosen);
    root.style.colorScheme = chosen === DEFAULT_THEME ? 'light' : 'dark';
    return chosen;
  }

  function appendLink(id, href, rel, extra) {
    let link = document.getElementById(id);
    if (link) {
      if (link.getAttribute('href') === href) return link;
      link.setAttribute('href', href);
      return link;
    }
    link = document.createElement('link');
    link.id = id;
    link.rel = rel || 'stylesheet';
    link.href = href;
    if (extra) {
      Object.keys(extra).forEach(function (k) {
        link.setAttribute(k, extra[k]);
      });
    }
    document.head.appendChild(link);
    return link;
  }

  function loadStylesheet(id, href) {
    if (loadedLinks[id]) return loadedLinks[id];
    loadedLinks[id] = new Promise(function (resolve) {
      const link = appendLink(id, href);
      if (link.sheet) { resolve(); return; }
      let settled = false;
      function done() {
        if (settled) return;
        settled = true;
        resolve();
      }
      link.addEventListener('load', done, { once: true });
      link.addEventListener('error', done, { once: true });
      setTimeout(done, 6000);
    });
    return loadedLinks[id];
  }

  function loadScript(src, id) {
    if (id && document.getElementById(id)) {
      return Promise.resolve();
    }
    return new Promise(function (resolve) {
      const script = document.createElement('script');
      script.src = src;
      if (id) script.id = id;
      script.async = false;
      script.onload = function () { resolve(); };
      script.onerror = function () { resolve(); };
      document.head.appendChild(script);
    });
  }

  function ensureStyles() {
    if (document.getElementById('mxt-core-variables')) {
      return Promise.resolve();
    }
    const tasks = CSS_FILES.map(function (file) {
      const id = 'mxt-core-' + file.replace(/\.css$/, '');
      return loadStylesheet(id, CSS_COMPONENTS_BASE + file);
    });
    return Promise.all(tasks);
  }

  function ensureThemes() {
    const tasks = Object.keys(THEMES).map(function (name) {
      const id = 'mxt-theme-stylesheet-' + name;
      return loadStylesheet(id, THEMES[name]);
    });
    return Promise.all(tasks);
  }

  function withTransition(fn) {
    const root = document.documentElement;
    if (!root) { fn(); return; }
    root.dataset.mxtThemeTransition = 'true';
    root.classList.add(THEME_TRANSITION_CLASS);
    const style = document.createElement('style');
    style.id = 'mxt-theme-transition-style';
    style.textContent = '.' + THEME_TRANSITION_CLASS + ' *:not(.mxt-theme-no-transition),.' + THEME_TRANSITION_CLASS + ' *:not(.mxt-theme-no-transition)::before,.' + THEME_TRANSITION_CLASS + ' *:not(.mxt-theme-no-transition)::after{transition:background-color ' + THEME_TRANSITION_MS + 'ms ease,color ' + THEME_TRANSITION_MS + 'ms ease,border-color ' + THEME_TRANSITION_MS + 'ms ease,fill ' + THEME_TRANSITION_MS + 'ms ease,stroke ' + THEME_TRANSITION_MS + 'ms ease,box-shadow ' + THEME_TRANSITION_MS + 'ms ease,outline-color ' + THEME_TRANSITION_MS + 'ms ease !important;}';
    document.head.appendChild(style);
    fn();
    clearTimeout(themeTransitionTimer);
    themeTransitionTimer = setTimeout(function () {
      root.classList.remove(THEME_TRANSITION_CLASS);
      delete root.dataset.mxtThemeTransition;
      const s = document.getElementById('mxt-theme-transition-style');
      if (s) s.remove();
    }, THEME_TRANSITION_MS + 40);
  }

  function dispatch(name, detail) {
    try {
      document.dispatchEvent(new CustomEvent(name, { bubbles: true, cancelable: true, detail: detail || {} }));
    } catch (e) {}
  }

  function setTheme(name, options) {
    const opts = options || {};
    const target = THEMES[name] ? name : DEFAULT_THEME;
    if (currentTheme === target && !opts.force) {
      return Promise.resolve(target);
    }
    const previous = currentTheme;
    currentTheme = target;
    storeTheme(target);
    dispatch('mxt:theme-before-change', { from: previous, to: target });
    withTransition(function () {
      applyThemeAttribute(target);
      const root = document.documentElement;
      if (root) root.style.colorScheme = target === DEFAULT_THEME ? 'light' : 'dark';
      dispatch('mxt:theme-change', { from: previous, to: target });
    });
    requestAnimationFrame(function () {
      dispatch('mxt:theme-changed', { from: previous, to: target });
    });
    return Promise.resolve(target);
  }

  function getTheme() {
    return currentTheme;
  }

  function getThemes() {
    return Object.keys(THEMES);
  }

  function toggleTheme() {
    const order = ['light', 'dark', 'midnight', 'amoled'];
    const idx = order.indexOf(currentTheme);
    const next = order[(idx + 1) % order.length];
    return setTheme(next);
  }

  function loadFunctionality() {
    return loadScript(JS_MODULES_BASE + 'functionality.js', 'mxt-functionality');
  }

  function bindThemeSwitchers() {
    if (!document || !document.querySelectorAll) return;
    document.querySelectorAll('[data-mxt-theme-switch]').forEach(function (el) {
      if (el.dataset.mxtCoreBound === 'true') return;
      el.dataset.mxtCoreBound = 'true';
      el.addEventListener('click', function (e) {
        e.preventDefault();
        const theme = el.getAttribute('data-mxt-theme-switch');
        if (theme && THEMES[theme]) setTheme(theme);
      });
    });
    document.querySelectorAll('[data-mxt-theme-toggle]').forEach(function (el) {
      if (el.dataset.mxtCoreBound === 'true') return;
      el.dataset.mxtCoreBound = 'true';
      el.addEventListener('click', function (e) {
        e.preventDefault();
        toggleTheme();
      });
    });
  }

  function boot() {
    if (bootPromise) return bootPromise;
    ensureStyles();
    bootPromise = ensureThemes().then(function () {
      return loadFunctionality();
    }).then(function () {
      if (global.Mixterial) {
        global.Mixterial.setTheme = setTheme;
        global.Mixterial.getTheme = getTheme;
        global.Mixterial.getThemes = getThemes;
        global.Mixterial.toggleTheme = toggleTheme;
        global.Mixterial.THEMES = THEMES;
        global.Mixterial.core = true;
      }
      if (document.body) document.body.classList.add('mxt-core-ready');
      bindThemeSwitchers();
      dispatch('mxt:core-ready', { theme: currentTheme });
    });
    return bootPromise;
  }

  bootThemeSync();

  MXT.setTheme = setTheme;
  MXT.getTheme = getTheme;
  MXT.getThemes = getThemes;
  MXT.toggleTheme = toggleTheme;
  MXT.boot = boot;
  MXT.THEMES = THEMES;
  MXT.CSS_FILES = CSS_FILES;
  MXT.version = '1.0.0';

  global.Mixterial = MXT;
  global.MXT = MXT;

  if (global.addEventListener) {
    global.addEventListener('storage', function (e) {
      if (e.key !== THEME_STORAGE_KEY || !e.newValue) return;
      if (THEMES[e.newValue] && e.newValue !== currentTheme) {
        setTheme(e.newValue);
      }
    });
  }

  if (typeof MutationObserver === 'function') {
    const observer = new MutationObserver(function (mutations) {
      let needsBind = false;
      mutations.forEach(function (m) {
        if (m.type === 'childList' && m.addedNodes.length) {
          m.addedNodes.forEach(function (n) {
            if (n.nodeType === 1) {
              if (n.matches && (n.matches('[data-mxt-theme-switch]') || n.matches('[data-mxt-theme-toggle]'))) {
                needsBind = true;
              } else if (n.querySelector && n.querySelector('[data-mxt-theme-switch], [data-mxt-theme-toggle]')) {
                needsBind = true;
              }
            }
          });
        }
      });
      if (needsBind) bindThemeSwitchers();
    });
    const startObserving = function () {
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startObserving, { once: true });
    } else {
      startObserving();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : this);
