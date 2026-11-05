(function (global) {
  'use strict';

  const MXT = {};
  const THEMES = {
    light: 'https://noirdevops.github.io/Mixterial/styling/themes/basic/light.css',
    dark: 'https://noirdevops.github.io/Mixterial/styling/themes/basic/dark.css',
    midnight: 'https://noirdevops.github.io/Mixterial/styling/themes/basic/midnight.css',
    amoled: 'https://noirdevops.github.io/Mixterial/styling/themes/basic/amoled.css'
  };
  const THEME_ATTR = 'data-mxt-theme';
  const THEME_STORAGE_KEY = 'mxt-theme';
  const THEME_STYLESHEET_ID = 'mxt-theme-stylesheet';
  const THEME_TRANSITION_CLASS = 'mxt-theme-transitioning';
  const THEME_TRANSITION_MS = 240;
  const DEFAULT_THEME = 'light';

  let currentTheme = null;
  let themeTransitionTimer = null;
  let themeReadyPromise = null;

  function noop() {}

  function isElement(value) {
    return value instanceof Element;
  }

  function isNode(value) {
    return value instanceof Node;
  }

  function toArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return Array.prototype.slice.call(document.querySelectorAll(value));
    if (isNode(value) && value.length !== undefined && !isElement(value)) {
      return Array.prototype.slice.call(value);
    }
    return [value];
  }

  function each(collection, fn) {
    toArray(collection).forEach(fn);
  }

  function on(target, event, handler, options) {
    if (!target) return noop;
    const events = String(event).split(/\s+/);
    events.forEach(function (evt) {
      if (!evt) return;
      target.addEventListener(evt, handler, options);
    });
    return function off() {
      events.forEach(function (evt) {
        if (!evt) return;
        target.removeEventListener(evt, handler, options);
      });
    };
  }

  function delegate(root, event, selector, handler, options) {
    if (!root) return noop;
    const listener = function (e) {
      const target = e.target.closest ? e.target.closest(selector) : null;
      if (target && root.contains(target)) {
        handler.call(target, e, target);
      }
    };
    return on(root, event, listener, options);
  }

  function emit(target, name, detail) {
    if (!target) return;
    const evt = new CustomEvent(name, { bubbles: true, cancelable: true, detail: detail || {} });
    target.dispatchEvent(evt);
  }

  function uid(prefix) {
    return (prefix || 'mxt') + '-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
  }

  function throttle(fn, wait) {
    let last = 0;
    let timer = null;
    return function () {
      const now = Date.now();
      const args = arguments;
      const ctx = this;
      const remaining = wait - (now - last);
      if (remaining <= 0) {
        if (timer) { clearTimeout(timer); timer = null; }
        last = now;
        fn.apply(ctx, args);
      } else if (!timer) {
        timer = setTimeout(function () {
          last = Date.now();
          timer = null;
          fn.apply(ctx, args);
        }, remaining);
      }
    };
  }

  function debounce(fn, wait) {
    let timer = null;
    return function () {
      const args = arguments;
      const ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  function raf(fn) {
    if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(fn);
    return setTimeout(fn, 16);
  }

  function nextFrame(fn) {
    raf(function () { raf(fn); });
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function closest(el, selector) {
    if (!el || !el.closest) return null;
    return el.closest(selector);
  }

  function matches(el, selector) {
    if (!el || !el.matches) return false;
    return el.matches(selector);
  }

  function focusable(root) {
    if (!root) return [];
    return Array.prototype.slice.call(root.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(function (el) {
      return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
    });
  }

  function lockScroll() {
    if (document.body.dataset.mxtScrollLocked === 'true') {
      document.body.dataset.mxtScrollCount = String((parseInt(document.body.dataset.mxtScrollCount || '0', 10) || 0) + 1);
      return;
    }
    const scrollY = window.scrollY || window.pageYOffset || 0;
    document.body.dataset.mxtScrollY = String(scrollY);
    document.body.dataset.mxtScrollLocked = 'true';
    document.body.dataset.mxtScrollCount = '1';
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + scrollY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
  }

  function unlockScroll(force) {
    const count = parseInt(document.body.dataset.mxtScrollCount || '1', 10) || 1;
    if (!force && count > 1) {
      document.body.dataset.mxtScrollCount = String(count - 1);
      return;
    }
    const scrollY = parseInt(document.body.dataset.mxtScrollY || '0', 10) || 0;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    delete document.body.dataset.mxtScrollLocked;
    delete document.body.dataset.mxtScrollY;
    delete document.body.dataset.mxtScrollCount;
    window.scrollTo(0, scrollY);
  }

  function focusTrap(container) {
    const nodes = focusable(container);
    if (!nodes.length) return noop;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const prevActive = document.activeElement;
    function handleKey(e) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    const off = on(container, 'keydown', handleKey);
    if (first && typeof first.focus === 'function') first.focus();
    return function release() {
      off();
      if (prevActive && typeof prevActive.focus === 'function') prevActive.focus();
    };
  }

  function getStoredTheme() {
    try {
      const value = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (value && THEMES[value]) return value;
    } catch (e) {}
    return null;
  }

  function storeTheme(name) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, name);
    } catch (e) {}
  }

  function ensureThemeStylesheetLink() {
    let link = document.getElementById(THEME_STYLESHEET_ID);
    if (link) return link;
    link = document.createElement('link');
    link.rel = 'stylesheet';
    link.id = THEME_STYLESHEET_ID;
    link.dataset.mxtThemeLink = 'true';
    document.head.appendChild(link);
    return link;
  }

  function preloadThemes() {
    Object.keys(THEMES).forEach(function (name) {
      const existing = document.querySelector('link[data-mxt-theme-preload="' + name + '"]');
      if (existing) return;
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'style';
      link.href = THEMES[name];
      link.dataset.mxtThemePreload = name;
      link.onload = function () {
        link.rel = 'stylesheet';
        link.onload = null;
        link.dataset.mxtThemePreload = 'ready';
      };
      document.head.appendChild(link);
    });
  }

  function applyThemeAttribute(name) {
    const root = document.documentElement;
    if (name === 'light') {
      root.removeAttribute(THEME_ATTR);
    } else {
      root.setAttribute(THEME_ATTR, name);
    }
    if (document.body) {
      if (name === 'light') {
        document.body.removeAttribute(THEME_ATTR);
      } else {
        document.body.setAttribute(THEME_ATTR, name);
      }
    }
  }

  function withTransition(fn) {
    const root = document.documentElement;
    if (!root || root.dataset.mxtThemeTransition === 'true') {
      fn();
      return;
    }
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

  function loadThemeStylesheet(name) {
    return new Promise(function (resolve) {
      const href = THEMES[name];
      if (!href) { resolve(); return; }
      const existing = document.getElementById(THEME_STYLESHEET_ID);
      if (existing && existing.dataset.mxtThemeName === name && existing.href === href) {
        resolve();
        return;
      }
      const preloaded = document.querySelector('link[data-mxt-theme-preload="' + name + '"]');
      if (preloaded && preloaded.sheet) {
        const link = ensureThemeStylesheetLink();
        link.dataset.mxtThemeName = name;
        link.href = href;
        link.onload = null;
        link.onerror = null;
        const cleanup = function () {
          if (existing && existing !== link && existing.parentNode) existing.parentNode.removeChild(existing);
          link.onload = null;
          link.onerror = null;
        };
        link.onload = function () { cleanup(); resolve(); };
        link.onerror = function () { cleanup(); resolve(); };
        link.href = href;
        if (link.sheet) { cleanup(); resolve(); }
        return;
      }
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset.mxtThemeName = name;
      link.onload = function () {
        const previous = document.getElementById(THEME_STYLESHEET_ID);
        link.id = THEME_STYLESHEET_ID;
        if (previous && previous !== link && previous.parentNode) previous.parentNode.removeChild(previous);
        link.onload = null;
        link.onerror = null;
        resolve();
      };
      link.onerror = function () {
        link.onload = null;
        link.onerror = null;
        resolve();
      };
      document.head.appendChild(link);
    });
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
    emit(document, 'mxt:theme-before-change', { from: previous, to: target });
    return new Promise(function (resolve) {
      loadThemeStylesheet(target).then(function () {
        withTransition(function () {
          applyThemeAttribute(target);
          emit(document, 'mxt:theme-change', { from: previous, to: target });
        });
        nextFrame(function () {
          emit(document, 'mxt:theme-changed', { from: previous, to: target });
          resolve(target);
        });
      });
    });
  }

  function getTheme() {
    return currentTheme;
  }

  function toggleTheme() {
    const order = ['light', 'dark', 'midnight', 'amoled'];
    const idx = order.indexOf(currentTheme);
    const next = order[(idx + 1) % order.length];
    return setTheme(next);
  }

  function initTheme() {
    if (themeReadyPromise) return themeReadyPromise;
    const root = document.documentElement;
    const attrTheme = root.getAttribute(THEME_ATTR);
    const stored = getStoredTheme();
    let chosen = DEFAULT_THEME;
    if (stored) chosen = stored;
    else if (attrTheme && THEMES[attrTheme]) chosen = attrTheme;
    preloadThemes();
    themeReadyPromise = setTheme(chosen, { force: true }).then(function () {
      return chosen;
    });
    return themeReadyPromise;
  }

  MXT.THEMES = THEMES;
  MXT.setTheme = setTheme;
  MXT.getTheme = getTheme;
  MXT.toggleTheme = toggleTheme;
  MXT.initTheme = initTheme;
  MXT.ready = ready;
  MXT.each = each;
  MXT.on = on;
  MXT.delegate = delegate;
  MXT.emit = emit;
  MXT.uid = uid;
  MXT.throttle = throttle;
  MXT.debounce = debounce;
  MXT.raf = raf;
  MXT.nextFrame = nextFrame;
  MXT.closest = closest;
  MXT.matches = matches;
  MXT.focusable = focusable;
  MXT.lockScroll = lockScroll;
  MXT.unlockScroll = unlockScroll;
  MXT.focusTrap = focusTrap;

  const Selector = {
    dismiss: '[data-mxt-dismiss]',
    toggle: '[data-mxt-toggle]',
    target: '[data-mxt-target]',
    open: '[data-mxt-open]',
    close: '[data-mxt-close]'
  };

  const ComponentRegistry = {
    accordion: [],
    tabs: [],
    menu: [],
    dropdown: [],
    contextMenu: [],
    sheet: [],
    sideMenu: [],
    modal: [],
    toast: [],
    tooltip: [],
    popover: [],
    slider: [],
    colourPicker: [],
    fileInput: [],
    chipInput: [],
    stepper: [],
    navbar: [],
    scrollSpy: [],
    copy: [],
    themeSwitcher: []
  };

  function register(name, instance) {
    if (!ComponentRegistry[name]) ComponentRegistry[name] = [];
    ComponentRegistry[name].push(instance);
    return instance;
  }

  function dismissAll(target) {
    const el = target ? closest(target, Selector.dismiss) : null;
    const scope = el ? el.closest('[data-mxt-dismiss-scope]') || document : document;
    scope.querySelectorAll('[data-mxt-dismissable]').forEach(function (node) {
      if (node === target || node.contains(target)) return;
      if (node.dataset.mxtDismissKeep === 'true') return;
      node.classList.add('mxt-hidden');
    });
  }

  function bindDismiss(root) {
    delegate(root, 'click', Selector.dismiss, function (e, trigger) {
      e.preventDefault();
      const targetSel = trigger.getAttribute('data-mxt-dismiss');
      if (targetSel) {
        document.querySelectorAll(targetSel).forEach(function (node) {
          node.classList.add('mxt-hidden');
          node.dispatchEvent(new CustomEvent('mxt:dismiss', { bubbles: true }));
        });
      } else {
        const scope = trigger.closest('[data-mxt-dismissable]');
        if (scope) {
          scope.classList.add('mxt-hidden');
          scope.dispatchEvent(new CustomEvent('mxt:dismiss', { bubbles: true }));
        }
      }
    });
  }

  function bindToggle(root) {
    delegate(root, 'click', Selector.toggle, function (e, trigger) {
      e.preventDefault();
      const targetSel = trigger.getAttribute('data-mxt-toggle');
      if (!targetSel) return;
      const nodes = document.querySelectorAll(targetSel);
      nodes.forEach(function (node) {
        const isHidden = node.hasAttribute('hidden') || node.classList.contains('mxt-hidden');
        if (isHidden) {
          node.removeAttribute('hidden');
          node.classList.remove('mxt-hidden');
          if (!node.classList.contains('mxt-modal-backdrop')) node.classList.add('mxt-toggle-open');
          node.dispatchEvent(new CustomEvent('mxt:open', { bubbles: true }));
        } else {
          node.classList.add('mxt-hidden');
          node.setAttribute('hidden', '');
          node.classList.remove('mxt-toggle-open');
          node.dispatchEvent(new CustomEvent('mxt:close', { bubbles: true }));
        }
      });
      trigger.setAttribute('aria-expanded', String(!trigger.getAttribute('aria-expanded') || trigger.getAttribute('aria-expanded') === 'false'));
    });
  }

  function autoInit(root) {
    root = root || document;
    initToggles(root);
    initCheckboxes(root);
    initAccordions(root);
    initTabs(root);
    initMenus(root);
    initDropdowns(root);
    initContextMenus(root);
    initSheets(root);
    initSideMenus(root);
    initModals(root);
    initToasts(root);
    initTooltips(root);
    initPopovers(root);
    initSliders(root);
    initColourPickers(root);
    initFileInputs(root);
    initChipInputs(root);
    initSteppers(root);
    initNavbars(root);
    initScrollSpy(root);
    initCopy(root);
    initThemeSwitchers(root);
  }

  function initToggles(root) {
    root.querySelectorAll('.mxt-toggle input, .mxt-switch input').forEach(function (input) {
      if (input.dataset.mxtBound === 'true') return;
      input.dataset.mxtBound = 'true';
      input.addEventListener('change', function () {
        const wrapper = input.closest('.mxt-toggle, .mxt-switch');
        if (wrapper) wrapper.classList.toggle('mxt-toggle-checked', input.checked);
        emit(input, 'mxt:toggle-change', { checked: input.checked, value: input.value });
      });
    });
  }

  function initCheckboxes(root) {
    root.querySelectorAll('.mxt-checkbox input, .mxt-radio input').forEach(function (input) {
      if (input.dataset.mxtBound === 'true') return;
      input.dataset.mxtBound = 'true';
      input.addEventListener('change', function () {
        const wrapper = input.closest('.mxt-checkbox, .mxt-radio');
        if (wrapper) wrapper.classList.toggle('mxt-checked', input.checked);
        if (input.type === 'radio' && input.name) {
          document.querySelectorAll('input[name="' + input.name + '"]').forEach(function (other) {
            if (other !== input) {
              const otherWrapper = other.closest('.mxt-radio');
              if (otherWrapper) otherWrapper.classList.remove('mxt-checked');
            }
          });
        }
        emit(input, 'mxt:check-change', { checked: input.checked, value: input.value });
      });
    });
  }

  function initAccordions(root) {
    root.querySelectorAll('.mxt-accordion').forEach(function (acc) {
      if (acc.dataset.mxtBound === 'true') return;
      acc.dataset.mxtBound = 'true';
      const single = acc.dataset.mxtAccordionSingle === 'true';
      acc.querySelectorAll('.mxt-accordion-trigger').forEach(function (trigger) {
        const item = trigger.closest('.mxt-accordion-item');
        if (!item) return;
        const panelId = trigger.getAttribute('aria-controls') || item.querySelector('.mxt-accordion-panel')?.id || uid('mxt-accordion-panel');
        trigger.setAttribute('aria-controls', panelId);
        const panel = item.querySelector('.mxt-accordion-panel') || item.querySelector('.mxt-accordion-body');
        if (panel && !panel.id) panel.id = panelId;
        trigger.setAttribute('aria-expanded', item.classList.contains('mxt-accordion-open') ? 'true' : 'false');
        trigger.addEventListener('click', function (e) {
          e.preventDefault();
          const isOpen = item.classList.contains('mxt-accordion-open');
          if (single) {
            acc.querySelectorAll('.mxt-accordion-item.mxt-accordion-open').forEach(function (other) {
              if (other !== item) {
                other.classList.remove('mxt-accordion-open');
                const t = other.querySelector('.mxt-accordion-trigger');
                if (t) t.setAttribute('aria-expanded', 'false');
              }
            });
          }
          item.classList.toggle('mxt-accordion-open', !isOpen);
          trigger.setAttribute('aria-expanded', String(!isOpen));
          emit(item, 'mxt:accordion-toggle', { open: !isOpen });
        });
      });
    });
    root.querySelectorAll('.mxt-accordion-details > summary').forEach(function (sum) {
      if (sum.dataset.mxtBound === 'true') return;
      sum.dataset.mxtBound = 'true';
      sum.addEventListener('click', function () {
        const details = sum.parentElement;
        emit(details, 'mxt:accordion-toggle', { open: details.open });
      });
    });
  }

  function initTabs(root) {
    root.querySelectorAll('.mxt-tabs').forEach(function (tabs) {
      if (tabs.dataset.mxtBound === 'true') return;
      tabs.dataset.mxtBound = 'true';
      const buttons = Array.prototype.slice.call(tabs.querySelectorAll('.mxt-tab'));
      if (!buttons.length) return;
      const group = tabs.dataset.mxtTabGroup || uid('mxt-tabs');
      const container = tabs.dataset.mxtTabContainer ? document.querySelector(tabs.dataset.mxtTabContainer) : null;
      const indicator = tabs.querySelector('.mxt-tabs-indicator');
      function activate(button, focus) {
        buttons.forEach(function (b) {
          b.classList.remove('mxt-tab-active');
          b.setAttribute('aria-selected', 'false');
          b.setAttribute('tabindex', '-1');
        });
        button.classList.add('mxt-tab-active');
        button.setAttribute('aria-selected', 'true');
        button.setAttribute('tabindex', '0');
        if (focus && typeof button.focus === 'function') button.focus();
        if (indicator) {
          const rect = button.getBoundingClientRect();
          const tabsRect = tabs.getBoundingClientRect();
          indicator.style.left = (rect.left - tabsRect.left + tabs.scrollLeft) + 'px';
          indicator.style.width = rect.width + 'px';
        }
        const targetSel = button.dataset.mxtTabTarget || button.getAttribute('aria-controls');
        if (targetSel) {
          const scope = container || tabs.parentElement || document;
          scope.querySelectorAll('.mxt-tab-panel').forEach(function (p) {
            if (p.id === targetSel || p.dataset.mxtTabPanel === targetSel) {
              p.classList.add('mxt-tab-panel-active');
              p.removeAttribute('hidden');
            } else if (p.closest('[data-mxt-tab-group="' + group + '"]') || tabs.contains(p)) {
              p.classList.remove('mxt-tab-panel-active');
              p.setAttribute('hidden', '');
            }
          });
          document.querySelectorAll('[data-mxt-tab-panel="' + targetSel + '"]').forEach(function (p) {
            p.classList.add('mxt-tab-panel-active');
            p.removeAttribute('hidden');
          });
        }
        emit(tabs, 'mxt:tab-change', { target: button, id: targetSel });
      }
      tabs.setAttribute('role', 'tablist');
      buttons.forEach(function (b, i) {
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', b.classList.contains('mxt-tab-active') ? 'true' : 'false');
        b.addEventListener('click', function () { activate(b, true); });
        b.addEventListener('keydown', function (e) {
          let idx = buttons.indexOf(b);
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            activate(buttons[(idx + 1) % buttons.length], true);
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            activate(buttons[(idx - 1 + buttons.length) % buttons.length], true);
          } else if (e.key === 'Home') {
            e.preventDefault();
            activate(buttons[0], true);
          } else if (e.key === 'End') {
            e.preventDefault();
            activate(buttons[buttons.length - 1], true);
          }
        });
      });
      const active = tabs.querySelector('.mxt-tab-active') || buttons[0];
      if (active) activate(active, false);
      const ro = new ResizeObserver(function () {
        const a = tabs.querySelector('.mxt-tab-active');
        if (a && indicator) {
          const rect = a.getBoundingClientRect();
          const tabsRect = tabs.getBoundingClientRect();
          indicator.style.left = (rect.left - tabsRect.left + tabs.scrollLeft) + 'px';
          indicator.style.width = rect.width + 'px';
        }
      });
      ro.observe(tabs);
    });
  }

  function positionWithin(el, anchor, placement) {
    if (!el || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const place = placement || 'bottom-start';
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const elRect = el.getBoundingClientRect();
    const w = elRect.width || 200;
    const h = elRect.height || 100;
    let top = 0;
    let left = 0;
    if (place.indexOf('bottom') === 0) top = rect.bottom + scrollY + 4;
    else if (place.indexOf('top') === 0) top = rect.top + scrollY - h - 4;
    else if (place.indexOf('left') === 0) { top = rect.top + scrollY; left = rect.left + scrollX - w - 4; }
    else if (place.indexOf('right') === 0) { top = rect.top + scrollY; left = rect.right + scrollX + 4; }
    if (!left) {
      if (place.indexOf('-start') !== -1) left = rect.left + scrollX;
      else if (place.indexOf('-end') !== -1) left = rect.right + scrollX - w;
      else left = rect.left + scrollX + (rect.width - w) / 2;
    }
    const pad = 8;
    if (left + w > vw - pad) left = vw - w - pad + scrollX;
    if (left < pad + scrollX) left = pad + scrollX;
    if (top + h > vh - pad + scrollY && place.indexOf('bottom') === 0) top = rect.top + scrollY - h - 4;
    if (top < pad + scrollY) top = pad + scrollY;
    el.style.position = el.classList.contains('mxt-menu-context') || el.style.position === 'fixed' ? 'fixed' : 'absolute';
    if (el.style.position === 'fixed') {
      el.style.top = (top - scrollY) + 'px';
      el.style.left = (left - scrollX) + 'px';
    } else {
      el.style.top = top + 'px';
      el.style.left = left + 'px';
    }
  }

  function initMenus(root) {
    root.querySelectorAll('.mxt-menu').forEach(function (menu) {
      if (menu.dataset.mxtBound === 'true') return;
      menu.dataset.mxtBound = 'true';
      const list = menu.querySelector('.mxt-menu-list');
      const highlight = menu.querySelector('.mxt-menu-highlight');
      if (!list) return;
      let current = null;
      function moveHighlight(item) {
        if (!highlight) return;
        if (!item) { highlight.style.opacity = '0'; return; }
        highlight.style.opacity = '1';
        highlight.style.top = (item.offsetTop) + 'px';
        highlight.style.height = item.offsetHeight + 'px';
        highlight.style.left = item.offsetLeft + 'px';
        highlight.style.right = 'auto';
        highlight.style.width = item.offsetWidth + 'px';
      }
      list.querySelectorAll('.mxt-menu-item').forEach(function (item) {
        item.addEventListener('mouseenter', function () { current = item; moveHighlight(item); });
        item.addEventListener('focus', function () { current = item; moveHighlight(item); });
        item.addEventListener('click', function (e) {
          if (item.classList.contains('mxt-menu-item-disabled')) {
            e.preventDefault();
            return;
          }
          emit(menu, 'mxt:menu-select', { item: item, label: item.textContent.trim() });
          const parentMenu = menu.closest('.mxt-menu-context, .mxt-menu-dropdown, .mxt-menu-sheet, .mxt-menu-side');
          if (parentMenu && parentMenu.dataset.mxtAutoClose !== 'false') {
            parentMenu.classList.add('mxt-hidden');
          }
        });
      });
      list.addEventListener('mouseleave', function () {
        if (highlight) highlight.style.opacity = '0';
      });
    });
  }

  function initDropdowns(root) {
    root.querySelectorAll('[data-mxt-dropdown]').forEach(function (trigger) {
      if (trigger.dataset.mxtBound === 'true') return;
      trigger.dataset.mxtBound = 'true';
      const targetSel = trigger.getAttribute('data-mxt-dropdown');
      const target = document.querySelector(targetSel);
      if (!target) return;
      const wrap = trigger.closest('.mxt-menu-dropdown-wrap') || trigger.parentElement;
      if (wrap && getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
      if (target.parentElement !== wrap) wrap.appendChild(target);
      target.classList.add('mxt-menu-dropdown');
      target.style.position = 'absolute';
      target.style.display = 'none';
      const placement = trigger.getAttribute('data-mxt-placement') || 'bottom-start';
      let open = false;
      function show() {
        target.style.display = '';
        target.style.opacity = '0';
        positionWithin(target, trigger, placement);
        requestAnimationFrame(function () { target.style.opacity = ''; });
        open = true;
        trigger.setAttribute('aria-expanded', 'true');
        emit(trigger, 'mxt:dropdown-open', { target: target });
      }
      function hide() {
        target.style.display = 'none';
        open = false;
        trigger.setAttribute('aria-expanded', 'false');
        emit(trigger, 'mxt:dropdown-close', { target: target });
      }
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (open) hide(); else show();
      });
      document.addEventListener('click', function (e) {
        if (!open) return;
        if (wrap.contains(e.target) || target.contains(e.target)) return;
        hide();
      });
      document.addEventListener('keydown', function (e) {
        if (open && e.key === 'Escape') { hide(); trigger.focus(); }
      });
      target.querySelectorAll('.mxt-menu-item').forEach(function (item) {
        item.addEventListener('click', function () {
          if (target.dataset.mxtAutoClose !== 'false') hide();
        });
      });
      register('dropdown', { trigger: trigger, target: target, show: show, hide: hide });
    });
  }

  function initContextMenus(root) {
    root.querySelectorAll('[data-mxt-context-menu]').forEach(function (trigger) {
      if (trigger.dataset.mxtBound === 'true') return;
      trigger.dataset.mxtBound = 'true';
      const targetSel = trigger.getAttribute('data-mxt-context-menu');
      const target = document.querySelector(targetSel);
      if (!target) return;
      target.classList.add('mxt-menu-context');
      target.style.display = 'none';
      function show(x, y) {
        target.style.display = '';
        target.style.opacity = '0';
        target.style.position = 'fixed';
        target.style.top = y + 'px';
        target.style.left = x + 'px';
        target.style.zIndex = '10000';
        requestAnimationFrame(function () {
          const rect = target.getBoundingClientRect();
          if (rect.right > window.innerWidth - 8) {
            target.style.left = (window.innerWidth - rect.width - 8) + 'px';
          }
          if (rect.bottom > window.innerHeight - 8) {
            target.style.top = (window.innerHeight - rect.height - 8) + 'px';
          }
          target.style.opacity = '';
        });
        emit(trigger, 'mxt:context-open', { target: target, x: x, y: y });
      }
      function hide() {
        target.style.display = 'none';
        emit(trigger, 'mxt:context-close', { target: target });
      }
      trigger.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        show(e.clientX, e.clientY);
      });
      document.addEventListener('click', function (e) {
        if (target.style.display === 'none') return;
        if (target.contains(e.target)) return;
        hide();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') hide();
      });
      target.querySelectorAll('.mxt-menu-item').forEach(function (item) {
        item.addEventListener('click', function () {
          if (target.dataset.mxtAutoClose !== 'false') hide();
        });
      });
      register('contextMenu', { trigger: trigger, target: target, show: show, hide: hide });
    });
  }

  function initSheets(root) {
    root.querySelectorAll('[data-mxt-sheet]').forEach(function (trigger) {
      if (trigger.dataset.mxtBound === 'true') return;
      trigger.dataset.mxtBound = 'true';
      const targetSel = trigger.getAttribute('data-mxt-sheet');
      const sheet = document.querySelector(targetSel);
      if (!sheet) return;
      let backdrop = document.querySelector('[data-mxt-sheet-backdrop="' + targetSel + '"]');
      if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.className = 'mxt-menu-sheet-backdrop';
        backdrop.dataset.mxtSheetBackdrop = targetSel;
        document.body.appendChild(backdrop);
      }
      sheet.classList.add('mxt-menu-sheet');
      let open = false;
      function show() {
        sheet.classList.add('mxt-menu-sheet-open');
        backdrop.classList.add('mxt-menu-sheet-open');
        open = true;
        lockScroll();
        const handle = sheet.querySelector('.mxt-menu-sheet-handle');
        if (handle && !handle.dataset.mxtBound) {
          handle.dataset.mxtBound = 'true';
          let startY = 0;
          let currentY = 0;
          let dragging = false;
          handle.addEventListener('pointerdown', function (e) {
            dragging = true;
            startY = e.clientY;
            currentY = startY;
            sheet.style.transition = 'none';
            handle.setPointerCapture(e.pointerId);
          });
          handle.addEventListener('pointermove', function (e) {
            if (!dragging) return;
            currentY = e.clientY;
            const delta = Math.max(0, currentY - startY);
            sheet.style.transform = 'translateY(' + delta + 'px)';
          });
          function end() {
            if (!dragging) return;
            dragging = false;
            sheet.style.transition = '';
            sheet.style.transform = '';
            const delta = Math.max(0, currentY - startY);
            if (delta > 80) hide();
          }
          handle.addEventListener('pointerup', end);
          handle.addEventListener('pointercancel', end);
          handle.addEventListener('click', function () {
            if (!dragging) hide();
          });
        }
        emit(sheet, 'mxt:sheet-open');
      }
      function hide() {
        sheet.classList.remove('mxt-menu-sheet-open');
        backdrop.classList.remove('mxt-menu-sheet-open');
        open = false;
        unlockScroll();
        emit(sheet, 'mxt:sheet-close');
      }
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        if (open) hide(); else show();
      });
      backdrop.addEventListener('click', hide);
      sheet.querySelectorAll('.mxt-menu-item').forEach(function (item) {
        item.addEventListener('click', function () {
          if (sheet.dataset.mxtAutoClose !== 'false') hide();
        });
      });
      document.addEventListener('keydown', function (e) {
        if (open && e.key === 'Escape') hide();
      });
      register('sheet', { trigger: trigger, sheet: sheet, show: show, hide: hide });
    });
  }

  function initSideMenus(root) {
    root.querySelectorAll('[data-mxt-side-menu]').forEach(function (trigger) {
      if (trigger.dataset.mxtBound === 'true') return;
      trigger.dataset.mxtBound = 'true';
      const targetSel = trigger.getAttribute('data-mxt-side-menu');
      const side = document.querySelector(targetSel);
      if (!side) return;
      const sideAttr = trigger.getAttribute('data-mxt-side') || 'left';
      side.classList.add('mxt-menu-side');
      side.classList.add(sideAttr === 'right' ? 'mxt-menu-side-right' : 'mxt-menu-side-left');
      let backdrop = document.querySelector('[data-mxt-side-backdrop="' + targetSel + '"]');
      if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.className = 'mxt-menu-side-backdrop';
        backdrop.dataset.mxtSideBackdrop = targetSel;
        document.body.appendChild(backdrop);
      }
      let open = false;
      function show() {
        side.classList.add('mxt-menu-side-open');
        backdrop.classList.add('mxt-menu-side-open');
        open = true;
        lockScroll();
        emit(side, 'mxt:side-menu-open');
      }
      function hide() {
        side.classList.remove('mxt-menu-side-open');
        backdrop.classList.remove('mxt-menu-side-open');
        open = false;
        unlockScroll();
        emit(side, 'mxt:side-menu-close');
      }
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        if (open) hide(); else show();
      });
      backdrop.addEventListener('click', hide);
      side.querySelectorAll('.mxt-menu-side-close, [data-mxt-close]').forEach(function (c) {
        c.addEventListener('click', hide);
      });
      side.querySelectorAll('.mxt-menu-item').forEach(function (item) {
        item.addEventListener('click', function () {
          if (side.dataset.mxtAutoClose !== 'false') hide();
        });
      });
      document.addEventListener('keydown', function (e) {
        if (open && e.key === 'Escape') hide();
      });
      register('sideMenu', { trigger: trigger, side: side, show: show, hide: hide });
    });
  }

  function initModals(root) {
    root.querySelectorAll('[data-mxt-modal]').forEach(function (trigger) {
      if (trigger.dataset.mxtBound === 'true') return;
      trigger.dataset.mxtBound = 'true';
      const targetSel = trigger.getAttribute('data-mxt-modal');
      const backdrop = document.querySelector(targetSel);
      if (!backdrop) return;
      backdrop.classList.add('mxt-modal-backdrop');
      const modal = backdrop.querySelector('.mxt-modal') || backdrop;
      let releaseTrap = null;
      let open = false;
      function show() {
        backdrop.classList.add('mxt-modal-open');
        open = true;
        lockScroll();
        releaseTrap = focusTrap(modal);
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        emit(backdrop, 'mxt:modal-open');
      }
      function hide() {
        backdrop.classList.remove('mxt-modal-open');
        open = false;
        unlockScroll();
        if (releaseTrap) { releaseTrap(); releaseTrap = null; }
        emit(backdrop, 'mxt:modal-close');
      }
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        show();
      });
      backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop && backdrop.dataset.mxtModalBackdrop !== 'false') hide();
      });
      backdrop.querySelectorAll('[data-mxt-close], .mxt-modal-close').forEach(function (c) {
        c.addEventListener('click', hide);
      });
      backdrop.querySelectorAll('[data-mxt-confirm]').forEach(function (c) {
        c.addEventListener('click', function () {
          emit(backdrop, 'mxt:modal-confirm');
          if (c.dataset.mxtConfirm !== 'stay') hide();
        });
      });
      document.addEventListener('keydown', function (e) {
        if (open && e.key === 'Escape') hide();
      });
      register('modal', { trigger: trigger, backdrop: backdrop, show: show, hide: hide });
    });
  }

  function toastRegion(position) {
    const pos = position || 'bottom-right';
    let region = document.querySelector('.mxt-toast-region[data-mxt-toast-position="' + pos + '"]');
    if (region) return region;
    region = document.createElement('div');
    region.className = 'mxt-toast-region';
    if (pos.indexOf('top') !== -1) region.classList.add('mxt-toast-region-top');
    if (pos.indexOf('left') !== -1) region.classList.add('mxt-toast-region-left');
    if (pos.indexOf('center') !== -1) region.classList.add('mxt-toast-region-center');
    region.dataset.mxtToastPosition = pos;
    document.body.appendChild(region);
    return region;
  }

  function createToast(options) {
    const opts = options || {};
    const region = toastRegion(opts.position || 'bottom-right');
    const toast = document.createElement('div');
    toast.className = 'mxt-toast' + (opts.pill ? ' mxt-toast-pill' : '') + (opts.flat ? ' mxt-toast-flat' : '');
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    if (opts.icon) {
      const icon = document.createElement('span');
      icon.className = 'mxt-toast-icon';
      icon.innerHTML = opts.icon;
      toast.appendChild(icon);
    }
    const content = document.createElement('div');
    content.className = 'mxt-toast-content';
    if (opts.title) {
      const t = document.createElement('div');
      t.className = 'mxt-toast-title';
      t.textContent = opts.title;
      content.appendChild(t);
    }
    if (opts.message) {
      const m = document.createElement('div');
      m.className = 'mxt-toast-message';
      m.textContent = opts.message;
      content.appendChild(m);
    }
    toast.appendChild(content);
    if (opts.actionLabel) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mxt-toast-action';
      btn.textContent = opts.actionLabel;
      btn.addEventListener('click', function () {
        if (typeof opts.onAction === 'function') opts.onAction(toast);
        close();
      });
      toast.appendChild(btn);
    }
    if (opts.closable !== false) {
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'mxt-toast-close';
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      closeBtn.addEventListener('click', close);
      toast.appendChild(closeBtn);
    }
    let timeout = null;
    let progress = null;
    function close() {
      toast.classList.remove('mxt-toast-open');
      clearTimeout(timeout);
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
        emit(document, 'mxt:toast-close', { toast: toast });
      }, 260);
    }
    region.appendChild(toast);
    requestAnimationFrame(function () { toast.classList.add('mxt-toast-open'); });
    if (opts.duration !== 0) {
      const duration = opts.duration || 4000;
      progress = document.createElement('div');
      progress.className = 'mxt-toast-progress';
      progress.style.animationDuration = duration + 'ms';
      toast.appendChild(progress);
      timeout = setTimeout(close, duration);
      toast.addEventListener('mouseenter', function () {
        clearTimeout(timeout);
        if (progress) progress.style.animationPlayState = 'paused';
      });
      toast.addEventListener('mouseleave', function () {
        if (progress) progress.style.animationPlayState = 'running';
        timeout = setTimeout(close, 1500);
      });
    }
    emit(document, 'mxt:toast-open', { toast: toast });
    return { element: toast, close: close };
  }

  function initToasts(root) {
    root.querySelectorAll('[data-mxt-toast]').forEach(function (trigger) {
      if (trigger.dataset.mxtBound === 'true') return;
      trigger.dataset.mxtBound = 'true';
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        const title = trigger.getAttribute('data-mxt-toast-title') || '';
        const message = trigger.getAttribute('data-mxt-toast-message') || trigger.getAttribute('data-mxt-toast') || '';
        const position = trigger.getAttribute('data-mxt-toast-position') || 'bottom-right';
        const duration = parseInt(trigger.getAttribute('data-mxt-toast-duration') || '4000', 10);
        createToast({ title: title, message: message, position: position, duration: duration });
      });
    });
  }

  function initTooltips(root) {
    root.querySelectorAll('[data-mxt-tooltip]').forEach(function (trigger) {
      if (trigger.dataset.mxtBound === 'true') return;
      trigger.dataset.mxtBound = 'true';
      const text = trigger.getAttribute('data-mxt-tooltip');
      const placement = trigger.getAttribute('data-mxt-tooltip-placement') || 'top';
      const rich = trigger.getAttribute('data-mxt-tooltip-rich');
      let tip = null;
      let timer = null;
      function build() {
        if (tip) return tip;
        tip = document.createElement('div');
        tip.className = 'mxt-tooltip mxt-tooltip-' + placement.split('-')[0];
        tip.setAttribute('role', 'tooltip');
        if (rich) {
          tip.classList.add('mxt-tooltip-rich');
          tip.innerHTML = rich;
        } else {
          tip.textContent = text;
        }
        const arrow = document.createElement('div');
        arrow.className = 'mxt-tooltip-arrow';
        tip.appendChild(arrow);
        document.body.appendChild(tip);
        return tip;
      }
      function show() {
        build();
        tip.classList.add('mxt-tooltip-visible');
        positionWithin(tip, trigger, placement);
      }
      function hide() {
        if (tip) tip.classList.remove('mxt-tooltip-visible');
        clearTimeout(timer);
      }
      trigger.addEventListener('mouseenter', function () {
        clearTimeout(timer);
        timer = setTimeout(show, 120);
      });
      trigger.addEventListener('mouseleave', hide);
      trigger.addEventListener('focus', show);
      trigger.addEventListener('blur', hide);
      trigger.addEventListener('touchstart', function () {
        clearTimeout(timer);
        timer = setTimeout(show, 200);
      }, { passive: true });
      document.addEventListener('touchstart', function (e) {
        if (tip && !trigger.contains(e.target) && !tip.contains(e.target)) hide();
      }, { passive: true });
      register('tooltip', { trigger: trigger, show: show, hide: hide });
    });
  }

  function initPopovers(root) {
    root.querySelectorAll('[data-mxt-popover]').forEach(function (trigger) {
      if (trigger.dataset.mxtBound === 'true') return;
      trigger.dataset.mxtBound = 'true';
      const targetSel = trigger.getAttribute('data-mxt-popover');
      const pop = document.querySelector(targetSel);
      if (!pop) return;
      pop.classList.add('mxt-popover');
      const placement = trigger.getAttribute('data-mxt-popover-placement') || 'bottom';
      pop.classList.add('mxt-popover-' + placement.split('-')[0]);
      if (!pop.querySelector('.mxt-popover-arrow')) {
        const arrow = document.createElement('div');
        arrow.className = 'mxt-popover-arrow';
        pop.appendChild(arrow);
      }
      let open = false;
      function show() {
        pop.classList.add('mxt-popover-open');
        open = true;
        positionWithin(pop, trigger, placement);
        emit(pop, 'mxt:popover-open');
      }
      function hide() {
        pop.classList.remove('mxt-popover-open');
        open = false;
        emit(pop, 'mxt:popover-close');
      }
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (open) hide(); else show();
      });
      document.addEventListener('click', function (e) {
        if (!open) return;
        if (trigger.contains(e.target) || pop.contains(e.target)) return;
        hide();
      });
      pop.querySelectorAll('[data-mxt-close]').forEach(function (c) {
        c.addEventListener('click', hide);
      });
      document.addEventListener('keydown', function (e) {
        if (open && e.key === 'Escape') hide();
      });
      register('popover', { trigger: trigger, popover: pop, show: show, hide: hide });
    });
  }

  function initSliders(root) {
    root.querySelectorAll('.mxt-slider, .mxt-slider-range').forEach(function (slider) {
      if (slider.dataset.mxtBound === 'true') return;
      slider.dataset.mxtBound = 'true';
      const min = parseFloat(slider.dataset.mxtMin || '0');
      const max = parseFloat(slider.dataset.mxtMax || '100');
      const step = parseFloat(slider.dataset.mxtStep || '1');
      const vertical = slider.classList.contains('mxt-slider-vertical');
      const isRange = slider.classList.contains('mxt-slider-range');
      const track = slider.querySelector('.mxt-slider-track') || slider;
      const fill = slider.querySelector('.mxt-slider-fill');
      const thumbs = Array.prototype.slice.call(slider.querySelectorAll('.mxt-slider-thumb, .mxt-slider-thumb-pill'));
      if (!thumbs.length) return;
      const values = thumbs.map(function (t, i) {
        return parseFloat(t.dataset.mxtValue || slider.dataset.mxtValue || (i === 0 ? String(min) : String(max)));
      });
      function clamp(v) { return Math.min(max, Math.max(min, v)); }
      function percent(v) { return ((clamp(v) - min) / (max - min)) * 100; }
      function updateVisual() {
        if (vertical) {
          const p = percent(values[0]);
          if (fill) fill.style.height = (100 - p) + '%';
          thumbs.forEach(function (t, i) {
            t.style.bottom = percent(values[i]) + '%';
            t.style.top = 'auto';
            t.style.left = '50%';
          });
        } else {
          if (isRange && thumbs.length > 1) {
            const a = percent(values[0]);
            const b = percent(values[1]);
            const lo = Math.min(a, b);
            const hi = Math.max(a, b);
            if (fill) {
              fill.style.left = lo + '%';
              fill.style.width = (hi - lo) + '%';
            }
            thumbs[0].style.left = a + '%';
            thumbs[1].style.left = b + '%';
          } else {
            if (fill) fill.style.width = percent(values[0]) + '%';
            thumbs[0].style.left = percent(values[0]) + '%';
          }
          thumbs.forEach(function (t) {
            t.style.top = '50%';
            t.style.bottom = 'auto';
          });
        }
        thumbs.forEach(function (t, i) {
          const tip = t.querySelector('.mxt-slider-tooltip');
          if (tip) tip.textContent = String(values[i]);
          t.setAttribute('aria-valuenow', String(values[i]));
        });
        emit(slider, 'mxt:slider-change', { values: values.slice() });
      }
      function valueFromEvent(e, thumbIndex) {
        const rect = track.getBoundingClientRect();
        let pct;
        if (vertical) {
          pct = 1 - ((e.clientY - rect.top) / rect.height);
        } else {
          pct = (e.clientX - rect.left) / rect.width;
        }
        pct = Math.max(0, Math.min(1, pct));
        let value = min + pct * (max - min);
        value = Math.round(value / step) * step;
        value = clamp(value);
        if (isRange && thumbs.length > 1) {
          const other = thumbIndex === 0 ? values[1] : values[0];
          if (thumbIndex === 0) value = Math.min(value, other);
          else value = Math.max(value, other);
        }
        return value;
      }
      thumbs.forEach(function (thumb, i) {
        let dragging = false;
        thumb.setAttribute('role', 'slider');
        thumb.setAttribute('tabindex', '0');
        thumb.setAttribute('aria-valuemin', String(min));
        thumb.setAttribute('aria-valuemax', String(max));
        thumb.addEventListener('pointerdown', function (e) {
          dragging = true;
          slider.classList.add('mxt-slider-dragging');
          thumb.setPointerCapture(e.pointerId);
          e.preventDefault();
        });
        thumb.addEventListener('pointermove', function (e) {
          if (!dragging) return;
          values[i] = valueFromEvent(e, i);
          updateVisual();
        });
        function end() {
          if (!dragging) return;
          dragging = false;
          slider.classList.remove('mxt-slider-dragging');
        }
        thumb.addEventListener('pointerup', end);
        thumb.addEventListener('pointercancel', end);
        thumb.addEventListener('keydown', function (e) {
          let delta = 0;
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = step;
          else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') delta = -step;
          else if (e.key === 'Home') { values[i] = min; updateVisual(); e.preventDefault(); return; }
          else if (e.key === 'End') { values[i] = max; updateVisual(); e.preventDefault(); return; }
          else if (e.key === 'PageUp') delta = step * 10;
          else if (e.key === 'PageDown') delta = -step * 10;
          if (delta) {
            e.preventDefault();
            values[i] = clamp(values[i] + delta);
            if (isRange && thumbs.length > 1) {
              if (i === 0) values[i] = Math.min(values[i], values[1]);
              else values[i] = Math.max(values[i], values[0]);
            }
            updateVisual();
          }
        });
      });
      track.addEventListener('pointerdown', function (e) {
        if (e.target.closest('.mxt-slider-thumb, .mxt-slider-thumb-pill')) return;
        let closestIdx = 0;
        if (isRange && thumbs.length > 1) {
          const rect = track.getBoundingClientRect();
          const pct = vertical ? 1 - ((e.clientY - rect.top) / rect.height) : (e.clientX - rect.left) / rect.width;
          const v = min + pct * (max - min);
          closestIdx = Math.abs(values[0] - v) < Math.abs(values[1] - v) ? 0 : 1;
        }
        values[closestIdx] = valueFromEvent(e, closestIdx);
        updateVisual();
        slider.classList.add('mxt-slider-dragging');
        function move(ev) {
          values[closestIdx] = valueFromEvent(ev, closestIdx);
          updateVisual();
        }
        function up() {
          slider.classList.remove('mxt-slider-dragging');
          document.removeEventListener('pointermove', move);
          document.removeEventListener('pointerup', up);
          document.removeEventListener('pointercancel', up);
        }
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
        document.addEventListener('pointercancel', up);
      });
      updateVisual();
      slider.mxtSlider = {
        getValues: function () { return values.slice(); },
        setValues: function (vals) {
          vals.forEach(function (v, i) { if (i < values.length) values[i] = clamp(parseFloat(v)); });
          updateVisual();
        }
      };
      register('slider', slider.mxtSlider);
    });
  }

  function initColourPickers(root) {
    root.querySelectorAll('.mxt-cp').forEach(function (cp) {
      if (cp.dataset.mxtBound === 'true') return;
      cp.dataset.mxtBound = 'true';
      const state = {
        h: 0, s: 100, v: 100, a: 1,
        mode: 'hex',
        hex: '#000000',
        r: 0, g: 0, b: 0
      };
      const saturation = cp.querySelector('.mxt-cp-saturation');
      const satThumb = cp.querySelector('.mxt-cp-saturation-thumb');
      const hueTrack = cp.querySelector('.mxt-cp-hue');
      const hueThumb = cp.querySelector('.mxt-cp-hue-thumb');
      const alphaTrack = cp.querySelector('.mxt-cp-alpha');
      const alphaThumb = cp.querySelector('.mxt-cp-alpha-thumb');
      const inputs = cp.querySelectorAll('.mxt-cp-input');
      const hexInput = cp.querySelector('.mxt-cp-hex-input');
      const tiles = cp.querySelectorAll('.mxt-cp-tile');
      const previewSwatch = cp.querySelector('.mxt-cp-preview-swatch');
      const previewValue = cp.querySelector('.mxt-cp-preview-value');
      const modeTabs = cp.querySelectorAll('.mxt-cp-mode-tab');
      const modeInputs = cp.querySelectorAll('[data-mxt-cp-inputs]');
      const applyBtn = cp.querySelector('[data-mxt-cp-apply]');
      const cancelBtn = cp.querySelector('[data-mxt-cp-cancel]');
      function hslToRgb(h, s, l) {
        h /= 360; s /= 100; l /= 100;
        let r, g, b;
        if (s === 0) { r = g = b = l; }
        else {
          const hue2rgb = function (p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
          };
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          const p = 2 * l - q;
          r = hue2rgb(p, q, h + 1 / 3);
          g = hue2rgb(p, q, h);
          b = hue2rgb(p, q, h - 1 / 3);
        }
        return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
      }
      function rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(function (v) {
          const h = Math.max(0, Math.min(255, Math.round(v))).toString(16);
          return h.length === 1 ? '0' + h : h;
        }).join('');
      }
      function hsvToRgb(h, s, v) {
        s /= 100; v /= 100;
        const i = Math.floor(h / 60) % 6;
        const f = h / 60 - Math.floor(h / 60);
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);
        let r, g, b;
        switch (i) {
          case 0: r = v; g = t; b = p; break;
          case 1: r = q; g = v; b = p; break;
          case 2: r = p; g = v; b = t; break;
          case 3: r = p; g = q; b = v; break;
          case 4: r = t; g = p; b = v; break;
          default: r = v; g = p; b = q;
        }
        return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
      }
      function rgbToHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;
        let h = 0;
        if (d !== 0) {
          if (max === r) h = ((g - b) / d) % 6;
          else if (max === g) h = (b - r) / d + 2;
          else h = (r - g) / d + 4;
          h *= 60;
          if (h < 0) h += 360;
        }
        const s = max === 0 ? 0 : d / max * 100;
        const v = max * 100;
        return { h: h, s: s, v: v };
      }
      function parseHex(hex) {
        if (!hex) return null;
        hex = hex.replace('#', '').trim();
        if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
        if (hex.length === 6) {
          return {
            r: parseInt(hex.substr(0, 2), 16),
            g: parseInt(hex.substr(2, 2), 16),
            b: parseInt(hex.substr(4, 2), 16)
          };
        }
        return null;
      }
      function updateFromHsv() {
        const rgb = hsvToRgb(state.h, state.s, state.v);
        state.r = rgb.r; state.g = rgb.g; state.b = rgb.b;
        state.hex = rgbToHex(state.r, state.g, state.b);
        render();
      }
      function setFromHex(hex, alpha) {
        const rgb = parseHex(hex);
        if (!rgb) return;
        const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
        state.h = hsv.h; state.s = hsv.s; state.v = hsv.v;
        state.r = rgb.r; state.g = rgb.g; state.b = rgb.b;
        state.hex = rgbToHex(rgb.r, rgb.g, rgb.b);
        if (typeof alpha === 'number') state.a = alpha;
        render();
      }
      function currentCss() {
        if (state.a >= 1) return state.hex;
        return 'rgba(' + state.r + ', ' + state.g + ', ' + state.b + ', ' + state.a.toFixed(2) + ')';
      }
      function render() {
        if (saturation) saturation.style.backgroundColor = 'hsl(' + state.h + ', 100%, 50%)';
        if (satThumb) {
          satThumb.style.left = state.s + '%';
          satThumb.style.top = (100 - state.v) + '%';
          satThumb.style.background = state.hex;
        }
        if (hueThumb) hueThumb.style.left = (state.h / 360 * 100) + '%';
        if (alphaThumb) alphaThumb.style.left = (state.a * 100) + '%';
        if (alphaTrack) alphaTrack.style.color = state.hex;
        if (previewSwatch) previewSwatch.style.background = currentCss();
        if (previewValue) previewValue.textContent = currentCss();
        if (hexInput) hexInput.value = state.hex.replace('#', '').toUpperCase();
        inputs.forEach(function (input) {
          const key = input.dataset.mxtCpInput;
          if (key === 'r') input.value = state.r;
          else if (key === 'g') input.value = state.g;
          else if (key === 'b') input.value = state.b;
          else if (key === 'a') input.value = Math.round(state.a * 100);
          else if (key === 'h') input.value = Math.round(state.h);
          else if (key === 's') input.value = Math.round(state.s);
          else if (key === 'v') input.value = Math.round(state.v);
        });
        tiles.forEach(function (tile) {
          tile.classList.toggle('mxt-cp-tile-selected', tile.dataset.mxtColor && tile.dataset.mxtColor.toLowerCase() === state.hex.toLowerCase());
        });
        emit(cp, 'mxt:color-change', { hex: state.hex, rgba: currentCss(), r: state.r, g: state.g, b: state.b, a: state.a });
      }
      function pickSaturation(e) {
        const rect = saturation.getBoundingClientRect();
        state.s = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        state.v = Math.max(0, Math.min(100, 100 - ((e.clientY - rect.top) / rect.height) * 100));
        updateFromHsv();
      }
      if (saturation) {
        saturation.addEventListener('pointerdown', function (e) {
          pickSaturation(e);
          saturation.setPointerCapture(e.pointerId);
          function move(ev) { pickSaturation(ev); }
          function up() {
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', up);
            document.removeEventListener('pointercancel', up);
          }
          document.addEventListener('pointermove', move);
          document.addEventListener('pointerup', up);
          document.addEventListener('pointercancel', up);
        });
      }
      if (hueTrack) {
        hueTrack.addEventListener('pointerdown', function (e) {
          const rect = hueTrack.getBoundingClientRect();
          state.h = Math.max(0, Math.min(360, ((e.clientX - rect.left) / rect.width) * 360));
          updateFromHsv();
          hueTrack.setPointerCapture(e.pointerId);
          function move(ev) {
            state.h = Math.max(0, Math.min(360, ((ev.clientX - rect.left) / rect.width) * 360));
            updateFromHsv();
          }
          function up() {
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', up);
            document.removeEventListener('pointercancel', up);
          }
          document.addEventListener('pointermove', move);
          document.addEventListener('pointerup', up);
          document.addEventListener('pointercancel', up);
        });
      }
      if (alphaTrack) {
        alphaTrack.addEventListener('pointerdown', function (e) {
          const rect = alphaTrack.getBoundingClientRect();
          state.a = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          render();
          alphaTrack.setPointerCapture(e.pointerId);
          function move(ev) {
            state.a = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
            render();
          }
          function up() {
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', up);
            document.removeEventListener('pointercancel', up);
          }
          document.addEventListener('pointermove', move);
          document.addEventListener('pointerup', up);
          document.addEventListener('pointercancel', up);
        });
      }
      inputs.forEach(function (input) {
        input.addEventListener('input', function () {
          const key = input.dataset.mxtCpInput;
          const v = parseFloat(input.value);
          if (isNaN(v)) return;
          if (key === 'r') { state.r = Math.max(0, Math.min(255, v)); }
          else if (key === 'g') { state.g = Math.max(0, Math.min(255, v)); }
          else if (key === 'b') { state.b = Math.max(0, Math.min(255, v)); }
          else if (key === 'a') { state.a = Math.max(0, Math.min(1, v / 100)); render(); return; }
          else if (key === 'h') { state.h = Math.max(0, Math.min(360, v)); updateFromHsv(); return; }
          else if (key === 's') { state.s = Math.max(0, Math.min(100, v)); updateFromHsv(); return; }
          else if (key === 'v') { state.v = Math.max(0, Math.min(100, v)); updateFromHsv(); return; }
          const hsv = rgbToHsv(state.r, state.g, state.b);
          state.h = hsv.h; state.s = hsv.s; state.v = hsv.v;
          state.hex = rgbToHex(state.r, state.g, state.b);
          render();
        });
      });
      if (hexInput) {
        hexInput.addEventListener('change', function () {
          const v = hexInput.value.replace('#', '').trim();
          if (/^[0-9a-fA-F]{3}$/.test(v) || /^[0-9a-fA-F]{6}$/.test(v)) setFromHex(v);
        });
      }
      tiles.forEach(function (tile) {
        tile.addEventListener('click', function () {
          const color = tile.dataset.mxtColor;
          if (color) {
            setFromHex(color, state.a);
          } else if (tile.classList.contains('mxt-cp-tile-none')) {
            state.a = 0;
            render();
          }
        });
      });
      modeTabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
          const mode = tab.dataset.mxtCpMode;
          state.mode = mode;
          modeTabs.forEach(function (t) { t.classList.toggle('mxt-cp-mode-active', t === tab); });
          modeInputs.forEach(function (group) {
            group.style.display = group.dataset.mxtCpInputs === mode ? '' : 'none';
          });
        });
      });
      if (applyBtn) applyBtn.addEventListener('click', function () { emit(cp, 'mxt:color-apply', { hex: state.hex, rgba: currentCss() }); });
      if (cancelBtn) cancelBtn.addEventListener('click', function () { emit(cp, 'mxt:color-cancel'); });
      const initial = cp.dataset.mxtValue || cp.dataset.mxtColor || '#000000';
      setFromHex(initial);
      cp.mxtColourPicker = {
        getColor: function () { return { hex: state.hex, rgba: currentCss(), r: state.r, g: state.g, b: state.b, a: state.a }; },
        setColor: setFromHex
      };
      register('colourPicker', cp.mxtColourPicker);
    });
  }

  function initFileInputs(root) {
    root.querySelectorAll('.mxt-file').forEach(function (file) {
      if (file.dataset.mxtBound === 'true') return;
      file.dataset.mxtBound = 'true';
      const input = file.querySelector('input[type="file"]');
      const drop = file.querySelector('.mxt-file-drop');
      const list = file.querySelector('.mxt-file-list');
      if (!input || !drop) return;
      function syncList() {
        if (!list) return;
        list.innerHTML = '';
        Array.prototype.slice.call(input.files || []).forEach(function (f, i) {
          const item = document.createElement('div');
          item.className = 'mxt-file-item';
          item.innerHTML = '<span class="mxt-file-item-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span><span class="mxt-file-item-info"><span class="mxt-file-item-name">' + f.name + '</span><span class="mxt-file-item-size">' + (f.size / 1024).toFixed(1) + ' KB</span></span><button type="button" class="mxt-file-item-remove" data-mxt-file-remove="' + i + '"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
          list.appendChild(item);
        });
        list.querySelectorAll('[data-mxt-file-remove]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            emit(file, 'mxt:file-remove', { index: parseInt(btn.dataset.mxtFileRemove, 10) });
          });
        });
      }
      drop.addEventListener('click', function () { input.click(); });
      input.addEventListener('change', function () { syncList(); emit(file, 'mxt:file-change', { files: input.files }); });
      ['dragenter', 'dragover'].forEach(function (evt) {
        drop.addEventListener(evt, function (e) {
          e.preventDefault();
          drop.classList.add('mxt-file-drop-active');
        });
      });
      ['dragleave', 'drop'].forEach(function (evt) {
        drop.addEventListener(evt, function (e) {
          e.preventDefault();
          drop.classList.remove('mxt-file-drop-active');
        });
      });
      drop.addEventListener('drop', function (e) {
        if (e.dataTransfer && e.dataTransfer.files) {
          input.files = e.dataTransfer.files;
          syncList();
          emit(file, 'mxt:file-change', { files: input.files });
        }
      });
      register('fileInput', file);
    });
  }

  function initChipInputs(root) {
    root.querySelectorAll('.mxt-chip-input-wrap').forEach(function (wrap) {
      if (wrap.dataset.mxtBound === 'true') return;
      wrap.dataset.mxtBound = 'true';
      const input = wrap.querySelector('.mxt-chip-input');
      if (!input) return;
      const initialChips = Array.prototype.slice.call(wrap.querySelectorAll('.mxt-chip')).map(function (c) {
        return { label: c.textContent.trim(), value: c.dataset.mxtValue || c.textContent.trim() };
      });
      const chips = initialChips.slice();
      function render() {
        wrap.querySelectorAll('.mxt-chip').forEach(function (c) { c.remove(); });
        chips.forEach(function (chip, i) {
          const el = document.createElement('span');
          el.className = 'mxt-chip mxt-chip-pill mxt-chip-outlined';
          el.dataset.mxtValue = chip.value;
          el.innerHTML = '<span class="mxt-chip-label"></span><button type="button" class="mxt-chip-remove" aria-label="Remove"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
          el.querySelector('.mxt-chip-label').textContent = chip.label;
          el.querySelector('.mxt-chip-remove').addEventListener('click', function () {
            chips.splice(i, 1);
            render();
            emit(wrap, 'mxt:chip-remove', { value: chip.value });
          });
          wrap.insertBefore(el, input);
        });
      }
      function addChip(label) {
        const v = (label || '').trim();
        if (!v) return;
        if (chips.some(function (c) { return c.value === v; })) return;
        chips.push({ label: v, value: v });
        render();
        emit(wrap, 'mxt:chip-add', { value: v });
      }
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          addChip(input.value);
          input.value = '';
        } else if (e.key === 'Backspace' && !input.value && chips.length) {
          const removed = chips.pop();
          render();
          emit(wrap, 'mxt:chip-remove', { value: removed.value });
        }
      });
      input.addEventListener('blur', function () {
        if (input.value) {
          addChip(input.value);
          input.value = '';
        }
      });
      render();
      wrap.mxtChipInput = {
        add: addChip,
        remove: function (value) {
          const idx = chips.findIndex(function (c) { return c.value === value; });
          if (idx !== -1) { chips.splice(idx, 1); render(); }
        },
        getValues: function () { return chips.map(function (c) { return c.value; }); }
      };
      register('chipInput', wrap.mxtChipInput);
    });
  }

  function initSteppers(root) {
    root.querySelectorAll('.mxt-stepper').forEach(function (stepper) {
      if (stepper.dataset.mxtBound === 'true') return;
      stepper.dataset.mxtBound = 'true';
      stepper.mxtStepper = {
        goTo: function (index) {
          const steps = stepper.querySelectorAll('.mxt-step');
          steps.forEach(function (s, i) {
            s.classList.toggle('mxt-step-active', i === index);
            s.classList.toggle('mxt-step-completed', i < index);
            s.classList.remove('mxt-step-error');
          });
          emit(stepper, 'mxt:step-change', { index: index });
        },
        next: function () {
          const steps = Array.prototype.slice.call(stepper.querySelectorAll('.mxt-step'));
          const current = steps.findIndex(function (s) { return s.classList.contains('mxt-step-active'); });
          if (current < steps.length - 1) stepper.mxtStepper.goTo(current + 1);
        },
        prev: function () {
          const steps = Array.prototype.slice.call(stepper.querySelectorAll('.mxt-step'));
          const current = steps.findIndex(function (s) { return s.classList.contains('mxt-step-active'); });
          if (current > 0) stepper.mxtStepper.goTo(current - 1);
        }
      };
      register('stepper', stepper.mxtStepper);
    });
  }

  function initNavbars(root) {
    root.querySelectorAll('.mxt-navbar').forEach(function (nav) {
      if (nav.dataset.mxtBound === 'true') return;
      nav.dataset.mxtBound = 'true';
      const toggler = nav.querySelector('.mxt-navbar-toggler');
      const drawer = nav.querySelector('.mxt-navbar-drawer');
      if (toggler && drawer) {
        toggler.addEventListener('click', function (e) {
          e.preventDefault();
          const open = drawer.classList.toggle('mxt-navbar-drawer-open');
          toggler.classList.toggle('mxt-navbar-toggler-active', open);
          toggler.setAttribute('aria-expanded', String(open));
        });
      }
      if (nav.classList.contains('mxt-navbar-shadow-scroll') || nav.classList.contains('mxt-navbar-transparent-scroll')) {
        const onScroll = throttle(function () {
          const scrolled = (window.scrollY || window.pageYOffset || 0) > 8;
          nav.classList.toggle('mxt-navbar-scrolled', scrolled);
        }, 80);
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
      }
    });
  }

  function initScrollSpy(root) {
    const navs = root.querySelectorAll('[data-mxt-scrollspy]');
    if (!navs.length) return;
    navs.forEach(function (nav) {
      if (nav.dataset.mxtBound === 'true') return;
      nav.dataset.mxtBound = 'true';
      const links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
      if (!links.length) return;
      const targets = links.map(function (link) {
        return document.querySelector(link.getAttribute('href'));
      }).filter(Boolean);
      const onScroll = throttle(function () {
        const fromTop = window.scrollY + 100;
        let activeIdx = 0;
        targets.forEach(function (t, i) {
          if (t.offsetTop <= fromTop) activeIdx = i;
        });
        links.forEach(function (l, i) { l.classList.toggle('mxt-anchor-link-active', i === activeIdx); });
      }, 100);
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    });
  }

  function initCopy(root) {
    root.querySelectorAll('[data-mxt-copy]').forEach(function (btn) {
      if (btn.dataset.mxtBound === 'true') return;
      btn.dataset.mxtBound = 'true';
      btn.addEventListener('click', function () {
        const sel = btn.getAttribute('data-mxt-copy');
        let text = btn.getAttribute('data-mxt-copy-text') || '';
        if (sel) {
          const target = document.querySelector(sel);
          if (target) text = target.textContent;
        }
        if (!text) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            btn.classList.add('mxt-code-copied');
            const original = btn.textContent;
            btn.textContent = btn.dataset.mxtCopyLabel || 'Copied';
            setTimeout(function () {
              btn.classList.remove('mxt-code-copied');
              btn.textContent = original;
            }, 1500);
          });
        }
        emit(btn, 'mxt:copy', { text: text });
      });
    });
  }

  function initThemeSwitchers(root) {
    root.querySelectorAll('[data-mxt-theme-switch]').forEach(function (el) {
      if (el.dataset.mxtBound === 'true') return;
      el.dataset.mxtBound = 'true';
      el.addEventListener('click', function (e) {
        e.preventDefault();
        const theme = el.getAttribute('data-mxt-theme-switch');
        if (theme && THEMES[theme]) setTheme(theme);
      });
    });
    root.querySelectorAll('[data-mxt-theme-toggle]').forEach(function (el) {
      if (el.dataset.mxtBound === 'true') return;
      el.dataset.mxtBound = 'true';
      el.addEventListener('click', function (e) {
        e.preventDefault();
        toggleTheme();
      });
    });
  }

  function observeMutations() {
    if (typeof MutationObserver !== 'function') return;
    const observer = new MutationObserver(function (mutations) {
      let needsInit = false;
      mutations.forEach(function (m) {
        if (m.type === 'childList' && m.addedNodes.length) {
          m.addedNodes.forEach(function (n) {
            if (n.nodeType === 1) needsInit = true;
          });
        }
      });
      if (needsInit) autoInit(document);
    });
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }

  MXT.toast = createToast;
  MXT.dismissAll = dismissAll;
  MXT.autoInit = autoInit;
  MXT.register = register;
  MXT.version = '1.0.0';

  MXT.openModal = function (selector) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.classList.add('mxt-modal-open');
    lockScroll();
  };
  MXT.closeModal = function (selector) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.classList.remove('mxt-modal-open');
    unlockScroll();
  };
  MXT.openSheet = function (selector) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.classList.add('mxt-menu-sheet-open');
    const bd = document.querySelector('[data-mxt-sheet-backdrop="' + selector + '"]');
    if (bd) bd.classList.add('mxt-menu-sheet-open');
    lockScroll();
  };
  MXT.closeSheet = function (selector) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.classList.remove('mxt-menu-sheet-open');
    const bd = document.querySelector('[data-mxt-sheet-backdrop="' + selector + '"]');
    if (bd) bd.classList.remove('mxt-menu-sheet-open');
    unlockScroll();
  };
  MXT.openSideMenu = function (selector) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.classList.add('mxt-menu-side-open');
    const bd = document.querySelector('[data-mxt-side-backdrop="' + selector + '"]');
    if (bd) bd.classList.add('mxt-menu-side-open');
    lockScroll();
  };
  MXT.closeSideMenu = function (selector) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.classList.remove('mxt-menu-side-open');
    const bd = document.querySelector('[data-mxt-side-backdrop="' + selector + '"]');
    if (bd) bd.classList.remove('mxt-menu-side-open');
    unlockScroll();
  };

  global.Mixterial = MXT;
  global.MXT = MXT;

  initTheme();

  ready(function () {
    bindDismiss(document);
    bindToggle(document);
    autoInit(document);
    observeMutations();
    document.body.classList.add('mxt-ready');
    emit(document, 'mxt:ready', { theme: currentTheme });
  });

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', function (e) {
      if (e.key !== THEME_STORAGE_KEY || !e.newValue) return;
      if (THEMES[e.newValue] && e.newValue !== currentTheme) {
        setTheme(e.newValue);
      }
    });
  }

  if (document.readyState === 'complete') {
    document.body.classList.add('mxt-loaded');
  } else {
    window.addEventListener('load', function () {
      document.body.classList.add('mxt-loaded');
    }, { once: true });
  }
})(typeof window !== 'undefined' ? window : this);
