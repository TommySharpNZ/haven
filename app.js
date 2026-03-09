/* ============================================================
   HAven - app.js
   Pure vanilla JS, ES5-compatible for maximum browser support.
   No frameworks, no build tools, no dependencies.
   ============================================================ */

(function () {
  'use strict';

  // ---- State ------------------------------------------------
  var config = null;
  var currentPage = 1;
  var ws = null;
  var wsReconnectTimer = null;
  var wsSubscriptionId = null;
  var wsCommandSubId   = null;
  var havenDeviceId    = null;   // ?device= URL param, used to filter haven_command events
  var msgId = 1;
  var entityCallbacks = {};        // entityId -> [callback, ...] for current page
  var page0Callbacks  = {};        // entityId -> [callback, ...] persistent (page 0 widgets)
  var pendingStreamRequests = {};  // msgId -> callback for camera/stream responses
  var pendingAgendaRequests = {};  // msgId -> callback for calendar/get_events responses
  var activePageTimers      = [];  // setInterval IDs to clear on page change
  var entityStates = {};      // entityId -> stateObject (cached)
  var INTERNAL_CONN_ENTITY = 'internal.connectionstatus';
  var INTERNAL_TIME_ENTITY = 'internal.currentdtm';
  var INTERNAL_PAGE_ENTITY = 'internal.currentpage';
  var returnTimer = null;
  var clockTimer = null;
  var internalTimeTimer = null;
  var screensaverTimer    = null;
  var screensaverActive   = false;
  var screensaverRaf      = null;
  var screensaverEl       = null;
  var screensaverListenersAdded = false;
  var pageNavTheme = null;
  var animationPauseBound = false;
  var haUrl = '';
  var haToken = '';
  var configCacheBuster = null;

  // ---- Init -------------------------------------------------
  function init() {
    if (window.HAVEN_OVERRIDE_CONFIG) {
      console.log('HAven preview: override config detected');
      console.log('HAven preview: override page =', window.HAVEN_OVERRIDE_PAGE);
      config = window.HAVEN_OVERRIDE_CONFIG;
      applyConfig(config, true);
      return;
    }
    haUrl   = localStorage.getItem('haven_url')   || '';
    haToken = localStorage.getItem('haven_token') || '';

    // If no URL in localStorage, default to the current origin.
    // HAven is normally hosted inside HA's www/ folder, so window.location.origin
    // is the HA URL. An explicit ha_url in the device config or localStorage
    // overrides this for non-standard deployments.
    if (!haUrl) haUrl = window.location.origin;

    console.log('HAven init: url=' + haUrl + ' tokenLength=' + haToken.length);

    if (!haToken) {
      // No token in localStorage - check device config before showing setup
      console.log('HAven init: no token in localStorage, checking device config');
      loadConfigForCredentials();
      return;
    }

    console.log('HAven init: credentials found, loading config');
    loadConfig();
  }

  // Load config to extract optional credential overrides.
  // Falls back to setup screen only if no token can be found anywhere.
  function loadConfigForCredentials() {
    var deviceParam = getUrlParam('device') || 'default';
    var base        = window.location.pathname.replace(/\/[^\/]*$/, '/');
    var configUrl   = base + 'devices/' + deviceParam + '.json?v=' + getConfigCacheBuster();

    fetchJson(configUrl, function(err, data) {
      if (err) {
        console.log('HAven init: config fetch error: ' + err);
        showSetup();
        return;
      }
      if (!data) {
        console.log('HAven init: config fetch returned no data');
        showSetup();
        return;
      }

      var credUrl   = (data.device && data.device.ha_url)   || '';
      var credToken = (data.device && data.device.ha_token) || '';

      console.log('HAven init: config loaded, credUrl=' + credUrl + ' credTokenLength=' + credToken.length);

      if (credToken) {
        // URL override is optional - fall back to origin if not set
        if (credUrl) haUrl = credUrl;
        haToken = credToken;
        localStorage.setItem('haven_url',   haUrl);
        localStorage.setItem('haven_token', haToken);
        console.log('HAven init: credentials from device config, url=' + haUrl);
        loadConfig();
      } else {
        console.log('HAven init: no token in config, showing setup');
        showSetup();
      }
    });
  }

  // ---- Setup overlay ----------------------------------------
  function showSetup() {
    var overlay = document.getElementById('setup-overlay');
    overlay.classList.remove('hidden');

    var urlInput   = document.getElementById('setup-url');
    var tokenInput = document.getElementById('setup-token');
    var saveBtn    = document.getElementById('setup-save');
    var errorEl    = document.getElementById('setup-error');

    // Pre-fill URL from localStorage or current origin as a sensible default
    urlInput.value   = haUrl || window.location.origin;
    tokenInput.value = haToken;

    saveBtn.addEventListener('click', function () {
      var url   = urlInput.value.trim().replace(/\/$/, '');
      var token = tokenInput.value.trim();
      errorEl.textContent = '';

      if (!url)   { errorEl.textContent = 'Please enter your Home Assistant URL.'; return; }
      if (!token) { errorEl.textContent = 'Please enter your access token.'; return; }

      localStorage.setItem('haven_url',   url);
      localStorage.setItem('haven_token', token);

      // Hard reload for cleanest possible startup with new credentials
      window.location.reload();
    });
  }

  // ---- Config loading ---------------------------------------
  function loadConfig() {
    var deviceParam = getUrlParam('device');
    var base        = window.location.pathname.replace(/\/[^\/]*$/, '/');

    if (deviceParam) {
      // Device explicitly specified in URL - load it directly
      loadConfigFromUrl(base + 'devices/' + deviceParam + '.json?v=' + getConfigCacheBuster(), deviceParam);
    } else {
      // No device specified - try default.json, fall back to landing page
      console.log('HAven: no device specified, trying default.json');
      fetchJson(base + 'devices/default.json?v=' + getConfigCacheBuster(), function(err, data) {
        if (!err && data) {
          console.log('HAven: default.json found, loading');
          applyConfig(data);
        } else {
          console.log('HAven: no default.json found, showing landing page');
          showLandingPage(base);
        }
      });
    }
  }

  function loadConfigFromUrl(configUrl, deviceParam) {
    havenDeviceId = deviceParam || null;
    console.log('HAven loadConfig: fetching ' + configUrl);
    fetchJson(configUrl, function (err, data) {
      if (err) {
        showFatalError('Could not load device config: devices/' + deviceParam + '.json\n' + err);
        return;
      }
      applyConfig(data);
    });
  }

  function applyConfig(data, isPreview) {
    console.log('HAven loadConfig: success, hiding setup overlay');
    var overlay = document.getElementById('setup-overlay');
    if (overlay) overlay.classList.add('hidden');
    config = data;
    setupCanvas();
    setupPageNav();
    var connEl = document.getElementById('conn-status');
    if (connEl && config.device.show_connection_indicator === false) connEl.style.display = 'none';
    setupAnimationPauseHook();
    renderPage0();   // persistent overlay - renders once, never cleared
    var startPage = config.device.default_page || 1;
    var pageParam = parseInt(getUrlParam('page'), 10);
    if (window.HAVEN_OVERRIDE_PAGE !== undefined && window.HAVEN_OVERRIDE_PAGE !== null) {
      console.log('HAven preview: using override page', window.HAVEN_OVERRIDE_PAGE);
      pageParam = parseInt(window.HAVEN_OVERRIDE_PAGE, 10);
    }
    if (pageParam) {
      for (var pi = 0; pi < config.pages.length; pi++) {
        if (config.pages[pi].id === pageParam) { startPage = pageParam; break; }
      }
    }
    renderPage(startPage);
    if (!isPreview) connectWebSocket();
    startClock();
    startInternalTime();
    if (!isPreview) initScreensaver();
    if (isPreview) setConnStatus('disconnected');
  }

  function setupAnimationPauseHook() {
    if (animationPauseBound) return;
    animationPauseBound = true;

    function syncAnimationPause() {
      var root = document.body || document.documentElement;
      if (!root) return;
      if (document.hidden) root.classList.add('haven-anim-paused');
      else root.classList.remove('haven-anim-paused');
    }

    function onPageVisible() {
      if (document.hidden) return;
      // Device just woke up - dismiss screensaver and reconnect WS if needed
      resetScreensaverTimer();
      if (!ws || ws.readyState !== 1) {
        if (wsReconnectTimer) { clearTimeout(wsReconnectTimer); wsReconnectTimer = null; }
        connectWebSocket();
      }
    }

    document.addEventListener('visibilitychange', syncAnimationPause);
    document.addEventListener('visibilitychange', onPageVisible);
    syncAnimationPause();
  }

  function showLandingPage(base) {
    // Hide setup overlay if showing
    var overlay = document.getElementById('setup-overlay');
    if (overlay) overlay.classList.add('hidden');

    // Hide canvas wrapper
    var wrapper = document.getElementById('canvas-wrapper');
    if (wrapper) wrapper.style.display = 'none';

    // Build landing page
    var landing = document.createElement('div');
    landing.id = 'landing';
    landing.innerHTML = [
      '<div class="landing-inner">',
      '  <div class="landing-logo">HAven</div>',
      '  <div class="landing-tagline">Browser-based Home Assistant Dashboard</div>',
      '  <div class="landing-divider"></div>',
      '  <div class="landing-section">',
      '    <div class="landing-label">No device specified</div>',
      '    <div class="landing-hint">Access your dashboard using a <code>?device=</code> URL parameter:</div>',
      '    <div class="landing-example">index.html?device=<em>your-device-name</em></div>',
      '  </div>',
      '  <div class="landing-section">',
      '    <div class="landing-label">Device configs live here</div>',
      '    <div class="landing-hint"><code>config/www/haven/devices/your-device-name.json</code></div>',
      '  </div>',
      '  <div class="landing-section">',
      '    <div class="landing-label">Shortcut</div>',
      '    <div class="landing-hint">Create a <code>devices/default.json</code> to load automatically when no device is specified.</div>',
      '  </div>',
      '</div>'
    ].join('\n');

    document.body.appendChild(landing);
  }

  function fetchJson(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status === 200) {
        try {
          callback(null, JSON.parse(xhr.responseText));
        } catch (e) {
          callback('JSON parse error: ' + e.message);
        }
      } else {
        callback('HTTP ' + xhr.status);
      }
    };
    xhr.send();
  }

  // Always bust config file cache on page refresh to reflect JSON edits immediately
  function getConfigCacheBuster() {
    if (!configCacheBuster) {
      configCacheBuster = Date.now();
    }
    return configCacheBuster;
  }

  // ---- Canvas scaling ---------------------------------------
  function setupCanvas() {
    var canvas = document.getElementById('canvas');
    var cw = config.device.canvas.width;
    var ch = config.device.canvas.height;

    canvas.style.width  = cw + 'px';
    canvas.style.height = ch + 'px';
    canvas.style.background = resolveColor(config.theme.colors.background);

    scaleCanvas();
    window.addEventListener('resize', scaleCanvas);
    window.addEventListener('orientationchange', function () {
      setTimeout(scaleCanvas, 200);
    });
  }

  function scaleCanvas() {
    var canvas = document.getElementById('canvas');
    var cw     = config.device.canvas.width;
    var ch     = config.device.canvas.height;

    var availW = window.innerWidth;
    var availH = window.innerHeight;

    // Scale to fit while preserving aspect ratio
    var scale  = Math.min(availW / cw, availH / ch);

    // Calculate centering offsets
    var scaledW = Math.floor(cw * scale);
    var scaledH = Math.floor(ch * scale);
    var left    = Math.floor((availW - scaledW) / 2);
    var top     = Math.floor((availH - scaledH) / 2);

    canvas.style.position              = 'absolute';
    canvas.style.left                  = left + 'px';
    canvas.style.top                   = top  + 'px';
    canvas.style.webkitTransformOrigin = '0 0';
    canvas.style.transformOrigin       = '0 0';
    canvas.style.webkitTransform       = 'scale(' + scale + ')';
    canvas.style.transform             = 'scale(' + scale + ')';

  }

  // ---- Page rendering ---------------------------------------
  // ---- Page 0 (persistent overlay) ------------------------
  // Page 0 widgets render once into a fixed overlay div that sits above
  // the canvas and is never cleared on page navigation. Used for persistent
  // elements like a clock, status bar, or navigation sidebar.
  function renderPage0() {
    var page0Config = null;
    for (var i = 0; i < config.pages.length; i++) {
      if (config.pages[i].id === 0) { page0Config = config.pages[i]; break; }
    }
    if (!page0Config) return;  // no page 0 defined - nothing to do

    // Create persistent overlay div inside the canvas
    var wrapper = document.getElementById('canvas');
    var overlay = document.createElement('div');
    overlay.id = 'page0-overlay';
    overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;';
    wrapper.appendChild(overlay);

    // Temporarily swap entityCallbacks for page0Callbacks so widget
    // registration goes into the persistent map
    var savedCallbacks = entityCallbacks;
    entityCallbacks = page0Callbacks;

    for (var w = 0; w < page0Config.widgets.length; w++) {
      var widget = page0Config.widgets[w];
      // Page 0 widgets that need to be interactive (buttons, etc.)
      // must opt-in via pointer-events so the overlay doesn't block canvas taps
      renderWidget(widget, overlay);
    }

    // Restore normal callbacks
    entityCallbacks = savedCallbacks;

    // Re-enable pointer events on interactive page 0 widgets
    var els = overlay.querySelectorAll('.widget-button, .widget-image, .widget-switch');
    for (var e = 0; e < els.length; e++) {
      els[e].style.pointerEvents = 'auto';
    }

    // Pre-fetch entity states for page 0 entities
    subscribeToPageEntities(page0Config);

  }

  function renderPage(pageId) {
    currentPage = pageId;

    // Clear entity callbacks from previous page
    entityCallbacks = {};

    var canvas  = document.getElementById('canvas');
    // Preserve page 0 overlay while clearing page content
    var page0 = document.getElementById('page0-overlay');
    if (page0 && page0.parentNode === canvas) {
      canvas.removeChild(page0);
    }
    // Clear all snapshot timers and pending sign requests from previous page
    for (var t = 0; t < activePageTimers.length; t++) {
      clearInterval(activePageTimers[t].id);
      if (activePageTimers[t].stop) activePageTimers[t].stop();
      // Cancel any pending signed URL requests this timer may have in flight
      if (activePageTimers[t].pendingIds) {
        for (var p = 0; p < activePageTimers[t].pendingIds.length; p++) {
          delete pendingStreamRequests[activePageTimers[t].pendingIds[p]];
          delete pendingAgendaRequests[activePageTimers[t].pendingIds[p]];
        }
      }
    }
    activePageTimers = [];
    canvas.innerHTML = '';

    // Page background image
    var pageConfig = null;
    for (var i = 0; i < config.pages.length; i++) {
      if (config.pages[i].id === pageId) { pageConfig = config.pages[i]; break; }
    }
    if (pageConfig && pageConfig.background_image) {
      var imgUrl = pageConfig.background_image;
      // Relative paths resolved against haven root
      if (imgUrl.indexOf('http') !== 0) {
        var base = window.location.pathname.replace(/\/[^\/]*$/, '/');
        imgUrl = base + imgUrl;
      }
      canvas.style.backgroundImage    = 'url(' + imgUrl + ')';
      canvas.style.backgroundSize     = pageConfig.background_image_fit || 'cover';
      canvas.style.backgroundPosition = 'center';
      canvas.style.backgroundRepeat   = 'no-repeat';
      // Optional dim layer via opacity on a pseudo-overlay div
      var dimOpacity = pageConfig.background_image_opacity;
      if (dimOpacity !== undefined && dimOpacity < 1) {
        var dim = document.createElement('div');
        dim.style.position   = 'absolute';
        dim.style.top        = '0'; dim.style.left = '0';
        dim.style.width      = '100%'; dim.style.height = '100%';
        dim.style.background = '#000';
        dim.style.opacity    = String(1 - dimOpacity);
        dim.style.pointerEvents = 'none';
        canvas.appendChild(dim);
      }
    } else {
      canvas.style.backgroundImage = 'none';
    }

    var pageConfig = null;
    for (var i = 0; i < config.pages.length; i++) {
      if (config.pages[i].id === pageId) {
        pageConfig = config.pages[i];
        break;
      }
    }

    if (!pageConfig) {
      showFatalError('Page ' + pageId + ' not found in config.');
      return;
    }

    // Render each widget
    var nEntity = 0, nEntity2 = 0, nOverrides = 0;
    for (var w = 0; w < pageConfig.widgets.length; w++) {
      renderWidget(pageConfig.widgets[w], canvas);
      var wc = pageConfig.widgets[w];
      if (wc.entity)    nEntity++;
      if (wc.entity2)   nEntity2++;
      if (wc.overrides) nOverrides += wc.overrides.length;
    }
    console.log('HAven page ' + pageId + ': ' + pageConfig.widgets.length + ' widgets, ' +
      nEntity + ' entity, ' + nEntity2 + ' entity2, ' + nOverrides + ' override rules');

    // Re-attach page 0 overlay on top
    if (page0) {
      canvas.appendChild(page0);
    }

    // Re-subscribe to relevant entities for this page
    subscribeToPageEntities(pageConfig);

    // Expose current page as an internal entity for templates/override reactivity.
    updateInternalEntity(INTERNAL_PAGE_ENTITY, String(pageId));

    // Update page nav dots
    updatePageNav(pageId);

    // Reset return-to-default timer on page change
    resetReturnTimer();
  }

  // ---- Page navigation --------------------------------------
  function getPageNavConfig() {
    var nav = {};
    var dev = (config && config.device) ? config.device : {};
    var base = dev.page_nav;
    var alt = dev.page_navigation;

    if (base && typeof base === 'object') {
      for (var k in base) {
        if (base.hasOwnProperty(k)) nav[k] = base[k];
      }
    }

    if (alt && typeof alt === 'object') {
      for (var a in alt) {
        if (alt.hasOwnProperty(a)) nav[a] = alt[a];
      }
    } else if (alt === false) {
      nav.show = false;
    } else if (alt === true && nav.show === undefined) {
      nav.show = true;
    }

    return nav;
  }

  function getPageNavTheme() {
    var nav = getPageNavConfig();
    var size = String(nav.size || 'medium').toLowerCase();
    var presets = {
      micro:  { dot: 4,  hit: 6,  gap: 4,  padY: 6,  padX: 8,  activeScale: 1.2 },
      tiny:   { dot: 6,  hit: 8,  gap: 6,  padY: 8,  padX: 12, activeScale: 1.2 },
      small:  { dot: 9,  hit: 10, gap: 8,  padY: 12, padX: 16, activeScale: 1.2 },
      medium: { dot: 12, hit: 14, gap: 10, padY: 18, padX: 24, activeScale: 1.25 },
      large:  { dot: 15, hit: 18, gap: 12, padY: 22, padX: 30, activeScale: 1.3 }
    };
    if (!presets[size]) size = 'medium';

    return {
      size: size,
      metrics: presets[size],
      background: resolveColor(nav.background_color !== undefined ? nav.background_color : 'rgba(0,0,0,0.28)'),
      primary: resolveColor(nav.primary_color !== undefined ? nav.primary_color : 'rgba(255,255,255,0.95)'),
      secondary: resolveColor(nav.secondary_color !== undefined ? nav.secondary_color : 'rgba(255,255,255,0.40)')
    };
  }

  function stylePageDot(dot, isActive) {
    if (!pageNavTheme || !dot) return;
    dot.style.background = isActive ? pageNavTheme.primary : pageNavTheme.secondary;
    dot.style.transform = isActive ? ('scale(' + pageNavTheme.metrics.activeScale + ')') : 'scale(1)';
    dot.style.webkitTransform = dot.style.transform;
    dot.style.boxShadow = 'none';
    dot.style.webkitBoxShadow = 'none';
  }

  function applyPageNavTheme() {
    var nav = document.getElementById('page-nav');
    if (!nav) return;

    pageNavTheme = getPageNavTheme();
    var m = pageNavTheme.metrics;

    nav.style.gap = m.gap + 'px';
    nav.style.padding = m.padY + 'px ' + m.padX + 'px';
    nav.style.borderRadius = '999px';
    nav.style.background = pageNavTheme.background;
    nav.style.touchAction = 'manipulation';

    var dots = nav.querySelectorAll('.page-dot');
    for (var i = 0; i < dots.length; i++) {
      var dot = dots[i];
      dot.style.width = m.dot + 'px';
      dot.style.height = m.dot + 'px';
      dot.style.border = m.hit + 'px solid transparent';
      dot.style.backgroundClip = 'padding-box';
      dot.style.boxSizing = 'content-box';
      dot.style.webkitBoxSizing = 'content-box';
      dot.style.touchAction = 'manipulation';

      stylePageDot(dot, dot.className.indexOf('active') !== -1);

      if (!dot._havenHoverBound) {
        dot.addEventListener('mouseenter', function () {
          if (this.className.indexOf('active') === -1 && pageNavTheme) {
            this.style.background = pageNavTheme.primary;
          }
        });
        dot.addEventListener('mouseleave', function () {
          stylePageDot(this, this.className.indexOf('active') !== -1);
        });
        dot._havenHoverBound = true;
      }
    }
  }

  function setupPageNav() {
    var nav = document.getElementById('page-nav');
    nav.innerHTML = '';
    nav.style.display = '';

    var navCfg = getPageNavConfig();
    var showDots = (navCfg.show !== false);

    if (!showDots) {
      nav.style.display = 'none';
      setupSwipeNav();
      return;
    }

    if (config.pages.length <= 1) return;

    for (var i = 0; i < config.pages.length; i++) {
      if (config.pages[i].id === 0) continue;  // page 0 is persistent, not in nav dots
      (function (page) {
        var dot = document.createElement('div');
        dot.className   = 'page-dot';
        dot.setAttribute('data-page', page.id);
        dot.addEventListener('click', function () {
          navigateTo(page.id);
        });
        nav.appendChild(dot);
      })(config.pages[i]);
    }

    applyPageNavTheme();
    setupSwipeNav();
  }

  // ---- Swipe gesture navigation ----------------------------
  function setupSwipeNav() {
    var canvas  = document.getElementById('canvas');
    var touchStartX = 0;
    var touchStartY = 0;
    var touchStartTime = 0;
    var touchStartValid = false;
    var SWIPE_MAX_TIME_MS = 900;
    var SWIPE_MIN_X_PX = 36;
    var SWIPE_MIN_DOMINANCE = 0.7; // allow modest diagonal movement on tablets

    // Any touch or click anywhere on the canvas resets the return timer
    canvas.addEventListener('touchstart', function(e) {
      resetReturnTimer();
      if (!e.touches || !e.touches.length) return;
      if (e.touches.length > 1) {
        touchStartValid = false;
        return;
      }
      touchStartX    = e.touches[0].clientX;
      touchStartY    = e.touches[0].clientY;
      touchStartTime = Date.now();
      touchStartValid = true;
    }, { passive: true });

    canvas.addEventListener('touchmove', function(e) {
      if (!touchStartValid) return;
      if (!e.touches || !e.touches.length) return;
      if (e.touches.length > 1) return;

      var dx = e.touches[0].clientX - touchStartX;
      var dy = e.touches[0].clientY - touchStartY;
      var adx = Math.abs(dx);
      var ady = Math.abs(dy);

      // When movement is predominantly horizontal, prevent browser pull-to-refresh
      // and let the dashboard own the gesture.
      if (adx >= 10 && adx >= (ady * 0.75)) {
        e.preventDefault();
      }
    }, { passive: false });

    canvas.addEventListener('mousedown', function() {
      resetReturnTimer();
    });

    canvas.addEventListener('touchend', function(e) {
      if (!touchStartValid) return;
      touchStartValid = false;
      if (!e.changedTouches || !e.changedTouches.length) return;
      var dx   = e.changedTouches[0].clientX - touchStartX;
      var dy   = e.changedTouches[0].clientY - touchStartY;
      var dt   = Date.now() - touchStartTime;
      var adx  = Math.abs(dx);
      var ady  = Math.abs(dy);

      // Must be: horizontal enough, quick enough, and long enough.
      // Relaxed dominance check improves reliability on touch devices where
      // a slight diagonal drift is common.
      if (dt > SWIPE_MAX_TIME_MS) return;
      if (adx < SWIPE_MIN_X_PX) return;
      if (adx < (ady * SWIPE_MIN_DOMINANCE)) return;

      var pageIds = config.pages.map(function(p) { return p.id; }).filter(function(id) { return id !== 0; });
      var idx     = pageIds.indexOf(currentPage);

      if (dx < 0 && idx < pageIds.length - 1) {
        // Swipe left -> next page
        navigateTo(pageIds[idx + 1]);
        resetReturnTimer();
      } else if (dx > 0 && idx > 0) {
        // Swipe right -> previous page
        navigateTo(pageIds[idx - 1]);
        resetReturnTimer();
      }
    }, { passive: true });

    canvas.addEventListener('touchcancel', function() {
      touchStartValid = false;
    }, { passive: true });
  }

  function updatePageNav(pageId) {
    var dots = document.querySelectorAll('.page-dot');
    for (var i = 0; i < dots.length; i++) {
      var dot = dots[i];
      var isActive = (parseInt(dot.getAttribute('data-page'), 10) === pageId);
      dot.className = isActive ? 'page-dot active' : 'page-dot';
      stylePageDot(dot, isActive);
    }
  }

  function navigateTo(pageId) {
    if (pageId === currentPage) return;
    if (pageId === 0) return;  // page 0 is a persistent overlay, not navigable
    renderPage(pageId);
    if (history.replaceState) {
      history.replaceState(null, '', setUrlParam('page', pageId));
    }
  }

  function getNavigablePageIds() {
    if (!config || !config.pages) return [];
    return config.pages
      .map(function(p) { return p.id; })
      .filter(function(id) { return id !== 0; });
  }

  function resolveNavigatePage(action) {
    if (!action) return null;

    // Explicit page always wins.
    if (action.page !== undefined && action.page !== null) {
      var p = parseInt(action.page, 10);
      return isNaN(p) ? null : p;
    }

    var dir = action.direction ? String(action.direction).toLowerCase() : '';
    if (!dir) return null;

    var pageIds = getNavigablePageIds();
    if (!pageIds.length) return null;

    if (dir === 'home') return pageIds[0];

    var idx = pageIds.indexOf(currentPage);
    if (idx === -1) idx = 0;

    if (dir === 'next') {
      if (idx >= pageIds.length - 1) return null;
      return pageIds[idx + 1];
    }

    if (dir === 'prev' || dir === 'previous') {
      if (idx <= 0) return null;
      return pageIds[idx - 1];
    }

    return null;
  }

  // ---- Return-to-default timer ------------------------------
  function resetReturnTimer() {
    if (returnTimer) clearTimeout(returnTimer);
    var seconds = config.device.return_to_default;
    var defaultPage = config.device.default_page || 1;
    if (!seconds || currentPage === defaultPage) return;

    returnTimer = setTimeout(function () {
      navigateTo(defaultPage);
    }, seconds * 1000);
  }

  // ---- Screensaver ------------------------------------------
  function initScreensaver() {
    var ss = config.device && config.device.screensaver;
    if (!ss || !ss.timeout) return;
    if (!screensaverListenersAdded) {
      screensaverListenersAdded = true;
      document.addEventListener('touchstart', resetScreensaverTimer, true);
      document.addEventListener('mousedown',  resetScreensaverTimer, true);
      document.addEventListener('keydown',    resetScreensaverTimer, true);
    }
    resetScreensaverTimer();
  }

  function resetScreensaverTimer() {
    if (screensaverActive) dismissScreensaver();
    if (screensaverTimer) clearTimeout(screensaverTimer);
    var ss = config && config.device && config.device.screensaver;
    if (!ss || !ss.timeout) return;
    screensaverTimer = setTimeout(activateScreensaver, ss.timeout * 1000);
  }

  function activateScreensaver() {
    if (screensaverActive) return;
    screensaverActive = true;

    var ss       = config.device.screensaver;
    var opacity  = ss.opacity !== undefined ? ss.opacity : 0.95;
    var text     = ss.hasOwnProperty('text') ? ss.text : null;
    var colors   = [
      '#ffffff',
      resolveColor('primary'),
      resolveColor('warning'),
      resolveColor('danger')
    ];
    var colorIdx = 0;

    var overlay = document.createElement('div');
    overlay.id = 'haven-screensaver';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;' +
      'background:rgba(0,0,0,' + opacity + ');z-index:10000;cursor:none;' +
      'transition:opacity 0.6s ease';
    overlay.style.opacity = '0';

    var label = text ? document.createElement('div') : null;
    if (label) {
      label.textContent = text;
      label.style.cssText = 'position:absolute;font-size:2rem;font-weight:bold;' +
        'color:#ffffff;pointer-events:none;user-select:none;white-space:nowrap;' +
        'font-family:"Segoe UI",Tahoma,Geneva,Verdana,sans-serif;letter-spacing:0.05em;';
      overlay.appendChild(label);
    }
    document.body.appendChild(overlay);
    screensaverEl = overlay;

    // Fade in
    requestAnimationFrame(function() { overlay.style.opacity = '1'; });

    if (label) {
      // Wait for label to have dimensions before starting animation
      setTimeout(function() {
        var x  = Math.random() * Math.max(0, overlay.clientWidth  - label.offsetWidth);
        var y  = Math.random() * Math.max(0, overlay.clientHeight - label.offsetHeight);
        var dx = 1.2;
        var dy = 0.8;

        function animate() {
          if (!screensaverActive) return;
          var ow = overlay.clientWidth;
          var oh = overlay.clientHeight;
          var lw = label.offsetWidth;
          var lh = label.offsetHeight;
          var bounced = false;

          x += dx; y += dy;
          if (x <= 0)        { x = 0;       dx =  Math.abs(dx); bounced = true; }
          if (x + lw >= ow)  { x = ow - lw; dx = -Math.abs(dx); bounced = true; }
          if (y <= 0)        { y = 0;       dy =  Math.abs(dy); bounced = true; }
          if (y + lh >= oh)  { y = oh - lh; dy = -Math.abs(dy); bounced = true; }

          if (bounced) {
            colorIdx = (colorIdx + 1) % colors.length;
            label.style.color = colors[colorIdx];
          }
          label.style.left = Math.round(x) + 'px';
          label.style.top  = Math.round(y) + 'px';
          screensaverRaf = requestAnimationFrame(animate);
        }
        screensaverRaf = requestAnimationFrame(animate);
      }, 100);
    }
  }

  function dismissScreensaver() {
    screensaverActive = false;
    if (screensaverRaf) { cancelAnimationFrame(screensaverRaf); screensaverRaf = null; }
    if (screensaverEl) {
      var el = screensaverEl;
      screensaverEl = null;
      el.style.opacity = '0';
      setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 650);
    }
  }

  // ---- Clock ------------------------------------------------
  function startClock() {
    updateClock();
    clockTimer = setInterval(updateClock, 1000);
  }

  function updateClock() {
    var els = document.querySelectorAll('.widget-clock');
    if (!els.length) return;
    var now = new Date();
    var h   = now.getHours();
    var m   = String(now.getMinutes()).length < 2 ? '0' + now.getMinutes() : String(now.getMinutes());
    var timeStr = h + ':' + m;
    for (var i = 0; i < els.length; i++) {
      els[i].textContent = timeStr;
    }
  }

  // ---- Internal time entity --------------------------------
  // Updates internal.currentdtm once per minute (aligned to minute boundary)
  function startInternalTime() {
    updateInternalEntity(INTERNAL_TIME_ENTITY, (new Date()).toISOString());
    if (internalTimeTimer) {
      clearTimeout(internalTimeTimer);
      internalTimeTimer = null;
    }

    var now = new Date();
    var msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    if (msToNextMinute < 0) msToNextMinute = 0;

    internalTimeTimer = setTimeout(function () {
      updateInternalEntity(INTERNAL_TIME_ENTITY, (new Date()).toISOString());
      internalTimeTimer = setInterval(function () {
        updateInternalEntity(INTERNAL_TIME_ENTITY, (new Date()).toISOString());
      }, 60000);
    }, msToNextMinute);
  }

  // ---- Widget rendering -------------------------------------
  function supportsWidgetAnimation(w) {
    if (!w || !w.type) return false;
    return (w.type === 'label' || w.type === 'rect' || w.type === 'rectangle');
  }

  function createWidgetRenderSurface(host, w) {
    if (!supportsWidgetAnimation(w)) return host;
    var inner = document.createElement('div');
    inner.className = 'widget-surface';
    inner.style.position = 'absolute';
    inner.style.left = '0';
    inner.style.top = '0';
    inner.style.width = '100%';
    inner.style.height = '100%';
    host.appendChild(inner);
    return inner;
  }

  function normalizeAnimationName(name) {
    if (name === undefined || name === null) return '';
    var n = String(name).toLowerCase();
    if (n === 'pulse' || n === 'pulse_fast' || n === 'blink' || n === 'breathe') return n;
    if (n === 'none') return '';
    return '';
  }

  function applyWidgetAnimation(host, w, overrides) {
    if (!host || !w || !supportsWidgetAnimation(w)) return;
    var ovr = overrides || null;
    var name = normalizeAnimationName((ovr && ovr.animation !== undefined) ? ovr.animation : w.animation);

    host.classList.remove('widget-anim-active', 'widget-anim-pulse', 'widget-anim-pulse-fast', 'widget-anim-blink', 'widget-anim-breathe');
    if (!name) return;

    host.classList.add('widget-anim-active');
    if (name === 'pulse') host.classList.add('widget-anim-pulse');
    else if (name === 'pulse_fast') host.classList.add('widget-anim-pulse-fast');
    else if (name === 'blink') host.classList.add('widget-anim-blink');
    else if (name === 'breathe') host.classList.add('widget-anim-breathe');
  }

  function renderWidget(w, canvas) {
    var el = document.createElement('div');
    var contentEl = createWidgetRenderSurface(el, w);
    el.id        = 'w-' + w.id;
    el.className = 'widget';
    el.style.left   = w.x + 'px';
    el.style.top    = w.y + 'px';
    el.style.width  = w.w + 'px';
    el.style.height = w.h + 'px';

    // Apply base opacity if specified
    if (w.opacity !== undefined && !supportsWidgetAnimation(w)) {
      el.style.opacity = w.opacity;
    }

    // Apply border if specified
    if (w.border_width) {
      el.style.borderWidth = w.border_width + 'px';
      el.style.borderStyle = 'solid';
      el.style.borderColor = resolveColor(w.border_color || 'surface2');
      el.style.boxSizing   = 'border-box';
    }

    switch (w.type) {
      case 'label':        renderLabel(contentEl, w, el);       break;
      case 'rect':         renderRectangle(contentEl, w, el);   break;
      case 'rectangle':    renderRectangle(contentEl, w, el);   break;
      case 'bar':          renderBar(contentEl, w);          break;
      case 'slider':       renderSlider(contentEl, w);       break;
      case 'switch':       renderSwitch(contentEl, w);       break;
      case 'scene':        renderScene(contentEl, w);        break;
      case 'button':       renderButton(contentEl, w);       break;
      case 'clock':        renderClock(contentEl, w);        break;
      case 'image':        renderImage(contentEl, w);        break;
      case 'camera':       renderCamera(contentEl, w);       break;
      case 'arc':          renderArc(contentEl, w);          break;
      case 'agenda':       renderAgenda(contentEl, w);       break;
      case 'history_chart': renderHistoryChart(contentEl, w); break;
      default:
        contentEl.style.background = 'rgba(255,0,0,0.3)';
        contentEl.textContent = 'Unknown: ' + w.type;
    }

    // Visibility is controlled through conditional overrides using set.visible.
    bindOverrideVisibility(el, w);
    bindOverrideAnimation(el, w);

    canvas.appendChild(el);
  }

  function hasVisibleOverrideRule(w) {
    if (!w || !w.overrides || !w.overrides.length) return false;
    for (var i = 0; i < w.overrides.length; i++) {
      var rule = w.overrides[i];
      if (rule && rule.set && rule.set.hasOwnProperty('visible')) return true;
    }
    return false;
  }

  function hasAnimationOverrideRule(w) {
    if (!w || !w.overrides || !w.overrides.length) return false;
    for (var i = 0; i < w.overrides.length; i++) {
      var rule = w.overrides[i];
      if (rule && rule.set && rule.set.hasOwnProperty('animation')) return true;
    }
    return false;
  }

  function hasOverrideSource(w, sourceName) {
    if (!w || !w.overrides || !w.overrides.length || !sourceName) return false;
    for (var i = 0; i < w.overrides.length; i++) {
      var rule = w.overrides[i];
      if (!rule || !rule.when) continue;
      if (whenUsesSource(rule.when, sourceName)) return true;
    }
    return false;
  }

  function whenUsesSource(when, sourceName) {
    if (!when || !when.conditions || !when.conditions.length) return false;
    for (var i = 0; i < when.conditions.length; i++) {
      var cond = when.conditions[i];
      if (!cond) continue;
      if (cond.conditions && cond.logic) {
        if (whenUsesSource(cond, sourceName)) return true;
        continue;
      }
      if ((cond.source || 'state') === sourceName) return true;
    }
    return false;
  }

  function applyOverrideVisibility(el, w, state, state2) {
    var ovr = resolveOverrides(w, state, state2) || {};
    if (ovr.visible !== undefined) {
      el.style.display = ovr.visible ? '' : 'none';
    } else {
      el.style.display = '';
    }
  }

  function bindOverrideVisibility(el, w) {
    if (!hasVisibleOverrideRule(w)) return;

    var stateCache = w.entity ? (entityStates[w.entity] || null) : null;
    var state2Cache = w.entity2 ? (entityStates[w.entity2] || null) : null;
    var hasPageSource = hasOverrideSource(w, 'page');

    function updateVisibility() {
      applyOverrideVisibility(el, w, stateCache, state2Cache);
    }

    if (w.entity) {
      registerEntityCallback(w.entity, function(state) {
        stateCache = state;
        updateVisibility();
      });
    }

    if (w.entity2) {
      registerEntityCallback(w.entity2, function(state) {
        state2Cache = state;
        updateVisibility();
      });
    }

    if (hasPageSource) {
      registerEntityCallback(INTERNAL_PAGE_ENTITY, function() {
        updateVisibility();
      });
    }

    updateVisibility();
  }

  function bindOverrideAnimation(el, w) {
    if (!supportsWidgetAnimation(w)) return;
    if (!hasAnimationOverrideRule(w)) return;

    var stateCache = w.entity ? (entityStates[w.entity] || null) : null;
    var state2Cache = w.entity2 ? (entityStates[w.entity2] || null) : null;
    var hasPageSource = hasOverrideSource(w, 'page');

    function updateAnimation() {
      var ovr = resolveOverrides(w, stateCache, state2Cache) || {};
      applyWidgetAnimation(el, w, ovr);
    }

    if (w.entity) {
      registerEntityCallback(w.entity, function(state) {
        stateCache = state;
        updateAnimation();
      });
    }

    if (w.entity2) {
      registerEntityCallback(w.entity2, function(state) {
        state2Cache = state;
        updateAnimation();
      });
    }

    if (hasPageSource) {
      registerEntityCallback(INTERNAL_PAGE_ENTITY, function() {
        updateAnimation();
      });
    }

    updateAnimation();
  }

  // -- Label --
  function renderLabel(el, w, hostEl) {
    var host = hostEl || el;
    el.className += ' widget-label align-' + (w.align || 'left');
    el.style.color          = resolveColor(w.color      || 'text');
    el.style.background     = resolveColor(w.background || 'transparent');
    el.style.fontSize       = (w.font_size || config.theme.font_size || 16) + 'px';
    el.style.fontWeight     = w.font_weight || '400';
    el.style.lineHeight     = '1';
    el.style.padding        = '0';
    if (w.valign === 'top') el.style.alignItems = 'flex-start';
    else if (w.valign === 'bottom') el.style.alignItems = 'flex-end';
    else el.style.alignItems = 'center';
    if (w.letter_spacing !== undefined) el.style.letterSpacing = w.letter_spacing + 'px';
    if (w.opacity !== undefined)        el.style.opacity       = w.opacity;

    // Text overflow mode (default: crop - clip silently at widget edge)
    var mode = w.mode || 'crop';
    if (mode === 'dots') {
      // Switch to block layout so text-overflow: ellipsis works reliably
      el.style.display      = 'block';
      el.style.lineHeight   = w.h + 'px';     // vertical centre via line-height
      el.style.textAlign    = w.align || 'left';
      el.style.textOverflow = 'ellipsis';
      // overflow:hidden and white-space:nowrap already set by .widget-label CSS
    } else if (mode === 'wrap') {
      el.style.whiteSpace        = 'normal';  // allow text to wrap within fixed box
      el.style.webkitBoxAlign    = 'start';   // old webkit flex
      el.style.msFlexAlign       = 'start';   // IE10 flex
      el.style.alignItems        = 'flex-start'; // top-align wrapped text block
      el.style.padding           = '4px';     // small vertical breathing room
    }
    var text = w.text !== undefined ? String(w.text) : '';

    // Single raw FA codepoint (legacy) - apply font directly
    if (text.length === 1 && text.charCodeAt(0) >= 0xF000 && text.charCodeAt(0) <= 0xF8FF) {
      el.style.fontFamily = 'FontAwesome';
      setContent(el, text);
    } else {
      // Handles plain text and [fa-name] icon tokens
      setContent(el, text);
    }

    // Labels without actions are transparent to taps - let clicks pass to widgets below
    if (!w.action) {
      el.style.pointerEvents = 'none';
    }
    applyWidgetAnimation(host, w, null);

    if (w.entity || w.entity2) {
      // Cache both states so whichever entity fires last can pass both to the update.
      // entity  = primary: drives format, overrides, and state/state_str/attr in templates.
      // entity2 = secondary: triggers re-renders and exposes state2/state_str2/attr2.
      var stateCache  = null;
      var state2Cache = null;

      // Use var expression, not function declaration — declarations inside if blocks
      // are illegal in ES5 strict mode and behave inconsistently across browsers.
      var doLabelUpdate = function() {
        updateLabelFromState(el, w, stateCache, state2Cache, host);
      };

      if (w.entity) {
        registerEntityCallback(w.entity, function (state) {
          stateCache = state;
          doLabelUpdate();
        });
      }

      if (w.entity2) {
        registerEntityCallback(w.entity2, function (state) {
          state2Cache = state;
          doLabelUpdate();
        });
      }
    }
  }

  // updateLabelFromState(el, w, state, state2)
  //   state  - primary entity HA state object (may be null on first render)
  //   state2 - secondary entity HA state object (null when entity2 not configured)
  //   Passes state2 through to resolveOverrides and applyTemplate so both the
  //   condition system and template expressions can reference the secondary entity.
  function updateLabelFromState(el, w, state, state2, hostEl) {
    var host = hostEl || el;
    var val = null;
    if (state) {
      if (w.entity_attribute) {
        var attrs = state.attributes || {};
        val = (attrs[w.entity_attribute] !== undefined && attrs[w.entity_attribute] !== null)
          ? attrs[w.entity_attribute]
          : null;
      } else {
        val = state.state;
      }
    }

    // Apply text - handles plain text and [mdi:name] / [small:x] icon tokens
    var overrides = resolveOverrides(w, state, state2);
    var s = overrides || {};
    var textOverride = (s.text !== undefined) ? String(s.text) : null;
    var useTemplateText = (w.text && hasTemplate(w.text));
    var hasTextOverrideRule = !!(w.overrides && w.overrides.length && w.overrides.some(function(r) { return r.set && r.set.text !== undefined; }));
    var baseFallback = (w.text && !w.format && !useTemplateText && hasTextOverrideRule) ? w.text : formatValue(val, w);
    var baseText = textOverride !== null ? textOverride : (useTemplateText ? String(w.text) : baseFallback);
    var formatted = applyTemplate(baseText, state, state2);
    if (formatted.length === 1 && formatted.charCodeAt(0) >= 0xF000 && formatted.charCodeAt(0) <= 0xF8FF) {
      el.style.fontFamily = 'FontAwesome';
      setContent(el, formatted);
    } else {
      el.textContent = '';
      setContent(el, formatted);
    }

    // Apply state-based styles
    var colorToken = s.color || w.color || 'text';
    colorToken = applyTemplate(colorToken, state, state2);
    el.style.color   = resolveColor(colorToken);
    if (s.background !== undefined) el.style.background = resolveColor(s.background);
    if (s.opacity   !== undefined) el.style.opacity       = s.opacity;
    if (s.letter_spacing !== undefined) el.style.letterSpacing = s.letter_spacing + 'px';
    if (s.font_size !== undefined) el.style.fontSize = s.font_size + 'px';
    else el.style.fontSize = (w.font_size || config.theme.font_size || 16) + 'px';
    applyWidgetAnimation(host, w, s);
  }

  // -- Rectangle --
  function renderRectangle(el, w, hostEl) {
    var host = hostEl || el;
    el.className += ' widget-rectangle';
    var radiusPx = (w.radius !== undefined ? w.radius : 0) + 'px';
    el.style.borderRadius = radiusPx;
    // Keep fill clipped to rounded corners even when borders/overlays are used.
    el.style.overflow = 'hidden';
    applyRectangleFill(el, w, null);
    if (w.opacity !== undefined) el.style.opacity = w.opacity;
    applyWidgetAnimation(host, w, null);

    if (w.entity || w.entity2) {
      var stateCache  = w.entity  ? (entityStates[w.entity]  || null) : null;
      var state2Cache = w.entity2 ? (entityStates[w.entity2] || null) : null;

      function doRectUpdate() {
        var ovr = resolveOverrides(w, stateCache, state2Cache) || {};
        applyRectangleFill(el, w, ovr);
        applyWidgetAnimation(host, w, ovr);
        if (ovr.opacity      !== undefined) el.style.opacity     = ovr.opacity;
        if (ovr.border_color !== undefined) el.style.borderColor = resolveColor(ovr.border_color);
        if (ovr.border_width !== undefined) {
          el.style.borderWidth = ovr.border_width + 'px';
          el.style.borderStyle = 'solid';
          el.style.boxSizing   = 'border-box';
        }
      }

      if (w.entity) {
        registerEntityCallback(w.entity, function(state) {
          stateCache = state;
          doRectUpdate();
        });
      }
      if (w.entity2) {
        registerEntityCallback(w.entity2, function(state) {
          state2Cache = state;
          doRectUpdate();
        });
      }
    }

    // If no action, pass pointer events through so taps reach widgets below
    if (!w.action) {
      el.style.pointerEvents = 'none';
    } else {
      el.style.pointerEvents = 'auto';
      el.style.cursor = 'pointer';

      // Tap handler
      el.addEventListener('click', function() {
        handleAction(w.action);
        resetReturnTimer();
      });

      // Visual press feedback
      el.addEventListener('mousedown',  function() { el.style.opacity = '0.75'; });
      el.addEventListener('mouseup',    function() { el.style.opacity = '1'; });
      el.addEventListener('mouseleave', function() { el.style.opacity = '1'; });
      el.addEventListener('touchstart', function() { el.style.opacity = '0.75'; }, { passive: true });
      el.addEventListener('touchend',   function() { el.style.opacity = '1'; });
    }
  }

  function applyRectangleFill(el, w, ovr) {
    var rule = ovr || {};
    var gradient = (rule.gradient !== undefined) ? rule.gradient : w.gradient;
    if (gradient && typeof gradient === 'object') {
      var css = resolveLinearGradient(gradient);
      if (css) {
        el.style.background = css;
        return;
      }
    }
    var bg = (rule.background !== undefined) ? rule.background : (w.background || 'surface');
    el.style.background = resolveColor(bg);
  }

  // -- Bar --
  function renderBar(el, w) {
    el.className += ' widget-bar';
    var radius = (w.radius !== undefined ? w.radius : 0) + 'px';

    // Track (background) - built into the widget, no separate rect needed
    el.style.background   = resolveColor(w.background || 'surface2');
    el.style.borderRadius = radius;
    el.style.overflow     = 'hidden';

    var fill = document.createElement('div');
    fill.className = 'widget-bar-fill';
    fill.style.borderRadius = radius;
    fill.style.background   = resolveColor(w.color || 'primary');
    el.appendChild(fill);

    if (w.entity || w.entity2) {
      var stateCache  = w.entity  ? (entityStates[w.entity]  || null) : null;
      var state2Cache = w.entity2 ? (entityStates[w.entity2] || null) : null;

      function doBarUpdate() {
        updateBarFromState(fill, w, stateCache, state2Cache);
      }

      if (w.entity)  registerEntityCallback(w.entity,  function(s) { stateCache  = s; doBarUpdate(); });
      if (w.entity2) registerEntityCallback(w.entity2, function(s) { state2Cache = s; doBarUpdate(); });

      // Apply cached state immediately (handles page nav after WS already connected)
      if (stateCache || state2Cache) doBarUpdate();
    }
  }

  function updateBarFromState(fill, w, state, state2) {
    var val = state ? parseFloat(state.state) : 0;
    if (isNaN(val)) val = 0;

    var max = (w.max !== undefined) ? parseFloat(w.max) : 100;
    if (isNaN(max) || max <= 0) max = 100;
    var pct = Math.max(0, Math.min(100, (val / max) * 100));
    fill.style.width = pct + '%';

    var thresholdColor = getThresholdColor(w, val, (w.color || 'primary'));
    var ovr = resolveOverrides(w, state, state2) || {};
    fill.style.background = resolveColor(ovr.color !== undefined ? ovr.color : thresholdColor);
  }

  // -- Slider --
  // Interactive slider for writing raw numeric values to HA services.
  // Reads current value from entity state or an optional entity attribute.
  function renderSlider(el, w) {
    el.className += ' widget-slider';

    var orientation = (w.orientation === 'vertical') ? 'vertical' : 'horizontal';
    if (orientation === 'vertical') el.className += ' widget-slider-vertical';

    var min = (w.min !== undefined) ? parseFloat(w.min) : 0;
    var max = (w.max !== undefined) ? parseFloat(w.max) : 100;
    if (isNaN(min)) min = 0;
    if (isNaN(max)) max = 100;
    if (max <= min) max = min + 1;

    var step = (w.step !== undefined) ? parseFloat(w.step) : 1;
    if (isNaN(step) || step <= 0) step = 1;

    var updateMode = (w.update_mode === 'drag') ? 'drag' : 'release';
    var valueAttr  = w.value_attribute;
    var minAttr    = w.min_attribute;
    var maxAttr    = w.max_attribute;
    var baseMin    = min;
    var baseMax    = max;
    var currentValue = min;
    var isDragging = false;
    var sliderLocked = !!w.locked;
    var lastSentValue = null;
    var latestState = null;

    var crossSize = (orientation === 'vertical') ? w.w : w.h;
    var radius = (w.radius !== undefined) ? w.radius : Math.round(crossSize / 2);
    var thumbSize = (w.thumb_size !== undefined) ? parseFloat(w.thumb_size) : Math.max(14, Math.round(crossSize * 0.9));
    if (isNaN(thumbSize) || thumbSize < 8) thumbSize = 8;

    // Keep the thumb free to extend outside widget bounds when thumb_size is large.
    // The track itself remains clipped via an inner container.
    el.style.background = 'transparent';
    el.style.borderRadius = radius + 'px';
    el.style.overflow = 'visible';

    var track = document.createElement('div');
    track.className = 'widget-slider-track';
    track.style.position = 'absolute';
    track.style.left = '0';
    track.style.top = '0';
    track.style.width = '100%';
    track.style.height = '100%';
    track.style.background = resolveColor(w.background || 'surface2');
    track.style.borderRadius = radius + 'px';
    track.style.overflow = 'hidden';
    el.appendChild(track);

    var fill = document.createElement('div');
    fill.className = 'widget-slider-fill';
    fill.style.background = resolveColor(w.color || 'primary');
    fill.style.borderRadius = radius + 'px';
    track.appendChild(fill);

    var thumb = document.createElement('div');
    thumb.className = 'widget-slider-thumb';
    thumb.style.width  = thumbSize + 'px';
    thumb.style.height = thumbSize + 'px';
    thumb.style.borderRadius = Math.round(thumbSize / 2) + 'px';
    thumb.style.background = resolveColor(w.thumb_color || 'text');
    el.appendChild(thumb);

    function clampValue(v) {
      if (v < min) return min;
      if (v > max) return max;
      return v;
    }

    function stepDecimals(s) {
      var str = String(s);
      var dot = str.indexOf('.');
      if (dot === -1) return 0;
      return str.length - dot - 1;
    }

    var stepDp = stepDecimals(step);
    function roundToStep(v) {
      var n = (v - min) / step;
      var out = min + Math.round(n) * step;
      out = clampValue(out);
      if (stepDp > 0) out = parseFloat(out.toFixed(stepDp));
      return out;
    }

    function valueToRatio(value) {
      var r = (value - min) / (max - min);
      if (r < 0) r = 0;
      if (r > 1) r = 1;
      return r;
    }

    function readNumberFromAttribute(state, attrName) {
      if (!state || !attrName || !state.attributes) return null;
      var raw = state.attributes[attrName];
      if (raw === undefined || raw === null) return null;
      var n = parseFloat(raw);
      if (isNaN(n)) return null;
      return n;
    }

    function updateDynamicBounds(state) {
      var nextMin = baseMin;
      var nextMax = baseMax;

      var attrMin = readNumberFromAttribute(state, minAttr);
      var attrMax = readNumberFromAttribute(state, maxAttr);
      if (attrMin !== null) nextMin = attrMin;
      if (attrMax !== null) nextMax = attrMax;

      if (nextMax <= nextMin) nextMax = nextMin + 1;
      min = nextMin;
      max = nextMax;
    }

    function applySliderStyle(state) {
      var ovr = resolveOverrides(w, state) || {};
      var bg = (ovr.background !== undefined) ? ovr.background : (w.background || 'surface2');
      var fg = (ovr.color !== undefined) ? ovr.color : (w.color || 'primary');
      var th = (ovr.thumb_color !== undefined) ? ovr.thumb_color : (w.thumb_color || 'text');
      sliderLocked = (ovr.locked !== undefined) ? !!ovr.locked : !!w.locked;
      track.style.background = resolveColor(bg);
      fill.style.background = resolveColor(fg);
      thumb.style.background = resolveColor(th);
      thumb.style.pointerEvents = sliderLocked ? 'none' : 'auto';
      thumb.style.cursor = sliderLocked ? 'not-allowed' : 'pointer';
      el.style.cursor = sliderLocked ? 'not-allowed' : 'default';
      if (ovr.opacity !== undefined) el.style.opacity = ovr.opacity;
      else if (w.opacity !== undefined) el.style.opacity = w.opacity;
    }

    function applySliderVisual(value, state) {
      var r = valueToRatio(value);
      var travel;
      var pos;

      applySliderStyle(state);

      if (orientation === 'vertical') {
        travel = Math.max(0, w.h - thumbSize);
        pos = Math.round((1 - r) * travel);
        var fillH = Math.round(w.h - (pos + thumbSize / 2));
        if (fillH < 0) fillH = 0;
        fill.style.left = '0';
        fill.style.width = '100%';
        fill.style.bottom = '0';
        fill.style.height = fillH + 'px';
        fill.style.top = '';
        thumb.style.top = pos + 'px';
        thumb.style.left = Math.round((w.w - thumbSize) / 2) + 'px';
      } else {
        travel = Math.max(0, w.w - thumbSize);
        pos = Math.round(r * travel);
        var fillW = Math.round(pos + thumbSize / 2);
        if (fillW < 0) fillW = 0;
        if (fillW > w.w) fillW = w.w;
        fill.style.top = '0';
        fill.style.left = '0';
        fill.style.height = '100%';
        fill.style.width = fillW + 'px';
        fill.style.bottom = '';
        thumb.style.left = pos + 'px';
        thumb.style.top = Math.round((w.h - thumbSize) / 2) + 'px';
      }
    }

    function getClientPoint(evt) {
      if (evt.touches && evt.touches.length) {
        return { x: evt.touches[0].clientX, y: evt.touches[0].clientY };
      }
      if (evt.changedTouches && evt.changedTouches.length) {
        return { x: evt.changedTouches[0].clientX, y: evt.changedTouches[0].clientY };
      }
      return { x: evt.clientX, y: evt.clientY };
    }

    function valueFromEvent(evt) {
      var p = getClientPoint(evt);
      var rect = el.getBoundingClientRect();
      var ratio;

      if (orientation === 'vertical') {
        ratio = 1 - ((p.y - rect.top) / rect.height);
      } else {
        ratio = (p.x - rect.left) / rect.width;
      }

      if (ratio < 0) ratio = 0;
      if (ratio > 1) ratio = 1;
      return roundToStep(min + ratio * (max - min));
    }

    function sendSliderValue(value) {
      if (sliderLocked) return;
      if (!w.action) return;
      handleAction(w.action, value);
    }

    function updateFromPointer(evt, isMove) {
      if (!isDragging) return;
      var v = valueFromEvent(evt);
      if (v === currentValue && isMove) return;
      currentValue = v;
      applySliderVisual(currentValue, entityStates[w.entity]);
      resetReturnTimer();

      if (updateMode === 'drag' && currentValue !== lastSentValue) {
        sendSliderValue(currentValue);
        lastSentValue = currentValue;
      }
    }

    function finishDrag(evt) {
      if (!isDragging) return;
      isDragging = false;
      if (evt) updateFromPointer(evt, false);
      if (updateMode !== 'drag' || currentValue !== lastSentValue) {
        sendSliderValue(currentValue);
        lastSentValue = currentValue;
      }
      resetReturnTimer();
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
    }

    function onMouseMove(e) {
      updateFromPointer(e, true);
    }

    function onMouseUp(e) {
      finishDrag(e);
    }

    function onTouchMove(e) {
      e.preventDefault();
      updateFromPointer(e, true);
    }

    function onTouchEnd(e) {
      finishDrag(e);
    }

    function startDrag(e) {
      if (sliderLocked) return;
      e.preventDefault();
      isDragging = true;
      lastSentValue = null;
      updateFromPointer(e, false);
      resetReturnTimer();
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('touchend', onTouchEnd);
      document.addEventListener('touchcancel', onTouchEnd);
    }

    thumb.addEventListener('mousedown', startDrag);
    thumb.addEventListener('touchstart', startDrag, { passive: false });

    function readValueFromState(state) {
      if (!state) return null;
      var raw;
      if (valueAttr && state.attributes && state.attributes[valueAttr] !== undefined && state.attributes[valueAttr] !== null) {
        raw = state.attributes[valueAttr];
      } else {
        raw = state.state;
      }
      var n = parseFloat(raw);
      if (isNaN(n)) return null;
      return roundToStep(n);
    }

    function shouldUseLiveMediaProgress(state) {
      if (w.live_progress === false) return false;
      if (valueAttr !== 'media_position') return false;
      if (!state || !state.attributes) return false;
      if (state.attributes.media_position === undefined || state.attributes.media_position === null) return false;
      return true;
    }

    function computeLiveMediaPosition(state) {
      if (!shouldUseLiveMediaProgress(state)) return null;
      var attrs = state.attributes || {};
      var pos = parseFloat(attrs.media_position);
      if (isNaN(pos)) return null;

      var st = String(state.state || '').toLowerCase();
      if (st === 'playing') {
        var ts = attrs.media_position_updated_at || state.last_updated || state.last_changed;
        var baseMs = Date.parse(ts);
        if (isNaN(baseMs)) baseMs = Date.now();
        pos += Math.max(0, (Date.now() - baseMs) / 1000);
      }
      return roundToStep(pos);
    }

    function tickLiveProgress() {
      if (isDragging) return;
      var state = latestState || (w.entity ? entityStates[w.entity] : null);
      if (!state) return;
      if (!shouldUseLiveMediaProgress(state)) return;

      updateDynamicBounds(state);
      var next = computeLiveMediaPosition(state);
      if (next === null) return;
      currentValue = clampValue(next);
      applySliderVisual(currentValue, state);
    }

    if (w.entity) {
      registerEntityCallback(w.entity, function(state) {
        if (isDragging) return;
        latestState = state;
        updateDynamicBounds(state);
        var next = computeLiveMediaPosition(state);
        if (next === null) next = readValueFromState(state);
        if (next !== null) currentValue = next;
        else currentValue = clampValue(currentValue);
        applySliderVisual(currentValue, state);
      });
    }

    var initialState = w.entity ? entityStates[w.entity] : null;
    latestState = initialState;
    updateDynamicBounds(initialState);
    var initialValue = computeLiveMediaPosition(initialState);
    if (initialValue === null) initialValue = readValueFromState(initialState);
    if (initialValue !== null) currentValue = initialValue;
    else currentValue = clampValue(currentValue);
    applySliderVisual(currentValue, initialState);

    // Smooth playback progress between HA state_changed events for media players.
    if (w.entity && valueAttr === 'media_position' && w.live_progress !== false) {
      var liveTimer = setInterval(tickLiveProgress, 1000);
      activePageTimers.push({ id: liveTimer });
    }
  }

  // -- Switch --
  // Binary left/right toggle switch.
  // Required config: on_value, off_value.
  // Icon is rendered in the thumb via icon. Use overrides to change color/icon when on.
  function renderSwitch(el, w) {
    el.className += ' widget-switch';
    el.style.overflow = 'hidden';

    var track = document.createElement('div');
    track.className = 'switch-track';
    el.appendChild(track);

    var thumb = document.createElement('div');
    thumb.className = 'switch-thumb';
    var thumbIcon = document.createElement('span');
    thumbIcon.className = 'switch-icon switch-icon-thumb';
    thumb.appendChild(thumbIcon);
    el.appendChild(thumb);

    var labelEl = document.createElement('div');
    labelEl.className = 'switch-label';
    el.appendChild(labelEl);

    var latestState = null;
    var currentKnown = false;
    var currentIsOn = false;
    var hasRequiredValues = !(w.on_value === undefined || w.off_value === undefined);

    function normalizeSwitchIcon(icon) {
      if (icon === undefined || icon === null) return '';
      var str = String(icon);
      if (!str) return '';
      if (str.indexOf('[mdi:') === 0 || str.indexOf('[small:') === 0) return str;
      if (/^mdi:[\w-]+$/i.test(str)) return '[mdi:' + str.replace(/^mdi:/i, '') + ']';
      return str;
    }

    function readSwitchValue(state, attrName) {
      if (!state) return null;
      if (attrName && state.attributes && state.attributes[attrName] !== undefined && state.attributes[attrName] !== null) {
        return state.attributes[attrName];
      }
      if (state.state === undefined || state.state === null) return null;
      return state.state;
    }

    function resolveSwitchConfig(state) {
      var ovr = resolveOverrides(w, state) || {};
      var out = {
        on_value: (ovr.on_value !== undefined) ? ovr.on_value : w.on_value,
        off_value: (ovr.off_value !== undefined) ? ovr.off_value : w.off_value,
        value_attribute: (ovr.value_attribute !== undefined) ? ovr.value_attribute : w.value_attribute,
        color: (ovr.color !== undefined) ? ovr.color : (w.color !== undefined ? w.color : 'surface2'),
        thumb_color: (ovr.thumb_color !== undefined) ? ovr.thumb_color : (w.thumb_color !== undefined ? w.thumb_color : 'text'),
        icon: (ovr.icon !== undefined) ? ovr.icon : (w.icon !== undefined ? w.icon : ''),
        icon_color: (ovr.icon_color !== undefined) ? ovr.icon_color : (w.icon_color !== undefined ? w.icon_color : 'text_muted'),
        icon_scale: (ovr.icon_scale !== undefined) ? ovr.icon_scale : w.icon_scale,
        label_size: (ovr.label_size !== undefined) ? ovr.label_size : w.label_size,
        radius: (ovr.radius !== undefined) ? ovr.radius : w.radius,
        thumb_radius: (ovr.thumb_radius !== undefined) ? ovr.thumb_radius : w.thumb_radius,
        padding: (ovr.padding !== undefined) ? ovr.padding : w.padding,
        label: (ovr.label !== undefined) ? ovr.label : w.label,
        label_color: (ovr.label_color !== undefined) ? ovr.label_color : (w.label_color !== undefined ? w.label_color : 'text_muted'),
        opacity: (ovr.opacity !== undefined) ? ovr.opacity : w.opacity,
        locked: (ovr.locked !== undefined) ? !!ovr.locked : !!w.locked
      };
      return out;
    }

    function evaluateSwitchState(state, cfg) {
      var raw = readSwitchValue(state, cfg.value_attribute);
      if (raw === null || raw === undefined) return { known: false, isOn: false, raw: raw };
      var rawStr = String(raw);
      var onStr = String(cfg.on_value);
      var offStr = String(cfg.off_value);
      if (rawStr === onStr) return { known: true, isOn: true, raw: raw };
      if (rawStr === offStr) return { known: true, isOn: false, raw: raw };
      return { known: false, isOn: false, raw: raw };
    }

    function applySwitchVisual(isOn, known, cfg, state) {
      var width = Math.max(10, w.w);
      var height = Math.max(10, w.h);
      var pad = parseFloat(cfg.padding);
      if (isNaN(pad)) pad = 3;
      if (pad < 0) pad = 0;
      if (pad > Math.floor(height / 3)) pad = Math.floor(height / 3);

      var radius = parseFloat(cfg.radius);
      if (isNaN(radius)) radius = Math.round(height / 2);

      var thumbSize = height - (pad * 2);
      var maxThumb = Math.max(8, width - (pad * 2));
      if (thumbSize > maxThumb) thumbSize = maxThumb;
      if (thumbSize < 8) thumbSize = 8;
      var travel = Math.max(0, width - (pad * 2) - thumbSize);
      var thumbLeft = pad + (isOn ? travel : 0);

      var iconScale = (cfg.icon_scale !== undefined) ? parseFloat(cfg.icon_scale) : 1;
      if (isNaN(iconScale) || iconScale <= 0) iconScale = 1;
      if (iconScale > 2) iconScale = 2;
      var iconSize = Math.round(thumbSize * 0.52 * iconScale);
      if (iconSize < 8) iconSize = 8;

      var icon = normalizeSwitchIcon(cfg.icon);

      el.style.borderRadius = radius + 'px';
      track.style.borderRadius = radius + 'px';
      track.style.background = resolveColor(cfg.color);
      track.style.opacity = known ? '1' : '0.7';

      thumb.style.width = thumbSize + 'px';
      thumb.style.height = thumbSize + 'px';
      thumb.style.left = thumbLeft + 'px';
      thumb.style.top = pad + 'px';
      var thumbRadius = cfg.thumb_radius !== undefined ? parseFloat(cfg.thumb_radius) : Math.round(thumbSize / 2);
      if (isNaN(thumbRadius)) thumbRadius = Math.round(thumbSize / 2);
      if (thumbRadius < 0) thumbRadius = 0;
      thumb.style.borderRadius = thumbRadius + 'px';
      thumb.style.background = resolveColor(cfg.thumb_color);
      thumb.style.opacity = known ? '1' : '0.9';

      thumbIcon.style.fontSize = iconSize + 'px';
      thumbIcon.style.color = resolveColor(cfg.icon_color);

      if (icon) {
        thumbIcon.style.display = 'inline-flex';
        setContent(thumbIcon, icon);
      } else {
        thumbIcon.style.display = 'none';
        thumbIcon.textContent = '';
      }

      var labelText = (cfg.label !== undefined && cfg.label !== null) ? String(cfg.label) : '';
      if (labelText) {
        var labelSize = cfg.label_size !== undefined ? parseFloat(cfg.label_size) : Math.round(height * 0.34);
        if (isNaN(labelSize) || labelSize < 9) labelSize = 9;
        labelEl.style.display = 'flex';
        labelEl.style.fontSize = labelSize + 'px';
        labelEl.style.color = resolveColor(cfg.label_color);
        setContent(labelEl, applyTemplate(labelText, state));
      } else {
        labelEl.style.display = 'none';
        labelEl.textContent = '';
      }

      if (cfg.opacity !== undefined) el.style.opacity = cfg.opacity;
      else if (w.opacity !== undefined) el.style.opacity = w.opacity;

      el.style.cursor = cfg.locked ? 'not-allowed' : 'pointer';

      el.classList.remove('switch-on', 'switch-off', 'switch-unknown');
      if (!known) el.classList.add('switch-unknown');
      else if (isOn) el.classList.add('switch-on');
      else el.classList.add('switch-off');
    }

    function renderMissingConfig() {
      el.style.background = 'rgba(217,83,79,0.14)';
      el.style.border = '1px solid ' + resolveColor('danger');
      el.style.borderRadius = (w.radius !== undefined ? w.radius : Math.round(w.h / 2)) + 'px';
      track.style.display = 'none';
      thumb.style.display = 'none';
      labelEl.style.display = 'block';
      labelEl.style.color = resolveColor('danger');
      labelEl.style.fontSize = '11px';
      labelEl.style.textAlign = 'center';
      labelEl.style.padding = '0 6px';
      labelEl.style.whiteSpace = 'normal';
      labelEl.style.lineHeight = '1.2';
      labelEl.textContent = 'Switch needs on_value/off_value';
    }

    function applyFromState(state) {
      var cfg = resolveSwitchConfig(state);
      var st = evaluateSwitchState(state, cfg);
      currentKnown = st.known;
      currentIsOn = st.isOn;
      applySwitchVisual(st.isOn, st.known, cfg, state);
    }

    function getDefaultAction() {
      if (!w.entity) return null;
      return { type: 'service', service: 'homeassistant.toggle', entity_id: w.entity };
    }

    function onSwitchTap() {
      if (!hasRequiredValues) return;
      var cfg = resolveSwitchConfig(latestState);
      if (cfg.locked) return;
      var nextIsOn = currentKnown ? !currentIsOn : true;
      var nextValue = nextIsOn ? cfg.on_value : cfg.off_value;
      var action = w.action || getDefaultAction();
      if (!action) return;

      if (w.optimistic !== false) {
        currentKnown = true;
        currentIsOn = nextIsOn;
        applySwitchVisual(nextIsOn, true, cfg, latestState);
      }

      handleAction(action, nextValue, {
        '$on_value': cfg.on_value,
        '$off_value': cfg.off_value,
        '$is_on': nextIsOn ? 'true' : 'false'
      });
      resetReturnTimer();
    }

    if (!hasRequiredValues) {
      renderMissingConfig();
      return;
    }

    var initialCfg = resolveSwitchConfig(null);
    applySwitchVisual(false, false, initialCfg, null);

    if (w.entity) {
      registerEntityCallback(w.entity, function(state) {
        latestState = state;
        applyFromState(state);
      });

      if (entityStates[w.entity]) {
        latestState = entityStates[w.entity];
        applyFromState(latestState);
      }
    }

    if (w.action || w.entity) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', onSwitchTap);
      el.addEventListener('mousedown', function() {
        var cfg = resolveSwitchConfig(latestState);
        if (cfg.locked) return;
        el.style.opacity = '0.82';
      });
      el.addEventListener('mouseup', function() {
        var cfg = resolveSwitchConfig(latestState);
        if (cfg.opacity !== undefined) el.style.opacity = cfg.opacity;
        else if (w.opacity !== undefined) el.style.opacity = w.opacity;
        else el.style.opacity = '1';
      });
      el.addEventListener('mouseleave', function() {
        var cfg = resolveSwitchConfig(latestState);
        if (cfg.opacity !== undefined) el.style.opacity = cfg.opacity;
        else if (w.opacity !== undefined) el.style.opacity = w.opacity;
        else el.style.opacity = '1';
      });
      el.addEventListener('touchstart', function() {
        var cfg = resolveSwitchConfig(latestState);
        if (cfg.locked) return;
        el.style.opacity = '0.82';
      }, { passive: true });
      el.addEventListener('touchend', function() {
        var cfg = resolveSwitchConfig(latestState);
        if (cfg.opacity !== undefined) el.style.opacity = cfg.opacity;
        else if (w.opacity !== undefined) el.style.opacity = w.opacity;
        else el.style.opacity = '1';
      });
    }
  }

  // -- Scene --
  // Generic option selector bound to an entity state/attribute.
  // v1 supports static options with three layouts:
  //   buttons  - visible chips/buttons
  //   dropdown - native select
  //   picker   - single button that opens a small modal picker
  //
  // Action token:
  //   "$option" is replaced with the selected option value at call time.
  function renderScene(el, w) {
    el.className += ' widget-scene';

    var layout = String(w.layout || 'buttons').toLowerCase();
    if (layout !== 'dropdown' && layout !== 'picker') layout = 'buttons';
    var valueAttr = w.value_attribute;

    el.style.background = resolveColor(w.background || 'transparent');
    el.style.borderRadius = (w.radius !== undefined ? w.radius : 8) + 'px';
    el.style.overflow = 'hidden';
    if (w.opacity !== undefined) el.style.opacity = w.opacity;

    var options = normalizeSceneOptions(w.options);
    var currentValue = null;
    var sceneLocked = !!w.locked;
    var controls = [];
    var pickerButton = null;
    var pickerClose = null;

    function normalizeSceneOptions(raw) {
      var out = [];
      if (!raw || Object.prototype.toString.call(raw) !== '[object Array]') return out;
      for (var i = 0; i < raw.length; i++) {
        var it = raw[i];
        if (it === null || it === undefined) continue;
        if (typeof it === 'string' || typeof it === 'number' || typeof it === 'boolean') {
          out.push({ value: String(it), label: String(it), icon: '' });
          continue;
        }
        if (typeof it === 'object') {
          var v = (it.value !== undefined && it.value !== null) ? String(it.value) : '';
          if (!v) continue;
          out.push({
            value: v,
            label: (it.label !== undefined && it.label !== null) ? String(it.label) : v,
            icon: (it.icon !== undefined && it.icon !== null) ? String(it.icon) : ''
          });
        }
      }
      return out;
    }

    function readSceneValue(state) {
      if (!state) return null;
      var raw;
      if (valueAttr && state.attributes && state.attributes[valueAttr] !== undefined && state.attributes[valueAttr] !== null) {
        raw = state.attributes[valueAttr];
      } else {
        raw = state.state;
      }
      if (raw === undefined || raw === null) return null;
      return String(raw);
    }

    function findOptionByValue(value) {
      var v = value === null || value === undefined ? '' : String(value);
      for (var i = 0; i < options.length; i++) {
        if (String(options[i].value) === v) return options[i];
      }
      return null;
    }

    function optionText(opt) {
      if (!opt) return '';
      if (opt.icon && opt.label) return opt.icon + ' ' + opt.label;
      if (opt.icon) return opt.icon;
      return opt.label;
    }

    function applySceneStyle() {
      var state = w.entity ? entityStates[w.entity] : null;
      var ovr = resolveOverrides(w, state) || {};
      var bg = (ovr.background !== undefined) ? ovr.background : (w.background || 'transparent');
      sceneLocked = (ovr.locked !== undefined) ? !!ovr.locked : !!w.locked;
      el.style.background = resolveColor(bg);
      el.style.cursor = sceneLocked ? 'not-allowed' : 'default';
      if (ovr.opacity !== undefined) el.style.opacity = ovr.opacity;
      else if (w.opacity !== undefined) el.style.opacity = w.opacity;
    }

    function optionVisual(button, isActive) {
      var activeBg = resolveColor(w.selected_background || 'primary');
      var activeFg = resolveColor(w.selected_color || 'background');
      var bg = resolveColor(w.option_background || 'surface2');
      var fg = resolveColor(w.option_color || 'text');
      button.style.background = isActive ? activeBg : bg;
      button.style.color = isActive ? activeFg : fg;
    }

    function updateControls() {
      applySceneStyle();
      for (var i = 0; i < controls.length; i++) {
        var c = controls[i];
        if (c.kind === 'button') {
          optionVisual(c.el, String(c.option.value) === String(currentValue));
          c.el.disabled = sceneLocked;
          c.el.style.cursor = sceneLocked ? 'not-allowed' : 'pointer';
          c.el.style.opacity = sceneLocked ? '0.6' : '1';
        } else if (c.kind === 'select') {
          c.el.value = currentValue !== null && currentValue !== undefined ? String(currentValue) : '';
          c.el.disabled = sceneLocked;
          c.el.style.cursor = sceneLocked ? 'not-allowed' : 'pointer';
          c.el.style.opacity = sceneLocked ? '0.65' : '1';
        }
      }
      if (pickerButton) {
        var opt = findOptionByValue(currentValue);
        setContent(pickerButton, opt ? optionText(opt) : (w.placeholder || 'Select'));
        pickerButton.disabled = sceneLocked;
        pickerButton.style.cursor = sceneLocked ? 'not-allowed' : 'pointer';
        pickerButton.style.opacity = sceneLocked ? '0.65' : '1';
      }
    }

    function selectOption(value) {
      if (sceneLocked) return;
      var selected = String(value);
      if (w.action) {
        // Always send the clicked option directly to avoid any stale-value races.
        handleAction(w.action, undefined, { '$option': selected });
      }
      currentValue = selected;
      updateControls();
      resetReturnTimer();
    }

    function buildButtons() {
      var wrap = document.createElement('div');
      wrap.style.position = 'absolute';
      wrap.style.left = '0';
      wrap.style.top = '0';
      wrap.style.right = '0';
      wrap.style.bottom = '0';
      wrap.style.display = 'flex';
      wrap.style.flexWrap = 'wrap';
      wrap.style.alignItems = 'center';
      wrap.style.justifyContent = 'center';
      wrap.style.padding = (w.padding !== undefined ? w.padding : 6) + 'px';
      el.appendChild(wrap);

      for (var i = 0; i < options.length; i++) {
        (function(opt) {
          var b = document.createElement('button');
          b.type = 'button';
          b.style.border = 'none';
          b.style.borderRadius = (w.option_radius !== undefined ? w.option_radius : 18) + 'px';
          b.style.padding = (w.option_padding_y !== undefined ? w.option_padding_y : 8) + 'px ' +
                            (w.option_padding_x !== undefined ? w.option_padding_x : 12) + 'px';
          b.style.margin = (w.option_gap !== undefined ? w.option_gap : 4) + 'px';
          b.style.fontSize = (w.option_size !== undefined ? w.option_size : 14) + 'px';
          b.style.cursor = 'pointer';
          b.style.fontFamily = 'inherit';
          setContent(b, optionText(opt));
          b.addEventListener('click', function() { selectOption(opt.value); });
          wrap.appendChild(b);
          controls.push({ kind: 'button', el: b, option: opt });
        })(options[i]);
      }
    }

    function buildDropdown() {
      var select = document.createElement('select');
      select.style.position = 'absolute';
      select.style.left = (w.padding !== undefined ? w.padding : 6) + 'px';
      select.style.top = (w.padding !== undefined ? w.padding : 6) + 'px';
      select.style.width = Math.max(10, w.w - 2 * (w.padding !== undefined ? w.padding : 6)) + 'px';
      select.style.height = Math.max(10, w.h - 2 * (w.padding !== undefined ? w.padding : 6)) + 'px';
      select.style.border = 'none';
      select.style.borderRadius = (w.option_radius !== undefined ? w.option_radius : 8) + 'px';
      select.style.background = resolveColor(w.option_background || 'surface2');
      select.style.color = resolveColor(w.option_color || 'text');
      select.style.fontSize = (w.option_size !== undefined ? w.option_size : 16) + 'px';
      select.style.padding = '0 8px';
      select.style.fontFamily = 'inherit';
      for (var i = 0; i < options.length; i++) {
        var opt = document.createElement('option');
        opt.value = options[i].value;
        opt.textContent = options[i].label;
        select.appendChild(opt);
      }
      select.addEventListener('change', function() { selectOption(select.value); });
      el.appendChild(select);
      controls.push({ kind: 'select', el: select });
    }

    function buildPicker() {
      pickerButton = document.createElement('button');
      pickerButton.type = 'button';
      pickerButton.style.position = 'absolute';
      pickerButton.style.left = (w.padding !== undefined ? w.padding : 6) + 'px';
      pickerButton.style.top = (w.padding !== undefined ? w.padding : 6) + 'px';
      pickerButton.style.width = Math.max(10, w.w - 2 * (w.padding !== undefined ? w.padding : 6)) + 'px';
      pickerButton.style.height = Math.max(10, w.h - 2 * (w.padding !== undefined ? w.padding : 6)) + 'px';
      pickerButton.style.border = 'none';
      pickerButton.style.borderRadius = (w.option_radius !== undefined ? w.option_radius : 20) + 'px';
      pickerButton.style.background = resolveColor(w.option_background || 'surface2');
      pickerButton.style.color = resolveColor(w.option_color || 'text');
      pickerButton.style.fontSize = (w.option_size !== undefined ? w.option_size : 16) + 'px';
      pickerButton.style.cursor = 'pointer';
      pickerButton.style.fontFamily = 'inherit';
      pickerButton.addEventListener('click', function() { openPickerModal(); });
      el.appendChild(pickerButton);
    }

    function openPickerModal() {
      if (sceneLocked) return;
      if (pickerClose) return;
      var overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.left = '0';
      overlay.style.top = '0';
      overlay.style.right = '0';
      overlay.style.bottom = '0';
      overlay.style.background = 'rgba(0,0,0,0.25)';
      overlay.style.zIndex = '10001';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';

      var card = document.createElement('div');
      card.style.minWidth = '220px';
      card.style.maxWidth = '70vw';
      card.style.background = resolveColor(w.option_panel_background || 'surface');
      card.style.borderRadius = (w.option_panel_radius !== undefined ? w.option_panel_radius : 12) + 'px';
      card.style.padding = '10px';
      card.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)';
      overlay.appendChild(card);

      for (var i = 0; i < options.length; i++) {
        (function(opt) {
          var item = document.createElement('button');
          item.type = 'button';
          item.style.width = '100%';
          item.style.border = 'none';
          item.style.borderRadius = (w.option_radius !== undefined ? w.option_radius : 10) + 'px';
          item.style.padding = '10px 12px';
          item.style.marginBottom = '6px';
          item.style.fontSize = (w.option_size !== undefined ? w.option_size : 15) + 'px';
          item.style.cursor = 'pointer';
          item.style.fontFamily = 'inherit';
          setContent(item, optionText(opt));
          optionVisual(item, String(opt.value) === String(currentValue));
          item.addEventListener('click', function() {
            selectOption(opt.value);
            closePickerModal();
          });
          card.appendChild(item);
        })(options[i]);
      }
      if (card.lastChild) card.lastChild.style.marginBottom = '0';

      function closePickerModal() {
        if (!overlay || !overlay.parentNode) return;
        overlay.parentNode.removeChild(overlay);
        pickerClose = null;
      }

      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closePickerModal();
      });
      pickerClose = closePickerModal;
      document.body.appendChild(overlay);
      resetReturnTimer();
    }

    if (!options.length) {
      var msg = document.createElement('div');
      msg.style.position = 'absolute';
      msg.style.left = '8px';
      msg.style.top = '8px';
      msg.style.color = resolveColor('text_muted');
      msg.style.fontSize = '12px';
      msg.textContent = 'No options';
      el.appendChild(msg);
      return;
    }

    if (layout === 'dropdown') buildDropdown();
    else if (layout === 'picker') buildPicker();
    else buildButtons();

    if (w.entity) {
      registerEntityCallback(w.entity, function(state) {
        currentValue = readSceneValue(state);
        updateControls();
      });
    }

    var initial = w.entity ? entityStates[w.entity] : null;
    currentValue = readSceneValue(initial);
    if (currentValue === null || currentValue === undefined) {
      currentValue = options.length ? String(options[0].value) : null;
    }
    updateControls();
  }

  // thresholds: first matching rule wins.
  // Raw entity value is used for comparisons (no hidden percent conversion).
  function getThresholdColor(w, rawValue, fallbackColor) {
    if (!w || !w.thresholds || !w.thresholds.length) return fallbackColor;
    var defaultColor;
    for (var i = 0; i < w.thresholds.length; i++) {
      var t = w.thresholds[i];
      if (!t) continue;

      if (t.default && t.color !== undefined && defaultColor === undefined) {
        defaultColor = t.color;
        continue;
      }

      if (t.below !== undefined) {
        var below = parseFloat(t.below);
        if (!isNaN(below) && rawValue < below && t.color !== undefined) return t.color;
        continue;
      }

      if (t.above !== undefined) {
        var above = parseFloat(t.above);
        if (!isNaN(above) && rawValue > above && t.color !== undefined) return t.color;
        continue;
      }

      if (t.equals !== undefined) {
        if (String(rawValue) === String(t.equals) && t.color !== undefined) return t.color;
      }
    }
    return (defaultColor !== undefined) ? defaultColor : fallbackColor;
  }

  // -- Button --
  function renderButton(el, w) {
    el.className += ' widget-button';

    var iconEl  = document.createElement('div');
    var labelEl = document.createElement('div');
    var buttonLocked = !!w.locked;
    iconEl.className  = 'btn-icon';
    labelEl.className = 'btn-label';

    if (w.radius !== undefined) {
      el.style.borderRadius = w.radius + 'px';
    }

    if (w.gap !== undefined) {
      el.style.gap = w.gap + 'px';
    }
    if (w.padding !== undefined) {
      el.style.padding = w.padding + 'px';
    }

    var hasIcon = !!(w.icon || w.icon_off || w.icon_on);
    var hasLabel = (w.label !== undefined && w.label !== null && String(w.label).length > 0);
    var baseIcon = (w.icon !== undefined && w.icon !== null) ? w.icon
      : ((w.icon_off !== undefined && w.icon_off !== null) ? w.icon_off : w.icon_on);

    // Dynamic sizing based on button size (override with icon_size / label_size)
    var base = Math.min(w.w, w.h);
    var iconSize;
    var labelSize;
    if (w.icon_size !== undefined) {
      iconSize = w.icon_size;
    } else if (hasIcon && hasLabel) {
      iconSize = Math.round(base * 0.42);
    } else if (hasIcon) {
      iconSize = Math.round(base * 0.60);
    }

    if (w.label_size !== undefined) {
      labelSize = w.label_size;
    } else if (hasIcon && hasLabel) {
      labelSize = Math.round(base * 0.14);
    } else if (hasLabel) {
      labelSize = Math.round(base * 0.20);
    }

    if (!hasIcon) {
      iconEl.style.display = 'none';
    } else if (iconSize) {
      iconEl.style.fontSize = iconSize + 'px';
    }

    if (!hasLabel) {
      labelEl.style.display = 'none';
    } else if (labelSize) {
      labelEl.style.fontSize = labelSize + 'px';
    }

    // setButtonIcon resolves [fa-name] tokens or raw FA codepoints
    function setButtonIcon(icon) {
      setContent(iconEl, icon || '');
    }

    function setButtonLabel(text, state) {
      var t = (text !== undefined && text !== null) ? String(text) : '';
      t = applyTemplate(t, state);
      setContent(labelEl, t);
    }

    setButtonIcon(baseIcon || '');
    setButtonLabel(w.label || '', null);

    el.appendChild(iconEl);
    el.appendChild(labelEl);

    // Apply base styles (overrides applied on first state update)
    el.style.background = resolveColor(w.background || 'surface2');
    iconEl.style.color  = resolveColor(w.icon_color  || 'text');
    labelEl.style.color = resolveColor(w.label_color || 'text_dim');

    function applyButtonLockState(locked) {
      buttonLocked = !!locked;
      if (buttonLocked) {
        el.style.cursor = 'not-allowed';
      } else if (w.action) {
        el.style.cursor = 'pointer';
      } else {
        el.style.cursor = 'default';
      }
    }

    applyButtonLockState(buttonLocked);

    if (w.entity) {
      registerEntityCallback(w.entity, function (state) {
        var ovr = resolveOverrides(w, state) || {};
        applyButtonLockState((ovr.locked !== undefined) ? !!ovr.locked : !!w.locked);
        el.style.background = resolveColor(ovr.background !== undefined ? ovr.background : (w.background || 'surface2'));
        iconEl.style.color  = resolveColor(ovr.icon_color  !== undefined ? ovr.icon_color  : (w.icon_color  || 'text'));
        labelEl.style.color = resolveColor(ovr.label_color !== undefined ? ovr.label_color : (w.label_color || 'text_dim'));
        if (ovr.opacity      !== undefined) el.style.opacity     = ovr.opacity;
        if (ovr.border_color !== undefined) el.style.borderColor = resolveColor(ovr.border_color);
        if (ovr.border_width !== undefined) {
          el.style.borderWidth = ovr.border_width + 'px';
          el.style.borderStyle = 'solid';
          el.style.boxSizing   = 'border-box';
        }
        var icon = (ovr.icon !== undefined) ? ovr.icon : (baseIcon || '');
        setButtonIcon(icon);
        var labelText = (ovr.label !== undefined) ? ovr.label : (w.label || '');
        setButtonLabel(labelText, state);
      });
    }

    if (w.action) {
      el.addEventListener('click', function () {
        if (buttonLocked) return;
        handleAction(w.action);
        resetReturnTimer();
      });
      el.addEventListener('mousedown',  function() { if (!buttonLocked) el.style.opacity = '0.75'; });
      el.addEventListener('mouseup',    function() { el.style.opacity = '1'; });
      el.addEventListener('mouseleave', function() { el.style.opacity = '1'; });
      el.addEventListener('touchstart', function() { if (!buttonLocked) el.style.opacity = '0.75'; }, { passive: true });
      el.addEventListener('touchend',   function() { el.style.opacity = '1'; });
    }
  }

  // ---- Arc / gauge widget ----------------------------------
  // SVG-based circular arc gauge. Driven by a numeric HA entity.
  //
  // Config:
  //   entity        - HA entity providing the numeric value
  //   value_attribute - optional entity attribute to read value from (falls back to state)
  //   marker_value_attribute - optional second value shown as marker on the arc
  //   marker_color  - marker color (default text)
  //   marker_size   - marker size in px (dot diameter / tick length, default based on line_width)
  //   marker_style  - "dot" (default) or "tick"
  //   min           - value at start of arc (default 0)
  //   max           - value at end of arc (default 100)
  //   start_angle   - degrees, 0 = top, clockwise (default 135)
  //   end_angle     - degrees (default 405, i.e. 135 + 270)
  //   line_width    - arc stroke width in px (default 12)
  //   background    - background arc ring color (default surface2 token)
  //   label         - static text shown below the value (optional)
  //   format        - value format (same as label widget)
  //   color         - arc fill color (theme token or hex; use overrides for state-based colors)
  //   overrides     - conditional overrides (color, opacity, label, label_color, background)
  //
  // Example:
  //   { "type": "arc", "x": 100, "y": 100, "w": 160, "h": 160,
  //     "entity": "sensor.battery_state_of_charge",
  //     "min": 0, "max": 100,
  //     "start_angle": 135, "end_angle": 405,
  //     "line_width": 14,
  //     "color": "primary",
  //     "label": "Battery" }

  function renderArc(el, w) {
    el.className += ' widget-arc';
    el.style.overflow = 'visible';

    var min        = w.min !== undefined ? w.min : 0;
    var max        = w.max !== undefined ? w.max : 100;
    var valueAttr  = w.value_attribute;
    var startAngle = w.start_angle !== undefined ? w.start_angle : 135;
    var endAngle   = w.end_angle   !== undefined ? w.end_angle   : 405;
    var lineWidth  = w.line_width  !== undefined ? w.line_width  : 12;
    var trackColor = resolveColor(w.background || 'surface2');

    // SVG coordinate system: cx/cy at centre, r fits inside widget
    var size = Math.min(w.w, w.h);
    var cx   = w.w / 2;
    var cy   = w.h / 2;
    var r    = (size / 2) - (lineWidth / 2) - 2;

    var ns  = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width',  w.w);
    svg.setAttribute('height', w.h);
    svg.style.position = 'absolute';
    svg.style.top      = '0';
    svg.style.left     = '0';
    svg.style.overflow = 'visible';

    // Track arc (full background arc)
    var trackPath = document.createElementNS(ns, 'path');
    trackPath.setAttribute('fill',         'none');
    trackPath.setAttribute('stroke',       trackColor);
    trackPath.setAttribute('stroke-width', lineWidth);
    trackPath.setAttribute('stroke-linecap', 'round');
    trackPath.setAttribute('d', describeArc(cx, cy, r, startAngle, endAngle));
    svg.appendChild(trackPath);

    // Value arc (filled portion)
    var valuePath = document.createElementNS(ns, 'path');
    valuePath.setAttribute('fill',         'none');
    valuePath.setAttribute('stroke-width', lineWidth);
    valuePath.setAttribute('stroke-linecap', 'round');
    svg.appendChild(valuePath);

    var markerDot = document.createElementNS(ns, 'circle');
    markerDot.setAttribute('r', 0);
    markerDot.style.display = 'none';
    svg.appendChild(markerDot);

    var markerTick = document.createElementNS(ns, 'path');
    markerTick.setAttribute('fill', 'none');
    markerTick.setAttribute('stroke-linecap', 'round');
    markerTick.style.display = 'none';
    svg.appendChild(markerTick);

    el.appendChild(svg);

    // Centre value label
    var valueEl = document.createElement('div');
    valueEl.style.cssText = [
      'position:absolute',
      'top:0', 'left:0',
      'width:' + w.w + 'px',
      'height:' + w.h + 'px',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'pointer-events:none'
    ].join(';');

    var numEl = document.createElement('div');
    numEl.style.cssText = 'font-size:' + Math.round(size * 0.22) + 'px;font-weight:600;line-height:1;color:' + resolveColor(w.color || 'text') + ';';
    numEl.textContent = '--';
    valueEl.appendChild(numEl);

    var lblEl = null;
    if (w.label) {
      lblEl = document.createElement('div');
      lblEl.style.cssText = 'font-size:' + Math.round(size * 0.11) + 'px;margin-top:4px;color:' + resolveColor(w.label_color || 'text_muted') + ';';
      setContent(lblEl, w.label);
      valueEl.appendChild(lblEl);
    }

    el.appendChild(valueEl);

    function readArcValue(state, attrName) {
      if (!state) return null;
      var raw;
      if (attrName && state.attributes && state.attributes[attrName] !== undefined && state.attributes[attrName] !== null) {
        raw = state.attributes[attrName];
      } else {
        raw = state.state;
      }
      if (raw === undefined || raw === null) return null;
      return raw;
    }

    // Update function - called on entity state change
    function updateArc(state, state2) {
      if (!state) return;
      var s = resolveOverrides(w, state, state2) || {};
      var rawValue = readArcValue(state, valueAttr);
      if (rawValue === null) { setContent(numEl, '--'); valuePath.setAttribute('d', ''); return; }
      var raw = parseFloat(rawValue);
      if (isNaN(raw)) { setContent(numEl, String(rawValue)); valuePath.setAttribute('d', ''); return; }

      var val     = Math.max(min, Math.min(max, raw));
      var spanVal = (max - min);
      if (spanVal === 0) spanVal = 1;
      var pct     = (val - min) / spanVal;
      var fillEnd = startAngle + pct * (endAngle - startAngle);

      var thresholdColor = getThresholdColor(w, raw, (w.color || 'primary'));
      var arcColor = resolveColor(s.color !== undefined ? s.color : thresholdColor);

      valuePath.setAttribute('stroke', arcColor);
      if (pct <= 0) {
        valuePath.setAttribute('d', '');
      } else if (pct >= 1) {
        // Full arc - draw as track to avoid path calculation edge case
        valuePath.setAttribute('d', describeArc(cx, cy, r, startAngle, endAngle - 0.01));
      } else {
        valuePath.setAttribute('d', describeArc(cx, cy, r, startAngle, fillEnd));
      }

      setContent(numEl, formatValue(rawValue, w));
      numEl.style.color = arcColor;

      var markerAttr = (s.marker_value_attribute !== undefined) ? s.marker_value_attribute : w.marker_value_attribute;
      var markerRaw = readArcValue(state, markerAttr);
      var markerNum = parseFloat(markerRaw);
      var markerStyle = String((s.marker_style !== undefined) ? s.marker_style : (w.marker_style || 'dot')).toLowerCase();
      if (markerStyle !== 'tick') markerStyle = 'dot';
      var markerColor = resolveColor((s.marker_color !== undefined) ? s.marker_color : (w.marker_color || 'text'));
      var markerSize = parseFloat((s.marker_size !== undefined) ? s.marker_size : (w.marker_size !== undefined ? w.marker_size : Math.max(8, Math.round(lineWidth * 0.9))));
      if (isNaN(markerSize) || markerSize <= 0) markerSize = Math.max(8, Math.round(lineWidth * 0.9));

      if (markerAttr && !isNaN(markerNum)) {
        var mVal = Math.max(min, Math.min(max, markerNum));
        var mPct = (mVal - min) / spanVal;
        var mAng = startAngle + mPct * (endAngle - startAngle);
        if (markerStyle === 'tick') {
          var halfLen = markerSize / 2;
          var p1 = polarToCartesian(cx, cy, r - halfLen, mAng);
          var p2 = polarToCartesian(cx, cy, r + halfLen, mAng);
          markerTick.setAttribute('d', 'M ' + p1.x + ' ' + p1.y + ' L ' + p2.x + ' ' + p2.y);
          markerTick.setAttribute('stroke', markerColor);
          markerTick.setAttribute('stroke-width', Math.max(2, Math.round(lineWidth * 0.22)));
          markerTick.style.display = '';
          markerDot.style.display = 'none';
        } else {
          var mp = polarToCartesian(cx, cy, r, mAng);
          markerDot.setAttribute('cx', mp.x);
          markerDot.setAttribute('cy', mp.y);
          markerDot.setAttribute('r', Math.max(2, markerSize / 2));
          markerDot.setAttribute('fill', markerColor);
          markerDot.style.display = '';
          markerTick.style.display = 'none';
        }
      } else {
        markerDot.style.display = 'none';
        markerTick.style.display = 'none';
      }

      // Apply remaining overrideable properties
      var tColor = s.background !== undefined ? s.background : (w.background || 'surface2');
      trackPath.setAttribute('stroke', resolveColor(tColor));
      if (s.opacity !== undefined) el.style.opacity = s.opacity;
      else if (w.opacity !== undefined) el.style.opacity = w.opacity;
      if (lblEl) {
        setContent(lblEl, s.label !== undefined ? String(s.label) : (w.label || ''));
        lblEl.style.color = resolveColor(s.label_color !== undefined ? s.label_color : (w.label_color || 'text_muted'));
      }
    }

    if (w.entity || w.entity2) {
      var arcStateCache  = w.entity  ? (entityStates[w.entity]  || null) : null;
      var arcState2Cache = w.entity2 ? (entityStates[w.entity2] || null) : null;

      function doArcUpdate() {
        updateArc(arcStateCache, arcState2Cache);
      }

      if (w.entity)  registerEntityCallback(w.entity,  function(s) { arcStateCache  = s; doArcUpdate(); });
      if (w.entity2) registerEntityCallback(w.entity2, function(s) { arcState2Cache = s; doArcUpdate(); });

      // Apply cached state immediately (handles page nav after WS already connected)
      if (arcStateCache) doArcUpdate();
    }
  }

  // Convert polar angle (degrees, 0=top, clockwise) to SVG arc path
  function describeArc(cx, cy, r, startDeg, endDeg) {
    var start = polarToCartesian(cx, cy, r, startDeg);
    var end   = polarToCartesian(cx, cy, r, endDeg);
    var span  = endDeg - startDeg;
    // Normalise span to handle wrap-around
    while (span < 0)   span += 360;
    while (span > 360) span -= 360;
    var large = span > 180 ? 1 : 0;
    return [
      'M', start.x, start.y,
      'A', r, r, 0, large, 1, end.x, end.y
    ].join(' ');
  }

  function polarToCartesian(cx, cy, r, angleDeg) {
    // Offset by -90 so 0 degrees = top, then add offset
    var rad = (angleDeg - 90) * Math.PI / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad)
    };
  }

  // -- Image widget --
  // Displays a static or URL-sourced image. Optional fullscreen on tap.
  function renderImage(el, w) {
    el.className += ' widget-image';
    el.style.overflow     = 'hidden';
    var radiusPx = (w.radius !== undefined ? w.radius : 0) + 'px';
    el.style.borderRadius = radiusPx;
    el.style.background   = w.background ? resolveColor(w.background) : 'transparent';
    el.style.cursor       = w.fullscreen_on_tap ? 'pointer' : 'default';

    var img = document.createElement('img');
    img.style.width     = '100%';
    img.style.height    = '100%';
    img.style.objectFit = w.fit || 'cover';
    img.style.display   = 'block';
    var currentImageUrl = w.url || '';
    img.src = currentImageUrl;
    el.appendChild(img);

    var gradientEl = document.createElement('div');
    gradientEl.style.position = 'absolute';
    gradientEl.style.left = '0';
    gradientEl.style.top = '0';
    gradientEl.style.right = '0';
    gradientEl.style.bottom = '0';
    gradientEl.style.pointerEvents = 'none';
    gradientEl.style.borderRadius = radiusPx;
    gradientEl.style.display = 'none';
    el.appendChild(gradientEl);

    function applyImageGradient() {
      if (!w.gradient || typeof w.gradient !== 'object') {
        gradientEl.style.display = 'none';
        gradientEl.style.background = 'none';
        return;
      }
      var css = resolveLinearGradient(w.gradient);
      if (!css) {
        gradientEl.style.display = 'none';
        gradientEl.style.background = 'none';
        return;
      }
      gradientEl.style.display = 'block';
      gradientEl.style.background = css;
    }

    applyImageGradient();

    function normalizeImageUrl(raw) {
      if (!raw) return '';
      var u = String(raw);
      if (/^https?:\/\//i.test(u) || u.indexOf('data:') === 0 || u.indexOf('blob:') === 0) return u;
      if (u.charAt(0) === '/') return haUrl + u;
      return u;
    }

    function resolveUrl(state) {
      var ovr = (w.entity && state) ? (resolveOverrides(w, state) || {}) : {};
      if (ovr.url !== undefined) return normalizeImageUrl(String(ovr.url));
      var raw = w.url || '';
      return normalizeImageUrl(hasTemplate(raw) ? applyTemplate(raw, state) : raw);
    }

    function updateImageFromState(state) {
      var nextUrl;
      if (w.entity_attribute && state) {
        var attrs = state.attributes || {};
        var attrVal = attrs[w.entity_attribute];
        if (attrVal) {
          nextUrl = normalizeImageUrl(attrVal);
          // Avoid stale album-art cache when track changes but path is reused.
          var cacheKey = state.last_updated || state.last_changed || Date.now();
          nextUrl += (nextUrl.indexOf('?') !== -1 ? '&' : '?') + '_t=' + encodeURIComponent(cacheKey);
        }
      } else {
        nextUrl = resolveUrl(state);
      }
      if (nextUrl && nextUrl !== currentImageUrl) {
        currentImageUrl = nextUrl;
        img.src = currentImageUrl;
      }
    }

    // Apply template/overrides to initial url
    var initialUrl = resolveUrl(w.entity ? (entityStates[w.entity] || null) : null);
    if (initialUrl) { currentImageUrl = initialUrl; img.src = initialUrl; }

    if (w.entity) {
      registerEntityCallback(w.entity, function(state) {
        updateImageFromState(state);
      });
      if (entityStates[w.entity]) updateImageFromState(entityStates[w.entity]);
    }

    if (w.fullscreen_on_tap) {
      el.addEventListener('click', function() {
        openFullscreenImage(currentImageUrl || w.url || '', null);
      });
    }
  }

  // -- Agenda widget --
  // Basic upcoming calendar events list rendered from HA calendar/get_events.
  function renderAgenda(el, w) {
    el.className += ' widget-agenda';

    // Prefer agenda-specific key to avoid ambiguity with designer/stage scale concepts.
    var scaleRaw = (w.agenda_scale !== undefined) ? w.agenda_scale : w.scale;
    var scale = (scaleRaw !== undefined) ? parseFloat(scaleRaw) : 1;
    if (isNaN(scale) || scale <= 0) scale = 1;
    function s(px) {
      return Math.max(1, Math.round(px * scale));
    }

    var radius = s((w.radius !== undefined) ? w.radius : 12);
    var pad = s((w.padding !== undefined) ? w.padding : 10);
    var refreshSec = (w.refresh_interval !== undefined) ? parseInt(w.refresh_interval, 10) : 120;
    if (isNaN(refreshSec) || refreshSec < 15) refreshSec = 120;
    var daysAhead = (w.days_ahead !== undefined) ? parseInt(w.days_ahead, 10) : 7;
    if (isNaN(daysAhead) || daysAhead < 1) daysAhead = 7;
    var timeFormat = String(w.time_format || '12h').toLowerCase();
    var layout = String(w.layout || 'list').toLowerCase();
    if (layout !== 'columns') layout = 'list';
    var todayIndicator = (w.today_indicator === true);
    var showBlankDays = (w.show_blank_days === true);
    var calendars = (w.calendars && Object.prototype.toString.call(w.calendars) === '[object Array]') ? w.calendars : [];
    var showLegend = (w.legend === true);
    var selectedCalendarKey = null;
    var cachedEvents = [];
    var cachedRangeStart = null;
    var cachedRangeEnd = null;

    el.style.background = resolveColor(w.background || 'surface');
    el.style.borderRadius = radius + 'px';
    el.style.overflow = 'hidden';
    if (w.opacity !== undefined) el.style.opacity = w.opacity;

    var list = document.createElement('div');
    list.style.position = 'absolute';
    list.style.left = pad + 'px';
    list.style.top = pad + 'px';
    list.style.right = pad + 'px';
    list.style.bottom = pad + 'px';
    list.style.overflow = 'auto';
    list.style.webkitOverflowScrolling = 'touch';
    list.style.paddingRight = s(2) + 'px';
    el.appendChild(list);

    var fade = document.createElement('div');
    fade.style.position = 'absolute';
    fade.style.left = pad + 'px';
    fade.style.right = pad + 'px';
    fade.style.bottom = pad + 'px';
    fade.style.height = s(56) + 'px';
    fade.style.pointerEvents = 'none';
    fade.style.display = 'none';
    fade.style.background = 'linear-gradient(180deg, rgba(0,0,0,0), ' + resolveColor(w.background || 'surface') + ' 85%)';
    el.appendChild(fade);

    function updateOverflowFade() {
      var hasOverflow = (list.scrollHeight > (list.clientHeight + 1));
      if (!hasOverflow) {
        fade.style.display = 'none';
        return;
      }
      var atBottom = (list.scrollTop + list.clientHeight >= list.scrollHeight - 2);
      fade.style.display = atBottom ? 'none' : 'block';
    }
    list.addEventListener('scroll', updateOverflowFade);

    function setAgendaEmpty(text, monthDate) {
      list.innerHTML = '';
      if (showLegend && monthDate && w.show_month_headers !== false) {
        list.appendChild(renderMonthHeaderRow(getMonthHeader(monthDate), true, 0, s(8)));
      }
      var empty = document.createElement('div');
      empty.style.color = resolveColor(w.muted_color || 'text_muted');
      empty.style.fontSize = s((w.font_size || 15)) + 'px';
      empty.style.padding = s(8) + 'px ' + s(2) + 'px';
      empty.textContent = text;
      list.appendChild(empty);
      updateOverflowFade();
    }

    function parseEventDate(value) {
      if (!value) return null;
      if (Object.prototype.toString.call(value) === '[object Date]') return value;
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return new Date(value + 'T00:00:00');
      }
      var d = new Date(value);
      if (isNaN(d.getTime())) return null;
      return d;
    }

    function pad2(n) {
      return (n < 10 ? '0' : '') + n;
    }

    function formatClockTime(d) {
      var h = d.getHours();
      var m = d.getMinutes();
      if (timeFormat === '24h') return pad2(h) + ':' + pad2(m);
      var ampm = h >= 12 ? 'PM' : 'AM';
      var h12 = h % 12;
      if (h12 === 0) h12 = 12;
      return h12 + ':' + pad2(m) + ' ' + ampm;
    }

    function formatDateKey(d) {
      return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    }

    function startOfDay(d) {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    function addDays(d, n) {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
    }

    function getWeekdayShort(d) {
      var names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return names[d.getDay()];
    }

    function getWeekdayLong(d) {
      var names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return names[d.getDay()];
    }

    function getMonthHeader(d) {
      var months = [
        'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
        'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
      ];
      return months[d.getMonth()];
    }

    function titleCaseWords(str) {
      var inStr = String(str || '');
      var parts = inStr.split(/\s+/);
      var out = [];
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (!p) continue;
        out.push(p.charAt(0).toUpperCase() + p.slice(1));
      }
      return out.join(' ');
    }

    function getCalendarDisplayName(calCfg) {
      if (calCfg && calCfg.name !== undefined && calCfg.name !== null && String(calCfg.name).trim() !== '') {
        return String(calCfg.name).trim();
      }
      var entity = (calCfg && calCfg.entity) ? String(calCfg.entity) : '';
      var raw = entity.indexOf('.') !== -1 ? entity.split('.').slice(1).join('.') : entity;
      raw = raw.replace(/^m365calendar_/, '');
      raw = raw.replace(/^local_/, '');
      raw = raw.replace(/_/g, ' ').trim();
      if (!raw) return entity || 'Calendar';
      return titleCaseWords(raw);
    }

    function getLegendItems() {
      var items = [];
      var seen = {};
      for (var i = 0; i < calendars.length; i++) {
        var cfg = calendars[i];
        if (!cfg || !cfg.entity) continue;
        var key = String(cfg.entity);
        if (seen[key]) continue;
        seen[key] = true;
        items.push({
          key: key,
          name: getCalendarDisplayName(cfg),
          color: resolveColor(cfg.color || 'primary')
        });
      }
      return items;
    }

    function getFilteredEvents(events) {
      if (!selectedCalendarKey) return events;
      var out = [];
      for (var i = 0; i < events.length; i++) {
        if (events[i] && events[i].calendarKey === selectedCalendarKey) out.push(events[i]);
      }
      return out;
    }

    function rerenderFromCache() {
      if (!cachedRangeStart || !cachedRangeEnd) return;
      renderEvents(getFilteredEvents(cachedEvents), cachedRangeStart, cachedRangeEnd);
    }

    function renderLegend(container) {
      if (!showLegend) return;
      var items = getLegendItems();
      if (!items.length) return;

      var wrap = document.createElement('div');
      wrap.style.display = 'flex';
      wrap.style.alignItems = 'center';
      wrap.style.justifyContent = 'flex-end';
      wrap.style.flexWrap = 'wrap';
      wrap.style.gap = s(8) + 'px';
      wrap.style.marginLeft = s(10) + 'px';
      wrap.style.minWidth = '0';
      container.appendChild(wrap);

      for (var i = 0; i < items.length; i++) {
        (function(it) {
          var entry = document.createElement('button');
          entry.type = 'button';
          entry.style.display = 'inline-flex';
          entry.style.alignItems = 'center';
          entry.style.gap = s(6) + 'px';
          entry.style.padding = s(3) + 'px ' + s(7) + 'px';
          entry.style.borderRadius = s(8) + 'px';
          entry.style.border = 'none';
          entry.style.background = 'transparent';
          entry.style.cursor = 'pointer';
          entry.style.color = resolveColor(w.detail_color || 'text_muted');
          entry.style.fontSize = s((w.detail_size || 12)) + 'px';
          entry.style.lineHeight = '1';
          entry.style.whiteSpace = 'nowrap';
          entry.style.opacity = (selectedCalendarKey && selectedCalendarKey !== it.key) ? '0.55' : '1';
          if (selectedCalendarKey === it.key) {
            entry.style.background = rgbaWithAlpha(it.color, 0.16);
          }

          var swatch = document.createElement('span');
          swatch.style.width = s(9) + 'px';
          swatch.style.height = s(9) + 'px';
          swatch.style.borderRadius = s(2) + 'px';
          swatch.style.display = 'inline-block';
          swatch.style.background = it.color;
          entry.appendChild(swatch);

          var label = document.createElement('span');
          label.textContent = it.name;
          entry.appendChild(label);

          entry.addEventListener('click', function(e) {
            e.stopPropagation();
            selectedCalendarKey = (selectedCalendarKey === it.key) ? null : it.key;
            rerenderFromCache();
            resetReturnTimer();
          });

          wrap.appendChild(entry);
        })(items[i]);
      }
    }

    function renderMonthHeaderRow(monthText, withLegend, topMarginPx, bottomMarginPx) {
      var row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.minWidth = '0';
      row.style.margin = topMarginPx + 'px 0 ' + bottomMarginPx + 'px 0';

      var month = document.createElement('div');
      month.style.color = resolveColor(w.month_color || 'primary');
      month.style.fontSize = s((w.month_size || 13)) + 'px';
      month.style.letterSpacing = s(2) + 'px';
      month.style.opacity = '0.95';
      month.style.whiteSpace = 'nowrap';
      month.textContent = monthText;
      row.appendChild(month);

      if (withLegend) {
        renderLegend(row);
      }
      return row;
    }

    function isAllDayEvent(rawEvent, startRaw) {
      if (!rawEvent) return false;
      if (rawEvent.all_day === true || rawEvent.is_all_day === true) return true;
      return (typeof startRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startRaw));
    }

    function normalizeOneEvent(rawEvent, calCfg) {
      if (!rawEvent) return null;

      var summary = rawEvent.summary || rawEvent.message || rawEvent.title || '(No title)';
      var startRaw = null;
      var endRaw = null;

      // REST calendar events commonly return start/end as objects:
      // { start: { dateTime: "..." } } or { start: { date: "..." } }.
      if (rawEvent.start && typeof rawEvent.start === 'object') {
        startRaw = rawEvent.start.dateTime || rawEvent.start.date || null;
      } else {
        startRaw = rawEvent.start || rawEvent.start_date_time || rawEvent.start_date || null;
      }

      if (rawEvent.end && typeof rawEvent.end === 'object') {
        endRaw = rawEvent.end.dateTime || rawEvent.end.date || null;
      } else {
        endRaw = rawEvent.end || rawEvent.end_date_time || rawEvent.end_date || null;
      }

      var startDt = parseEventDate(startRaw);
      var endDt = parseEventDate(endRaw);
      if (!startDt) return null;

      return {
        title: String(summary),
        location: rawEvent.location ? String(rawEvent.location) : '',
        description: rawEvent.description ? String(rawEvent.description) : '',
        start: startDt,
        end: endDt,
        startIsDateOnly: (typeof startRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startRaw)),
        endIsDateOnly: (typeof endRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(endRaw)),
        dayKey: formatDateKey(startDt),
        allDay: isAllDayEvent(rawEvent, startRaw),
        calendarKey: String(calCfg.entity || ''),
        calendarName: getCalendarDisplayName(calCfg),
        color: resolveColor(calCfg.color || 'primary'),
        fullDayHighlight: (calCfg.full_day_highlight === true),
        icon: calCfg.icon || '',
        show: (calCfg.show && Object.prototype.toString.call(calCfg.show) === '[object Array]') ? calCfg.show : []
      };
    }

    function hasShow(ev, key) {
      for (var i = 0; i < ev.show.length; i++) {
        if (ev.show[i] === key) return true;
      }
      return false;
    }

    function rgbaWithAlpha(color, alpha) {
      var c = String(color || '').trim();
      if (!c) return '';

      var hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
      if (hex) {
        var h = hex[1];
        if (h.length === 3) {
          h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
        }
        var r = parseInt(h.substr(0, 2), 16);
        var g = parseInt(h.substr(2, 2), 16);
        var b = parseInt(h.substr(4, 2), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
      }

      var rgb = /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*[0-9.]+\s*)?\)$/i.exec(c);
      if (rgb) {
        return 'rgba(' + Math.round(parseFloat(rgb[1])) + ',' + Math.round(parseFloat(rgb[2])) + ',' + Math.round(parseFloat(rgb[3])) + ',' + alpha + ')';
      }

      return c;
    }

    function openAgendaInfoModal(title, description) {
      if (!description) return;
      var overlay = buildFullscreenOverlay(title || 'More Information');
      var body = document.createElement('div');
      body.style.padding = s(16) + 'px';
      body.style.color = resolveColor('text');
      body.style.fontSize = s(16) + 'px';
      body.style.lineHeight = '1.5';
      body.style.whiteSpace = 'pre-wrap';
      body.style.wordBreak = 'break-word';
      body.textContent = String(description);
      overlay.content.appendChild(body);
      document.body.appendChild(overlay.el);
    }

    function renderOneEventCard(parent, ev) {
      var card = document.createElement('div');
      card.style.position = 'relative';
      card.style.minHeight = s(58) + 'px';
      card.style.padding = s(10) + 'px ' + s(12) + 'px';
      card.style.borderRadius = s((w.event_radius !== undefined ? w.event_radius : 8)) + 'px';
      card.style.background = resolveColor(w.event_background || 'surface2');
      if (ev.allDay && ev.fullDayHighlight) {
        card.style.background = rgbaWithAlpha(ev.color, 0.25);
      }
      card.style.overflow = 'hidden';
      card.style.marginBottom = s(6) + 'px';
      parent.appendChild(card);

      var accent = document.createElement('div');
      accent.style.position = 'absolute';
      accent.style.left = '0';
      accent.style.top = '0';
      accent.style.bottom = '0';
      accent.style.width = s((w.accent_width || 4)) + 'px';
      accent.style.background = ev.color;
      card.appendChild(accent);

      var title = document.createElement('div');
      title.style.color = resolveColor(w.title_color || 'text');
      title.style.fontSize = s((w.title_size || 16)) + 'px';
      title.style.lineHeight = '1.2';
      title.style.paddingLeft = s(4) + 'px';
      title.style.whiteSpace = 'nowrap';
      title.style.overflow = 'hidden';
      title.style.textOverflow = 'ellipsis';
      var titleText = ev.title;
      if (ev.isContinuation) titleText += ' (cont.)';
      setContent(title, ev.icon ? ('[mdi:' + ev.icon.replace(/^mdi:/, '') + '] ' + titleText) : titleText);
      card.appendChild(title);

      if (hasShow(ev, 'time')) {
        var t = document.createElement('div');
        t.style.color = resolveColor(w.detail_color || 'text_muted');
        t.style.fontSize = s((w.detail_size || 13)) + 'px';
        t.style.marginTop = s(6) + 'px';
        t.style.paddingLeft = s(4) + 'px';
        if (ev.allDay) {
          t.textContent = 'All day';
        } else if (ev.timeMode === 'start_only' && ev.start) {
          t.textContent = 'From ' + formatClockTime(ev.start);
        } else if (ev.timeMode === 'end_only' && ev.end) {
          t.textContent = 'Until ' + formatClockTime(ev.end);
        } else if (ev.end) {
          t.textContent = formatClockTime(ev.start) + ' - ' + formatClockTime(ev.end);
        } else {
          t.textContent = formatClockTime(ev.start);
        }
        card.appendChild(t);
      }

      if (hasShow(ev, 'location') && ev.location) {
        var loc = document.createElement('div');
        loc.style.color = resolveColor(w.detail_color || 'text_muted');
        loc.style.fontSize = s((w.detail_size || 13)) + 'px';
        loc.style.marginTop = s(4) + 'px';
        loc.style.paddingLeft = s(4) + 'px';
        loc.style.whiteSpace = 'nowrap';
        loc.style.overflow = 'hidden';
        loc.style.textOverflow = 'ellipsis';
        loc.textContent = ev.location;
        card.appendChild(loc);
      }

      if (hasShow(ev, 'description_icon') && ev.description) {
        var infoRow = document.createElement('div');
        infoRow.style.marginTop = s(6) + 'px';
        infoRow.style.paddingLeft = s(4) + 'px';
        infoRow.style.display = 'flex';
        infoRow.style.alignItems = 'center';
        card.appendChild(infoRow);

        var infoDot = document.createElement('span');
        infoDot.className = 'mdi mdi-text-box-outline';
        infoDot.style.color = resolveColor(w.detail_color || 'text_muted');
        infoDot.style.fontSize = s(14) + 'px';
        infoRow.appendChild(infoDot);

        var infoLink = document.createElement('span');
        infoLink.textContent = 'More information...';
        infoLink.style.marginLeft = s(6) + 'px';
        infoLink.style.color = resolveColor(w.link_color || 'primary');
        infoLink.style.fontSize = s((w.detail_size || 13)) + 'px';
        infoLink.style.textDecoration = 'underline';
        infoLink.style.cursor = 'pointer';
        infoLink.addEventListener('click', function(e) {
          e.stopPropagation();
          openAgendaInfoModal(ev.title, ev.description);
          resetReturnTimer();
        });
        infoRow.appendChild(infoLink);
      }
    }

    function expandEventsForRange(events, rangeStartDay, rangeEndExclusive) {
      var out = [];
      var rangeLastDay = addDays(rangeEndExclusive, -1);

      for (var i = 0; i < events.length; i++) {
        var ev = events[i];
        var sDay = startOfDay(ev.start);
        var eDay = ev.end ? startOfDay(ev.end) : sDay;

        // All-day date-style events typically use an exclusive end date.
        if (ev.allDay && ev.end && ev.endIsDateOnly) {
          eDay = addDays(eDay, -1);
        }
        if (eDay.getTime() < sDay.getTime()) eDay = sDay;

        var multiDay = (eDay.getTime() !== sDay.getTime());

        var iterStart = (sDay.getTime() < rangeStartDay.getTime()) ? rangeStartDay : sDay;
        var iterEnd = (eDay.getTime() > rangeLastDay.getTime()) ? rangeLastDay : eDay;
        if (iterEnd.getTime() < iterStart.getTime()) continue;

        for (var day = new Date(iterStart.getTime()); day.getTime() <= iterEnd.getTime(); day = addDays(day, 1)) {
          var seg = 'single';
          if (multiDay) {
            if (day.getTime() === sDay.getTime()) seg = 'start';
            else if (day.getTime() === eDay.getTime()) seg = 'end';
            else seg = 'middle';
          }

          var ex = {};
          for (var k in ev) {
            if (ev.hasOwnProperty(k)) ex[k] = ev[k];
          }
          ex.dayKey = formatDateKey(day);
          ex.isContinuation = (seg === 'middle' || seg === 'end');
          ex.timeMode = 'normal';

          if (multiDay && !ev.allDay) {
            if (seg === 'start') {
              ex.timeMode = 'start_only';
              ex.end = null;
              ex.allDay = false;
            } else if (seg === 'middle') {
              ex.timeMode = 'all_day_cont';
              ex.allDay = true;
            } else if (seg === 'end') {
              ex.timeMode = 'end_only';
              ex.start = null;
              ex.allDay = false;
            }
          } else if (multiDay && ev.allDay) {
            ex.allDay = true;
          }

          ex.sortTs = ex.start ? ex.start.getTime() : (ex.end ? ex.end.getTime() : day.getTime());
          out.push(ex);
        }
      }
      return out;
    }

    function prepareDayData(events, rangeStartDay, rangeEndExclusive, forceBlankDays) {
      events = expandEventsForRange(events, rangeStartDay, rangeEndExclusive);
      events.sort(function(a, b) {
        if (a.dayKey < b.dayKey) return -1;
        if (a.dayKey > b.dayKey) return 1;
        var aa = (a.allDay ? -1 : 1);
        var bb = (b.allDay ? -1 : 1);
        if (aa !== bb) return aa - bb;
        return a.sortTs - b.sortTs;
      });

      var byDay = {};
      for (var ei = 0; ei < events.length; ei++) {
        var dayKey = events[ei].dayKey;
        if (!byDay[dayKey]) byDay[dayKey] = [];
        byDay[dayKey].push(events[ei]);
      }

      var dayDates = [];
      if (forceBlankDays || showBlankDays) {
        var base = new Date(rangeStartDay.getTime());
        for (var di = 0; di < daysAhead; di++) {
          dayDates.push(new Date(base.getFullYear(), base.getMonth(), base.getDate() + di));
        }
      } else {
        for (var dk in byDay) {
          if (!byDay.hasOwnProperty(dk)) continue;
          if (!byDay[dk] || !byDay[dk].length) continue;
          var dayDate = parseEventDate(dk);
          if (dayDate) dayDates.push(dayDate);
        }
        dayDates.sort(function(a, b) { return a.getTime() - b.getTime(); });
      }

      return { byDay: byDay, dayDates: dayDates };
    }

    function renderEventsList(events, rangeStartDay, rangeEndExclusive) {
      list.innerHTML = '';
      if (!events.length && !showBlankDays) {
        setAgendaEmpty('No upcoming events', rangeStartDay);
        return;
      }

      var data = prepareDayData(events, rangeStartDay, rangeEndExclusive, false);
      var byDay = data.byDay;
      var dayDates = data.dayDates;
      if (!dayDates.length) {
        setAgendaEmpty('No upcoming events', rangeStartDay);
        return;
      }

      var today = new Date();
      today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      var todayKey = formatDateKey(today);
      var lastMonthKey = '';
      for (var i = 0; i < dayDates.length; i++) {
        var dayDate = dayDates[i];
        var dKey = formatDateKey(dayDate);
        var dayEvents = byDay[dKey] || [];

        var monthKey = dayDate.getFullYear() + '-' + (dayDate.getMonth() + 1);
        if (w.show_month_headers !== false && monthKey !== lastMonthKey) {
          lastMonthKey = monthKey;
          var withLegend = (i === 0 && showLegend);
          var monthRow = renderMonthHeaderRow(
            getMonthHeader(dayDate),
            withLegend,
            (i === 0 ? 0 : s(14)),
            s(8)
          );
          list.appendChild(monthRow);
        }

        var row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'flex-start';
        row.style.marginBottom = s(8) + 'px';
        list.appendChild(row);

        var dateColWidth = s((w.date_col_width || 52));
        var dateCol = document.createElement('div');
        dateCol.style.width = dateColWidth + 'px';
        dateCol.style.flex = '0 0 ' + dateColWidth + 'px';
        dateCol.style.paddingTop = s(4) + 'px';
        dateCol.style.textAlign = 'center';
        dateCol.style.color = resolveColor(w.date_color || 'text');
        if (todayIndicator && dKey === todayKey) {
          dateCol.style.background = resolveColor('primary');
          dateCol.style.borderRadius = s(10) + 'px';
          dateCol.style.paddingTop = s(8) + 'px';
          dateCol.style.paddingBottom = s(8) + 'px';
          dateCol.style.color = resolveColor(w.today_text_color || 'background');
        }
        row.appendChild(dateCol);

        var dayNum = document.createElement('div');
        dayNum.style.fontSize = s((w.day_size || 36)) + 'px';
        dayNum.style.lineHeight = '1';
        dayNum.style.fontWeight = '500';
        dayNum.textContent = String(dayDate.getDate());
        dateCol.appendChild(dayNum);

        var dayLbl = document.createElement('div');
        dayLbl.style.fontSize = s((w.weekday_size || 14)) + 'px';
        dayLbl.style.marginTop = s(4) + 'px';
        dayLbl.style.opacity = '0.85';
        dayLbl.textContent = getWeekdayShort(dayDate).toUpperCase();
        dateCol.appendChild(dayLbl);

        var eventsCol = document.createElement('div');
        eventsCol.style.flex = '1';
        eventsCol.style.marginLeft = s(8) + 'px';
        row.appendChild(eventsCol);

        if (!dayEvents.length) {
          var blank = document.createElement('div');
          blank.style.minHeight = s(58) + 'px';
          eventsCol.appendChild(blank);
          continue;
        }

        for (var e = 0; e < dayEvents.length; e++) {
          renderOneEventCard(eventsCol, dayEvents[e]);
        }
      }
      updateOverflowFade();
    }

    function wireColumnFade(scroller, fadeEl) {
      function tick() {
        var hasOverflow = (scroller.scrollHeight > (scroller.clientHeight + 1));
        if (!hasOverflow) { fadeEl.style.display = 'none'; return; }
        var atBottom = (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2);
        fadeEl.style.display = atBottom ? 'none' : 'block';
      }
      scroller.addEventListener('scroll', tick);
      setTimeout(tick, 0);
    }

    function renderEventsColumns(events, rangeStartDay, rangeEndExclusive) {
      list.innerHTML = '';
      fade.style.display = 'none';

      var data = prepareDayData(events, rangeStartDay, rangeEndExclusive, showBlankDays);
      var byDay = data.byDay;
      var dayDates = data.dayDates;
      if (!dayDates.length) {
        setAgendaEmpty('No upcoming events', rangeStartDay);
        return;
      }

      var colMin = s((w.column_min_width !== undefined) ? w.column_min_width : 170);
      var gap = s((w.column_gap !== undefined) ? w.column_gap : 8);
      var colCount = dayDates.length;
      var totalGap = gap * Math.max(0, colCount - 1);
      var listInnerW = Math.max(1, (w.w || 0) - (pad * 2) - s(2));
      var fitColW = Math.floor((listInnerW - totalGap) / Math.max(1, colCount));
      var useFitted = (fitColW >= colMin);
      var colW = useFitted ? fitColW : colMin;

      var board = document.createElement('div');
      board.style.display = 'flex';
      board.style.alignItems = 'stretch';
      board.style.width = useFitted ? '100%' : 'auto';
      board.style.minWidth = useFitted ? '' : ((colW * colCount) + totalGap) + 'px';
      board.style.height = '100%';
      list.appendChild(board);

      var today = new Date();
      today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      var todayKey = formatDateKey(today);
      var lastMonthKey = '';

      for (var i = 0; i < dayDates.length; i++) {
        var dayDate = dayDates[i];
        var dKey = formatDateKey(dayDate);
        var dayEvents = byDay[dKey] || [];

        var col = document.createElement('div');
        col.style.flex = useFitted ? ('1 1 ' + colW + 'px') : ('0 0 ' + colW + 'px');
        col.style.minWidth = useFitted ? '0' : (colW + 'px');
        col.style.display = 'flex';
        col.style.flexDirection = 'column';
        col.style.minHeight = '0';
        if (i > 0) col.style.marginLeft = gap + 'px';
        board.appendChild(col);

        var header = document.createElement('div');
        header.style.padding = s(6) + 'px ' + s(6) + 'px';
        header.style.marginBottom = s(6) + 'px';
        header.style.borderRadius = s(8) + 'px';
        header.style.textAlign = 'left';
        header.style.display = 'flex';
        header.style.flexDirection = 'column';
        header.style.justifyContent = 'flex-start';
        header.style.background = 'transparent';
        header.style.color = resolveColor(w.date_color || 'text');
        if (todayIndicator && dKey === todayKey) {
          // Subtle indicator for columns layout: no full header fill.
          header.style.background = rgbaWithAlpha(resolveColor('primary'), 0.16);
          header.style.borderBottom = s(2) + 'px solid ' + resolveColor('primary');
        }
        col.appendChild(header);

        var monthKey = dayDate.getFullYear() + '-' + (dayDate.getMonth() + 1);
        var monthSlot = document.createElement('div');
        monthSlot.style.fontSize = s((w.month_size || 11)) + 'px';
        monthSlot.style.letterSpacing = s(1.5) + 'px';
        monthSlot.style.lineHeight = '1';
        monthSlot.style.minHeight = s((w.month_size || 11)) + 'px';
        monthSlot.style.marginBottom = s(4) + 'px';
        monthSlot.style.color = resolveColor(w.month_color || 'primary');
        monthSlot.style.opacity = '0.9';
        if (w.show_month_headers !== false && monthKey !== lastMonthKey) {
          lastMonthKey = monthKey;
          monthSlot.textContent = getMonthHeader(dayDate);
        } else {
          monthSlot.textContent = '';
        }
        header.appendChild(monthSlot);

        var dayLine = document.createElement('div');
        dayLine.style.fontSize = s((w.weekday_size || 21)) + 'px';
        dayLine.style.lineHeight = '1.05';
        dayLine.style.fontWeight = '500';
        dayLine.style.whiteSpace = 'nowrap';
        dayLine.style.overflow = 'hidden';
        dayLine.style.textOverflow = 'ellipsis';
        dayLine.textContent = String(dayDate.getDate()) + ' ' + getWeekdayLong(dayDate);
        header.appendChild(dayLine);

        var scrollerWrap = document.createElement('div');
        scrollerWrap.style.position = 'relative';
        scrollerWrap.style.flex = '1';
        scrollerWrap.style.minHeight = '0';
        col.appendChild(scrollerWrap);

        var scroller = document.createElement('div');
        scroller.style.position = 'absolute';
        scroller.style.left = '0';
        scroller.style.right = '0';
        scroller.style.top = '0';
        scroller.style.bottom = '0';
        scroller.style.overflow = 'auto';
        scroller.style.webkitOverflowScrolling = 'touch';
        scrollerWrap.appendChild(scroller);

        for (var e = 0; e < dayEvents.length; e++) {
          renderOneEventCard(scroller, dayEvents[e]);
        }

        var colFade = document.createElement('div');
        colFade.style.position = 'absolute';
        colFade.style.left = '0';
        colFade.style.right = '0';
        colFade.style.bottom = '0';
        colFade.style.height = s(48) + 'px';
        colFade.style.pointerEvents = 'none';
        colFade.style.display = 'none';
        colFade.style.background = 'linear-gradient(180deg, rgba(0,0,0,0), ' + resolveColor(w.background || 'surface') + ' 88%)';
        scrollerWrap.appendChild(colFade);
        wireColumnFade(scroller, colFade);
      }
    }

    function renderEvents(events, rangeStartDay, rangeEndExclusive) {
      if (layout === 'columns') {
        renderEventsColumns(events, rangeStartDay, rangeEndExclusive);
      } else {
        renderEventsList(events, rangeStartDay, rangeEndExclusive);
      }
    }

    function extractEvents(result, entityId) {
      if (!result) return [];
      if (Object.prototype.toString.call(result) === '[object Array]') return result;
      if (result.events && Object.prototype.toString.call(result.events) === '[object Array]') return result.events;
      if (entityId && result[entityId] && Object.prototype.toString.call(result[entityId]) === '[object Array]') return result[entityId];

      for (var k in result) {
        if (!result.hasOwnProperty(k)) continue;
        if (Object.prototype.toString.call(result[k]) === '[object Array]') return result[k];
      }
      return [];
    }

    function requestCalendar(entityId, startIso, endIso, cb, timerRef) {
      var url = haUrl + '/api/calendars/' + entityId +
        '?start=' + encodeURIComponent(startIso) +
        '&end=' + encodeURIComponent(endIso);

      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.setRequestHeader('Authorization', 'Bearer ' + haToken);
      xhr.onload = function() {
        if (xhr.status !== 200) {
          cb([]);
          return;
        }
        var data = null;
        try { data = JSON.parse(xhr.responseText); } catch (e) {}
        cb(extractEvents(data, entityId));
      };
      xhr.onerror = function() { cb([]); };
      xhr.send();
    }

    var timerRef = { id: null, pendingIds: [], stop: null };
    var active = true;
    timerRef.stop = function() { active = false; };
    activePageTimers.push(timerRef);

    function refreshAgenda() {
      if (!active) return;
      if (!calendars.length) {
        setAgendaEmpty('No calendars configured');
        return;
      }

      timerRef.pendingIds = [];
      var startDay = new Date();
      startDay = new Date(startDay.getFullYear(), startDay.getMonth(), startDay.getDate());
      var end = new Date(startDay.getTime() + daysAhead * 24 * 60 * 60 * 1000);
      var startIso = startDay.toISOString();
      var endIso = end.toISOString();

      var remaining = 0;
      var allEvents = [];

      function doneOne() {
        remaining--;
        if (remaining > 0 || !active) return;

        if (w.combine_duplicates) {
          var merged = {};
          for (var i = 0; i < allEvents.length; i++) {
            var ev = allEvents[i];
            var key = ev.dayKey + '|' + ev.title;
            if (!merged[key]) merged[key] = ev;
          }
          allEvents = [];
          for (var k in merged) {
            if (merged.hasOwnProperty(k)) allEvents.push(merged[k]);
          }
        }

        cachedEvents = allEvents.slice(0);
        cachedRangeStart = new Date(startDay.getTime());
        cachedRangeEnd = new Date(end.getTime());
        renderEvents(getFilteredEvents(cachedEvents), cachedRangeStart, cachedRangeEnd);
      }

      for (var i = 0; i < calendars.length; i++) {
        var calCfg = calendars[i];
        if (!calCfg || !calCfg.entity) continue;
        remaining++;
        (function(cfg) {
          requestCalendar(cfg.entity, startIso, endIso, function(rawEvents) {
            if (!active) return;
            for (var j = 0; j < rawEvents.length; j++) {
              var ev = normalizeOneEvent(rawEvents[j], cfg);
              if (ev) allEvents.push(ev);
            }
            doneOne();
          }, timerRef);
        })(calCfg);
      }

      if (remaining === 0) {
        setAgendaEmpty('No calendars configured');
      }
    }

    setAgendaEmpty('Loading...');
    refreshAgenda();

    var timer = setInterval(refreshAgenda, refreshSec * 1000);
    timerRef.id = timer;
  }

  // -- Camera widget --
  //
  // preview modes:
  //   "mjpeg"    - persistent MJPEG stream in an <img> tag via HA proxy (default, most efficient)
  //   "snapshot" - polling snapshot, configurable interval (default 3s)
  //   "poster"   - single snapshot refreshed every 60s, overlays a play button
  //   "url"      - direct URL you supply, no HA auth needed
  //
  // Tapping always opens a fullscreen HLS stream.
  //
  function renderCamera(el, w) {
    el.className += ' widget-image';
    el.style.overflow     = 'hidden';
    el.style.borderRadius = (w.radius !== undefined ? w.radius : 0) + 'px';
    el.style.background   = '#111';
    el.style.cursor       = 'pointer';

    var preview = w.preview || 'mjpeg';
    var snapshotEntity = w.snapshot_entity || w.entity;
    var streamEntity   = w.stream_entity   || w.entity;

    // Build the preview area based on mode
    if (preview === 'mjpeg') {
      renderCameraMjpeg(el, w, streamEntity);
    } else if (preview === 'snapshot') {
      renderCameraSnapshot(el, w, snapshotEntity, (w.refresh_interval || 3) * 1000);
    } else if (preview === 'poster') {
      renderCameraSnapshot(el, w, snapshotEntity, (w.refresh_interval || 60) * 1000, true);
    } else if (preview === 'url') {
      renderCameraDirectUrl(el, w);
    }

    // Tap -> fullscreen HLS stream
    el.addEventListener('click', function() {
      openFullscreenStream(streamEntity, w);
    });
  }

  // MJPEG preview - one persistent connection, browser renders frames automatically
  function renderCameraMjpeg(el, w, entity) {
    var img = document.createElement('img');
    img.style.width     = '100%';
    img.style.height    = '100%';
    img.style.objectFit = w.fit || 'cover';
    img.style.display   = 'block';
    el.appendChild(img);

    var loader = document.createElement('div');
    loader.className = 'camera-loader';
    var loaderIcon = document.createElement('span');
    loaderIcon.className = 'mdi mdi-loading mdi-spin';
    loader.appendChild(loaderIcon);
    el.appendChild(loader);

    // Request a signed MJPEG stream URL - one sign per session, stream stays open
    var path = '/api/camera_proxy_stream/' + entity;
    requestSignedUrl(path, 3600, function(url) {
      if (!url) { loader.textContent = ''; var e = document.createElement('span'); e.className = 'mdi mdi-alert-circle'; loader.appendChild(e); return; }
      img.onload = function() { loader.style.display = 'none'; };
      img.onerror = function() { loader.textContent = ''; var e = document.createElement('span'); e.className = 'mdi mdi-alert-circle'; loader.appendChild(e); };
      img.src = url;
    });

    // MJPEG streams don't need polling - no timer to register
  }

  // Snapshot preview - polls at interval, optionally overlays a play button (poster mode)
  function renderCameraSnapshot(el, w, entity, interval, showPlayButton) {
    var img = document.createElement('img');
    img.style.width     = '100%';
    img.style.height    = '100%';
    img.style.objectFit = w.fit || 'cover';
    img.style.display   = 'block';
    el.appendChild(img);

    var loader = document.createElement('div');
    loader.className = 'camera-loader';
    var loaderIcon = document.createElement('span');
    loaderIcon.className = 'mdi mdi-loading mdi-spin';
    loader.appendChild(loaderIcon);
    el.appendChild(loader);

    if (showPlayButton) {
      var playBtn = document.createElement('div');
      playBtn.className = 'camera-play-btn';
      var playIcon = document.createElement('span'); playIcon.className = 'mdi mdi-play-circle'; playBtn.appendChild(playIcon);
      el.appendChild(playBtn);
    }

    var active = true;
    var pendingSignIds = [];

    var mode = showPlayButton ? 'poster' : 'snapshot';
    console.log('HAven camera [' + (w.id || entity) + ']: ' + mode + ' init, entity=' + entity + ', interval=' + (interval / 1000) + 's');

    var fetchSnapshot = function() {
      if (!active || !entity) return;

      // Use camera entity's access_token from state cache - no WS round-trip
      var state = entityStates[entity];
      var token = state && state.attributes && state.attributes.access_token;

      if (token) {
        var url = haUrl + '/api/camera_proxy/' + entity
                + '?token=' + token + '&t=' + Date.now();
        var nextImg = new Image();
        nextImg.onload = function() {
          if (!active) return;
          img.src = nextImg.src;
          loader.style.display = 'none';
        };
        nextImg.onerror = function() {
          if (!active) return;
          console.warn('HAven camera [' + (w.id || entity) + ']: snapshot fetch failed, token may be stale - clearing to force sign_path fallback');
          if (entityStates[entity] && entityStates[entity].attributes) {
            entityStates[entity].attributes.access_token = null;
          }
        };
        nextImg.src = url;
      } else {
        // Token not in cache yet - fetch entity state once then sign the path
        // Use a flag on the element to avoid hammering fetchEntityState every tick
        if (!el._stateFetched) {
          el._stateFetched = true;
          console.log('HAven camera [' + (w.id || entity) + ']: no access_token in cache, fetching entity state + sign_path fallback');
          fetchEntityState(entity);
          // Also register a one-time entity callback so that when the state arrives
          // (e.g. after WS connects and get_states completes), we immediately retry
          // fetchSnapshot rather than waiting up to one full interval cycle (can be 60s).
          var onStateArrived = function(state) {
            var cbs = entityCallbacks[entity];
            if (cbs) { var idx = cbs.indexOf(onStateArrived); if (idx !== -1) cbs.splice(idx, 1); }
            if (active && state && state.attributes && state.attributes.access_token) {
              fetchSnapshot();
            }
          };
          registerEntityCallback(entity, onStateArrived);
        }
        var path   = '/api/camera_proxy/' + entity;
        var ttl    = Math.ceil(interval / 1000) + 5;
        var signId = requestSignedUrl(path, ttl, function(signedUrl) {
          var i = pendingSignIds.indexOf(signId);
          if (i !== -1) pendingSignIds.splice(i, 1);
          if (!active) return;
          if (!signedUrl) {
            console.warn('HAven camera [' + (w.id || entity) + ']: sign_path returned no URL');
            return;
          }
          var fb = new Image();
          fb.onload = function() { if (!active) return; img.src = fb.src; loader.style.display = 'none'; };
          fb.onerror = function() { console.warn('HAven camera [' + (w.id || entity) + ']: sign_path image load failed'); };
          fb.src = signedUrl;
        });
        pendingSignIds.push(signId);
      }
    };

    fetchSnapshot();
    var timer = setInterval(fetchSnapshot, interval);
    activePageTimers.push({
      id:         timer,
      stop:       function() { active = false; },
      pendingIds: pendingSignIds
    });
  }

  // Direct URL preview - for Reolink/ONVIF/any camera with a direct HTTP endpoint
  // Note: if HA is served over HTTP and camera is HTTPS with a self-signed cert,
  // the browser will block the request silently. Either:
  //   a) use HTTP for the camera URL, or
  //   b) visit the camera IP directly in the browser once to accept the certificate
  function renderCameraDirectUrl(el, w) {
    var img = document.createElement('img');
    img.style.width     = '100%';
    img.style.height    = '100%';
    img.style.objectFit = w.fit || 'cover';
    img.style.display   = 'block';

    var loader = document.createElement('div');
    loader.className = 'camera-loader';
    var loaderIcon = document.createElement('span');
    loaderIcon.className = 'mdi mdi-loading mdi-spin';
    loader.appendChild(loaderIcon);
    el.appendChild(img);
    el.appendChild(loader);

    var url = w.url || '';

    img.onload  = function() { loader.style.display = 'none'; };
    img.onerror = function() {
      loader.style.display = 'flex';
      loader.textContent = ''; var e = document.createElement('span'); e.className = 'mdi mdi-alert-circle'; loader.appendChild(e);
    };

    var active = true;
    var doFetch = function() {
      if (!active) return;
      // Always bust cache - the rs= param in Reolink URLs isn't enough
      img.src = url + (url.indexOf('?') !== -1 ? '&' : '?') + '_t=' + Date.now();
    };

    doFetch();

    if (w.refresh_interval) {
      var timer = setInterval(doFetch, w.refresh_interval * 1000);
      activePageTimers.push({ id: timer, stop: function() { active = false; } });
    }

    if (w.preview === 'poster') {
      var playBtn = document.createElement('div');
      playBtn.className   = 'camera-play-btn';
      var playIcon = document.createElement('span'); playIcon.className = 'mdi mdi-play-circle'; playBtn.appendChild(playIcon);
      el.appendChild(playBtn);
    }
  }

  // ---- Fullscreen overlay ----------------------------------

  function openFullscreenImage(url, title) {
    var overlay = buildFullscreenOverlay(title);
    var img = document.createElement('img');
    img.style.maxWidth  = '100%';
    img.style.maxHeight = '100%';
    img.style.objectFit = 'contain';
    img.src = url;
    overlay.content.appendChild(img);
    document.body.appendChild(overlay.el);
  }

  function openFullscreenStream(entity, w) {
    var overlay = buildFullscreenOverlay(w.label || entity);

    var loader = document.createElement('div');
    loader.className = 'camera-loader';
    var loaderIcon = document.createElement('span');
    loaderIcon.className = 'mdi mdi-loading mdi-spin';
    loader.appendChild(loaderIcon);
    loader.style.position = 'relative';
    loader.style.width    = '100%';
    loader.style.height   = '100%';
    overlay.content.appendChild(loader);
    document.body.appendChild(overlay.el);

    var streamMsgId = msgId++;
    console.log('HAven camera [' + (w.id || entity) + ']: requesting HLS stream, entity=' + entity + ', msgId=' + streamMsgId);
    pendingStreamRequests[streamMsgId] = function(result) {
      if (!result || !result.url) {
        console.warn('HAven camera [' + (w.id || entity) + ']: camera/stream result has no URL. result=', result);
        loader.textContent = ''; var e = document.createElement('span'); e.className = 'mdi mdi-alert-circle'; loader.appendChild(e);
        return;
      }
      var streamUrl = haUrl + result.url;
      console.log('HAven camera [' + (w.id || entity) + ']: stream URL received:', streamUrl);
      loader.style.display = 'none';

      var video = document.createElement('video');
      video.style.width     = '100%';
      video.style.height    = '100%';
      video.style.objectFit = 'contain';
      video.style.background = '#000';
      video.autoplay    = true;
      video.playsInline = true;
      video.controls    = true;
      video.muted       = false;
      video.loop        = true;

      overlay.content.appendChild(video);

      function startPlayback() {
        console.log('HAven camera [' + (w.id || entity) + ']: starting playback');
        video.play().catch(function(err) {
          console.log('HAven camera [' + (w.id || entity) + ']: autoplay blocked, retrying muted:', err.message);
          video.muted = true;
          video.play().catch(function(err2) {
            console.warn('HAven camera [' + (w.id || entity) + ']: muted play also failed:', err2.message);
          });
        });
      }

      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS - Safari and iOS
        console.log('HAven camera [' + (w.id || entity) + ']: using native HLS (Safari/iOS)');
        video.src = streamUrl;
        startPlayback();
      } else if (window.Hls && window.Hls.isSupported()) {
        console.log('HAven camera [' + (w.id || entity) + ']: using HLS.js (already loaded)');
        var hls = new window.Hls();
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hls.on(window.Hls.Events.MANIFEST_PARSED, function() {
          console.log('HAven camera [' + (w.id || entity) + ']: HLS manifest parsed');
          startPlayback();
        });
        hls.on(window.Hls.Events.ERROR, function(event, data) {
          if (data.fatal) console.warn('HAven camera [' + (w.id || entity) + ']: HLS.js fatal error:', data.type, data.details);
        });
        overlay.el.addEventListener('overlay-close', function() { hls.destroy(); });
      } else {
        // Load HLS.js dynamically - only fetched once then cached by browser
        console.log('HAven camera [' + (w.id || entity) + ']: loading HLS.js dynamically');
        var script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.4.12/hls.min.js';
        script.onload = function() {
          if (window.Hls.isSupported()) {
            console.log('HAven camera [' + (w.id || entity) + ']: HLS.js loaded OK');
            var hls = new window.Hls();
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            hls.on(window.Hls.Events.MANIFEST_PARSED, function() {
              console.log('HAven camera [' + (w.id || entity) + ']: HLS manifest parsed');
              startPlayback();
            });
            hls.on(window.Hls.Events.ERROR, function(event, data) {
              if (data.fatal) console.warn('HAven camera [' + (w.id || entity) + ']: HLS.js fatal error:', data.type, data.details);
            });
            overlay.el.addEventListener('overlay-close', function() { hls.destroy(); });
          } else {
            console.warn('HAven camera [' + (w.id || entity) + ']: HLS.js loaded but not supported in this browser');
            loader.textContent = ''; var e = document.createElement('span'); e.className = 'mdi mdi-alert-circle'; loader.appendChild(e);
            loader.style.display = 'flex';
          }
        };
        script.onerror = function() {
          console.warn('HAven camera [' + (w.id || entity) + ']: failed to load HLS.js script from CDN');
          loader.textContent = ''; var e = document.createElement('span'); e.className = 'mdi mdi-alert-circle'; loader.appendChild(e);
          loader.style.display = 'flex';
        };
        document.head.appendChild(script);
      }

      overlay.el.addEventListener('overlay-close', function() {
        video.pause();
        video.src = '';
      });
    };

    wsSend({ id: streamMsgId, type: 'camera/stream', entity_id: entity });
  }

  function buildFullscreenOverlay(title) {
    var overlay = document.createElement('div');
    overlay.className = 'fs-overlay';

    var header = document.createElement('div');
    header.className = 'fs-header';

    var titleEl = document.createElement('span');
    titleEl.className   = 'fs-title';
    titleEl.textContent = title || '';
    header.appendChild(titleEl);

    var closeBtn = document.createElement('button');
    closeBtn.className        = 'fs-close';
    var closeIcon = document.createElement('span');
    closeIcon.className = 'mdi mdi-close';
    closeBtn.appendChild(closeIcon);
    closeBtn.addEventListener('click', function() {
      overlay.dispatchEvent(new CustomEvent('overlay-close'));
      document.body.removeChild(overlay);
      resetReturnTimer();
    });
    header.appendChild(closeBtn);
    overlay.appendChild(header);

    var content = document.createElement('div');
    content.className = 'fs-content';
    overlay.appendChild(content);

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        overlay.dispatchEvent(new CustomEvent('overlay-close'));
        document.body.removeChild(overlay);
        resetReturnTimer();
      }
    });

    return { el: overlay, content: content };
  }

  // Request signed URL helper (used by camera snapshot)
  // Returns the msgId so callers can track and cancel if needed
  function requestSignedUrl(path, expires, cb) {
    var id = msgId++;
    pendingStreamRequests[id] = function(result) {
      cb(result && result.path ? haUrl + result.path : null);
    };
    wsSend({ id: id, type: 'auth/sign_path', path: path, expires: expires || 20 });
    return id;
  }
  // -- History Chart --
  // Fetches HA long-term statistics via recorder/statistics_during_period and
  // renders a vertical bar chart. One WS request on page load, then periodic refresh.
  //
  // Config properties:
  //   entity          - HA entity ID (must have long-term statistics enabled in recorder)
  //   period          - "hour" | "day" | "month" | "year"  (default "day")
  //   count           - number of bars to show                (default 7)
  //   stat_type       - "mean" for power/temp sensors, "change" for energy totals (kWh accumulators) (default "mean")
  //   max             - fixed y-axis ceiling; omit to auto-scale from data
  //   color           - bar fill color (theme token or hex,   default "primary")
  //   today_color     - current-period bar color               (default "warning")
  //   background      - widget background                      (default "surface")
  //   radius          - bar corner radius px                   (default 2)
  //   show_values     - value labels above bars                (default true)
  //   show_labels     - period labels below bars               (default true)
  //   refresh_interval - seconds between auto-refetch          (default 3600 for day, 300 for hour)
  //   fullscreen_on_tap - true to open enlarged modal on tap   (default false)

  function renderHistoryChart(el, w) {
    el.className += ' widget-history-chart';
    el.style.background   = resolveColor(w.background || 'surface');
    el.style.borderRadius = (w.radius !== undefined ? w.radius : 4) + 'px';
    el.style.overflow     = 'hidden';

    if (w.fullscreen_on_tap) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', function() { openFullscreenChart(w); });
    }

    // SVG element fills the widget — redrawn in-place on each data refresh
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width',  w.w || 200);
    svg.setAttribute('height', w.h || 100);
    svg.style.display = 'block';
    el.appendChild(svg);

    // Show a placeholder until data arrives (page renders before WS connects)
    var svgH = w.h || 100;
    svg.innerHTML = '<text x="50%" y="' + Math.round(svgH / 2) + '" text-anchor="middle"' +
      ' font-size="11" fill="' + resolveColor('text_muted') + '">loading\u2026</text>';

    // fetchHistoryStats will retry until WS is ready; no immediate bail on page render
    fetchHistoryStats(w, svg, 20);

    // Periodic refresh registered in activePageTimers so it's cancelled on page navigation
    var defaultInterval = (w.period === 'hour') ? 300 : 3600;
    var intervalMs = (w.refresh_interval || defaultInterval) * 1000;
    var timer = setInterval(function() { fetchHistoryStats(w, svg, 0); }, intervalMs);
    activePageTimers.push(timer);
  }

  function openFullscreenChart(w) {
    var overlay  = buildFullscreenOverlay(w.label || w.entity || 'Chart');
    var content  = overlay.content;
    var views    = w.fullscreen_views;  // optional [{label, period, count, stat_type}, ...]

    content.style.background    = resolveColor(w.background || 'surface');
    content.style.display       = 'flex';
    content.style.flexDirection = 'column';

    // Button bar — only built when there are multiple views to switch between
    var btnBar   = null;
    var activeBtn = null;
    if (views && views.length > 1) {
      btnBar = document.createElement('div');
      btnBar.style.flexShrink     = '0';
      btnBar.style.display        = 'flex';
      btnBar.style.flexWrap       = 'wrap';
      btnBar.style.justifyContent = 'center';
      btnBar.style.padding        = '10px 16px 6px';
      content.appendChild(btnBar);
    }

    // Chart area — flex:1 so it fills remaining space after the button bar
    var chartArea = document.createElement('div');
    chartArea.style.flex           = '1';
    chartArea.style.display        = 'flex';
    chartArea.style.alignItems     = 'center';
    chartArea.style.justifyContent = 'center';
    content.appendChild(chartArea);

    document.body.appendChild(overlay.el);

    var activeSvg = null;

    function loadView(view, btn) {
      // Swap active button highlight
      if (btnBar && activeBtn) {
        activeBtn.style.background = resolveColor('surface2');
        activeBtn.style.color      = resolveColor('text_muted');
      }
      if (btnBar && btn) {
        btn.style.background = resolveColor('primary');
        btn.style.color      = resolveColor(w.background || 'surface');
      }
      activeBtn = btn;

      // Remove the previous SVG
      if (activeSvg && activeSvg.parentNode) { activeSvg.parentNode.removeChild(activeSvg); }

      // Dimensions: preserve original aspect ratio, cap to 90% screen width,
      // clamp height so chart never overflows a portrait viewport.
      var margin = 24;
      var availW = chartArea.clientWidth  - margin * 2;
      var availH = chartArea.clientHeight - margin * 2;
      if (availW < 50 || availH < 50) return;

      var ratio = (w.w || 200) / (w.h || 100);
      var cw    = Math.min(availW, Math.round(window.innerWidth * 0.9));
      var ch    = Math.round(cw / ratio);
      if (ch > availH) { ch = availH; cw = Math.round(ch * ratio); }

      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width',  cw);
      svg.setAttribute('height', ch);
      svg.style.display      = 'block';
      svg.style.borderRadius = (w.radius !== undefined ? w.radius : 4) + 'px';
      svg.style.background   = resolveColor(w.background || 'surface');
      svg.innerHTML = '<text x="50%" y="' + Math.round(ch / 2) + '" text-anchor="middle"' +
        ' font-size="14" fill="' + resolveColor('text_muted') + '">loading\u2026</text>';
      chartArea.appendChild(svg);
      activeSvg = svg;

      // Merge base widget config with view overrides + modal dimensions
      var viewW = {};
      for (var k in w) { if (w.hasOwnProperty(k)) viewW[k] = w[k]; }
      viewW.w = cw;
      viewW.h = ch;
      if (view.period)    viewW.period    = view.period;
      if (view.count)     viewW.count     = view.count;
      if (view.stat_type) viewW.stat_type = view.stat_type;

      fetchHistoryStats(viewW, svg, 5);
    }

    // Build after layout so chartArea dimensions are measurable
    setTimeout(function() {
      var initialView = (views && views.length) ? views[0] : {};

      if (views && views.length > 1) {
        for (var i = 0; i < views.length; i++) {
          (function(view, idx) {
            var btn = document.createElement('button');
            btn.textContent          = view.label || (view.count + ' ' + view.period);
            btn.style.background     = resolveColor('surface2');
            btn.style.color          = resolveColor('text_muted');
            btn.style.border         = 'none';
            btn.style.borderRadius   = '20px';
            btn.style.padding        = '6px 16px';
            btn.style.margin         = '0 4px 4px';
            btn.style.fontSize       = '13px';
            btn.style.cursor         = 'pointer';
            btn.style.fontFamily     = 'inherit';
            btn.addEventListener('click', function() { loadView(view, btn); });
            btnBar.appendChild(btn);
            if (idx === 0) { loadView(view, btn); }
          })(views[i], i);
        }
      } else {
        loadView(initialView, null);
      }
    }, 50);
  }

  function fetchHistoryStats(w, svg, retries) {
    // Page renders before WS connects - retry up to retries times at 2s intervals
    if (!ws || ws.readyState !== 1) {
      if (retries > 0) {
        setTimeout(function() { fetchHistoryStats(w, svg, retries - 1); }, 2000);
      }
      return;
    }

    var count  = w.count  || 7;
    var period = w.period || 'day';

    // Calculate start timestamp - go back `count` periods from now.
    // Use local midnight for day/month/year so HA aligns to the user's timezone.
    var now = new Date();
    var start;
    if (period === 'hour') {
      start = new Date(now.getTime() - count * 3600 * 1000);
    } else if (period === 'month') {
      start = new Date(now.getFullYear(), now.getMonth() - count, 1);
    } else if (period === 'year') {
      start = new Date(now.getFullYear() - count, 0, 1);
    } else {
      // day - back from local midnight today
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - count);
    }

    // One-off WS request - response routed via pendingStreamRequests by message ID
    var id = msgId++;
    pendingStreamRequests[id] = function(result) {
      if (!result) return;
      var stats = result[w.entity];
      if (!stats || !stats.length) return;
      updateHistoryChart(svg, w, stats);
    };
    wsSend({
      id:            id,
      type:          'recorder/statistics_during_period',
      start_time:    start.toISOString(),
      period:        period,
      statistic_ids: [w.entity],
      types:         [w.stat_type || 'mean']
    });
  }

  function updateHistoryChart(svg, w, stats) {
    var count      = w.count    || 7;
    var statType   = w.stat_type || 'mean';
    var svgW       = w.w        || 200;
    var svgH       = w.h        || 100;
    var showLabels = (w.show_labels  !== false);
    var showValues = (w.show_values  !== false);
    var barRadius  = (w.radius !== undefined ? w.radius : 2);
    var wPeriod    = w.period   || 'day';

    var color      = resolveColor(w.color       || 'primary');
    var todayColor = resolveColor(w.today_color || 'warning');
    var trackColor = resolveColor('surface2');
    var textColor  = resolveColor(w.label_color || 'text_muted');

    // Take the last `count` entries (today/current period is always the last entry)
    var data = stats.slice(-count);
    if (!data.length) return;

    // Extract numeric values; null/undefined stat (wrong stat_type for sensor class) → 0
    var values = [];
    for (var i = 0; i < data.length; i++) {
      var v = data[i][statType];
      values.push((v !== null && v !== undefined && !isNaN(v)) ? Math.max(0, v) : 0);
    }

    // Y-axis ceiling: use configured max or auto-scale (min 1 to avoid divide-by-zero)
    var maxVal = w.max || Math.max.apply(null, values);
    if (!maxVal || maxVal <= 0) maxVal = 1;

    // Layout
    var padX    = 2;
    var gap     = 3;
    var labelH  = showLabels ? 14 : 0;
    var valueH  = showValues ? 13 : 0;
    var topPad  = 2;
    var barsH   = svgH - labelH - valueH - topPad;
    var n       = data.length;
    var barW    = Math.max(4, Math.floor((svgW - padX * 2 - gap * (n - 1)) / n));

    var DAY_LTR   = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    var MONTH_LTR = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

    var parts = [];
    for (var j = 0; j < n; j++) {
      var val     = values[j];
      var pct     = Math.min(1, val / maxVal);
      var barH    = Math.max((val > 0 ? 2 : 0), Math.round(pct * barsH));
      var x       = padX + j * (barW + gap);
      var isToday = (j === n - 1);  // last entry = current period
      var bColor  = isToday ? todayColor : color;

      // Track (full-height background)
      var trackY = topPad + valueH;
      parts.push('<rect x="' + x + '" y="' + trackY + '" width="' + barW +
        '" height="' + barsH + '" fill="' + trackColor + '" rx="' + barRadius + '"/>');

      // Value bar (bottom-anchored inside track)
      if (barH > 0) {
        var barY = topPad + valueH + (barsH - barH);
        parts.push('<rect x="' + x + '" y="' + barY + '" width="' + barW +
          '" height="' + barH + '" fill="' + bColor + '" rx="' + barRadius + '"/>');
      }

      // Value label above bar
      if (showValues) {
        var dv = val >= 10 ? String(Math.round(val)) : (val > 0 ? val.toFixed(1) : '');
        if (dv) {
          parts.push('<text x="' + (x + barW / 2) + '" y="' + (topPad + valueH - 2) +
            '" text-anchor="middle" font-size="10" fill="' + bColor + '">' + dv + '</text>');
        }
      }

      // Period label below bars
      if (showLabels) {
        var lbl = '?';
        try {
          var dt = new Date(data[j].start);
          if (wPeriod === 'day' || wPeriod === 'hour') { lbl = DAY_LTR[dt.getDay()]; }
          else if (wPeriod === 'month')                 { lbl = MONTH_LTR[dt.getMonth()]; }
          else                                          { lbl = String(dt.getFullYear()).slice(-2); }
        } catch(e) {}
        var lColor = isToday ? todayColor : textColor;
        parts.push('<text x="' + (x + barW / 2) + '" y="' + (svgH - 2) +
          '" text-anchor="middle" font-size="11" fill="' + lColor + '">' + lbl + '</text>');
      }
    }

    svg.innerHTML = parts.join('');
  }

  // -- Clock --
  function renderClock(el, w) {
    el.className += ' widget-clock';
    el.style.color      = resolveColor(w.color      || 'text');
    el.style.background = resolveColor(w.background || 'transparent');
    el.style.fontSize   = (w.font_size || 22) + 'px';
    el.style.padding    = '0 8px';
    el.textContent      = '--:--';
  }

  // ---- Value formatting -------------------------------------
  function formatValue(val, w) {
    if (val === null || val === undefined) return w.text || '--';

    var num = parseFloat(val);
    var fmt = w.format || '';
    var prefix = w.prefix || '';

    switch (fmt) {
      case 'duration':
        if (isNaN(num)) return '--:--';
        if (num < 0) num = 0;
        num = Math.floor(num);
        var hh = Math.floor(num / 3600);
        var mm = Math.floor((num % 3600) / 60);
        var ss = num % 60;
        var mmStr = (mm < 10 ? '0' : '') + mm;
        var ssStr = (ss < 10 ? '0' : '') + ss;
        if (hh > 0) return prefix + hh + ':' + mmStr + ':' + ssStr;
        return prefix + mm + ':' + ssStr;

      case 'time_24':
      case 'time_12':
      case 'date_iso':
      case 'date_short':
      case 'datetime_24':
      case 'datetime_12':
        var d = parseDateValue(val);
        if (!d) return '--';
        return formatDateValue(d, fmt, prefix);

      case 'power':
        if (isNaN(num)) return '--';
        if (num < 0) num = Math.abs(num);
        return num < 1000
          ? Math.round(num) + ' [small:w]'
          : (num / 1000).toFixed(1) + ' [small:kW]';

      case 'power_abs':
        if (isNaN(num)) return '--';
        num = Math.abs(num);
        return num < 1000
          ? Math.round(num) + ' [small:w]'
          : (num / 1000).toFixed(1) + ' [small:kW]';

      case 'power_prefix':
        if (isNaN(num)) return prefix + '--';
        return prefix + (num < 1000
          ? Math.round(num) + ' [small:w]'
          : (num / 1000).toFixed(1) + ' [small:kW]');

      case 'kwh':
        if (isNaN(num)) return '--';
        return num.toFixed(1) + ' [small:kWh]';

      case 'percent':
        if (isNaN(num)) return '--%';
        return Math.round(num) + '[small:%]';

      default:
        return prefix + val;
    }
  }

  // ---- Template expressions --------------------------------
  // Supports {{ expr }} blocks inside strings.
  // expr can reference: state, state_str, attr.<name>
  // Functions: round(x,n), min(a,b), max(a,b), abs(x), floor(x), ceil(x)
  var templateExprCache = {};

  function hasTemplate(str) {
    return (str && String(str).indexOf('{{') !== -1);
  }

  // applyTemplate(str, state, state2)
  //   Replaces {{ expr }} blocks. state2 is optional - passed through to evaluateExpression
  //   so templates on entity2-aware labels can reference state2/state_str2/attr2.
  function applyTemplate(str, state, state2) {
    if (!str) return '';
    var s = String(str);
    if (s.indexOf('{{') === -1) return s;

    return s.replace(/\{\{([\s\S]*?)\}\}/g, function(_, expr) {
      var val = evaluateExpression(expr, state, state2);
      if (val === null || val === undefined) return '';
      return String(val);
    });
  }

  // evaluateExpression(expr, state, state2)
  //   state  - primary entity HA state object  → available as: state, state_str, attr
  //   state2 - secondary entity HA state object → available as: state2, state_str2, attr2
  // All parameters to the compiled function must match the call below exactly.
  function evaluateExpression(expr, state, state2) {
    var key = String(expr).trim();
    if (!key) return '';

    var fn = templateExprCache[key];
    if (!fn) {
      try {
        fn = new Function(
          'state', 'state_str', 'attr', 'round', 'min', 'max', 'abs', 'floor', 'ceil',
          'state2', 'state_str2', 'attr2',
          '"use strict"; return (' + key + ');'
        );
      } catch (e) {
        templateExprCache[key] = null;
        return '';
      }
      templateExprCache[key] = fn;
    }
    if (!fn) return '';

    // Primary entity bindings
    var raw = state ? state.state : null;
    var num = parseFloat(raw);
    var stateVal = (!isNaN(num) ? num : raw);
    var stateStr = (raw !== null && raw !== undefined) ? String(raw) : '';
    var attrs = state && state.attributes ? state.attributes : {};

    // Secondary entity bindings (entity2) - undefined/null when entity2 not configured
    var raw2 = state2 ? state2.state : null;
    var num2 = parseFloat(raw2);
    var stateVal2 = (raw2 !== null && !isNaN(num2) ? num2 : raw2);
    var stateStr2 = (raw2 !== null && raw2 !== undefined) ? String(raw2) : '';
    var attrs2 = state2 && state2.attributes ? state2.attributes : {};

    try {
      return fn(stateVal, stateStr, attrs, tmplRound, Math.min, Math.max, Math.abs, Math.floor, Math.ceil,
                stateVal2, stateStr2, attrs2);
    } catch (e2) {
      return '';
    }
  }

  function tmplRound(val, decimals) {
    var n = parseFloat(val);
    if (isNaN(n)) return val;
    if (decimals === undefined || decimals === null) return Math.round(n);
    var d = parseInt(decimals, 10);
    if (isNaN(d) || d < 0) d = 0;
    var m = Math.pow(10, d);
    return Math.round(n * m) / m;
  }

  function parseDateValue(val) {
    if (!val) return null;
    var d = new Date(val);
    if (!isNaN(d.getTime())) return d;
    // Try a simple space -> T conversion for non-ISO strings
    var s = String(val).replace(' ', 'T');
    d = new Date(s);
    if (!isNaN(d.getTime())) return d;
    return null;
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function formatDateValue(d, fmt, prefix) {
    var yyyy = d.getFullYear();
    var mm = pad2(d.getMonth() + 1);
    var dd = pad2(d.getDate());
    var HH = pad2(d.getHours());
    var MM = pad2(d.getMinutes());

    var h12 = d.getHours() % 12;
    if (h12 === 0) h12 = 12;
    var ampm = d.getHours() >= 12 ? 'PM' : 'AM';

    switch (fmt) {
      case 'time_24':     return prefix + HH + ':' + MM;
      case 'time_12':     return prefix + h12 + ':' + MM + ' ' + ampm;
      case 'date_iso':    return prefix + yyyy + '-' + mm + '-' + dd;
      case 'date_short':  return prefix + dd + ' ' + MONTHS_SHORT[d.getMonth()];
      case 'datetime_24': return prefix + yyyy + '-' + mm + '-' + dd + ' ' + HH + ':' + MM;
      case 'datetime_12': return prefix + yyyy + '-' + mm + '-' + dd + ' ' + h12 + ':' + MM + ' ' + ampm;
      default:            return prefix + d.toISOString();
    }
  }

  var MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // ---- Conditional overrides -------------------------------
  // overrides: [{ when: { logic: 'all'|'any', conditions: [...] }, set: { ... } }, ...]
  // conditions can be nested groups with their own logic/conditions.
  // Each condition may specify source (default: 'state').
  // resolveOverrides(w, haState, haState2)
  //   Evaluates all override rules for a widget, merging matching rule.set objects.
  //   haState2 is the secondary entity state (entity2) - optional, pass null if unused.
  //   All matching rules are merged (last-wins per property), so rule order matters.
  function resolveOverrides(w, haState, haState2) {
    if (!w.overrides || !w.overrides.length) return null;
    var out = {};
    for (var i = 0; i < w.overrides.length; i++) {
      var rule = w.overrides[i];
      if (!rule || !rule.when || !rule.set) continue;
      if (evalWhen(rule.when, haState, haState2)) {
        mergeOverride(out, rule.set);
      }
    }
    return out;
  }

  function mergeOverride(target, set) {
    for (var k in set) {
      if (set.hasOwnProperty(k)) target[k] = set[k];
    }
  }

  // evalWhen / evalConditionGroupOrLeaf / evalCondition all receive haState2 so that
  // conditions can test the secondary entity using source: "state2" or "attribute2".
  function evalWhen(when, haState, haState2) {
    if (!when || !when.conditions || !when.conditions.length) return false;
    var logic = when.logic === 'any' ? 'any' : 'all';
    var conds = when.conditions;
    for (var i = 0; i < conds.length; i++) {
      var ok = evalConditionGroupOrLeaf(conds[i], haState, haState2);
      if (logic === 'all' && !ok) return false;
      if (logic === 'any' && ok) return true;
    }
    return logic === 'all';
  }

  function evalConditionGroupOrLeaf(cond, haState, haState2) {
    if (!cond) return false;
    if (cond.conditions && cond.logic) {
      return evalWhen(cond, haState, haState2);
    }
    return evalCondition(cond, haState, haState2);
  }

  // Condition source values:
  //   "state"      (default) - haState.state          (primary entity)
  //   "attribute"            - haState.attributes[x]  (primary entity attribute)
  //   "state2"               - haState2.state          (secondary entity, requires entity2)
  //   "attribute2"           - haState2.attributes[x]  (secondary entity attribute)
  //   "page"                - current page id (non-overlay page number)
  function evalCondition(cond, haState, haState2) {
    if (!cond) return false;
    var src = cond.source || 'state';

    if (src === 'page') {
      var pageNum = parseFloat(currentPage);
      var pageStr = String(currentPage);
      switch (cond.type) {
        case 'above':      return (!isNaN(pageNum) && pageNum > cond.value);
        case 'below':      return (!isNaN(pageNum) && pageNum < cond.value);
        case 'equals':     return (pageStr === String(cond.value));
        case 'not_equals': return (pageStr !== String(cond.value));
        default:           return false;
      }
    }

    // Determine which state object to test against
    var useSecondary = (src === 'state2' || src === 'attribute2');
    var targetState = useSecondary ? haState2 : haState;
    if (!targetState) return false;  // entity2 not configured or not yet received

    var val;
    if (src === 'attribute' || src === 'attribute2') {
      val = (targetState.attributes && cond.attribute !== undefined)
        ? targetState.attributes[cond.attribute]
        : undefined;
      if (val === undefined || val === null) return false;
      val = String(val);
    } else {
      val = targetState.state;
    }
    var num = parseFloat(val);
    var str = String(val);
    switch (cond.type) {
      case 'above':      return (!isNaN(num) && num > cond.value);
      case 'below':      return (!isNaN(num) && num < cond.value);
      case 'equals':     return (str === String(cond.value));
      case 'not_equals': return (str !== String(cond.value));
      default:           return false;
    }
  }

  // ---- Icon rendering -------------------------------------
  // Use [mdi:icon-name] in any text string. Emits:
  //   <span class="mdi mdi-icon-name"></span>
  // MDI's own CSS (fonts/materialdesignicons.css) handles the rest.
  // No mapping table - any valid MDI name just works.
  // Find icons at: https://pictogrammers.com/library/mdi/

  // Decode HTML entities in config text strings.
  // Supports &nbsp; (non-breaking space for icon gaps) and common entities.
  function decodeEntities(str) {
    return str
      .replace(/&nbsp;/g,  '\u00A0')
      .replace(/&amp;/g,   '&')
      .replace(/&lt;/g,    '<')
      .replace(/&gt;/g,    '>')
      .replace(/&quot;/g,  '"');
  }

  function setContent(el, str) {
    if (!str) { el.textContent = ''; return; }

    var re = /\[mdi:([\w-]+)\]|\[small:([^\]]+)\]/g;
    var m  = re.exec(str);
    if (!m) { el.textContent = decodeEntities(str); return; }  // plain text - fast path

    // Split string into text, icon, and small-unit segments, preserving all whitespace.
    // Spacing is entirely the user's responsibility - put spaces in the
    // config text where you want them e.g. "[mdi:home] Living Room"
    el.textContent = '';
    var last = 0;
    do {
      if (m.index > last) {
        el.appendChild(document.createTextNode(decodeEntities(str.slice(last, m.index))));
      }
      if (m[1] !== undefined) {
        var span = document.createElement('span');
        span.className = 'mdi mdi-' + m[1];
        el.appendChild(span);
      } else {
        var small = document.createElement('span');
        small.style.fontSize = '0.6em';
        small.style.alignSelf = 'flex-start';
        small.textContent = m[2];
        el.appendChild(small);
      }
      last = m.index + m[0].length;
    } while ((m = re.exec(str)) !== null);

    if (last < str.length) {
      el.appendChild(document.createTextNode(decodeEntities(str.slice(last))));
    }
  }

  // ---- Theme / color resolution ----------------------------
  function resolveColor(token) {
    if (!token) return 'transparent';
    // If it starts with # or rgb it's a literal color value
    if (token.charAt(0) === '#' || token.indexOf('rgb') === 0) return token;
    if (token === 'transparent') return 'transparent';
    // Otherwise treat as a theme color token
    var colors = (config && config.theme && config.theme.colors) ? config.theme.colors : {};
    return colors[token] || token;
  }

  function clampPct(p, fallback) {
    var n = parseFloat(p);
    if (isNaN(n)) n = fallback;
    if (n < 0) n = 0;
    if (n > 100) n = 100;
    return n;
  }

  function resolveLinearGradient(grad) {
    if (!grad || typeof grad !== 'object') return '';
    var from = resolveColor(grad.from !== undefined ? grad.from : 'transparent');
    var to = resolveColor(grad.to !== undefined ? grad.to : 'surface2');
    var angle = parseFloat(grad.angle);
    if (isNaN(angle)) angle = 180;

    var startPct = clampPct(grad.start_pct, 60);
    var endPct = clampPct(grad.end_pct, 100);
    if (endPct < startPct) endPct = startPct;

    return 'linear-gradient(' + angle + 'deg, ' +
      from + ' ' + startPct + '%, ' +
      to + ' ' + endPct + '%)';
  }

  // ---- Entity subscription ----------------------------------
  function registerEntityCallback(entityId, callback) {
    if (!entityCallbacks[entityId]) {
      entityCallbacks[entityId] = [];
    }
    entityCallbacks[entityId].push(callback);

    // If we already have a cached state, call back immediately
    if (entityStates[entityId]) {
      callback(entityStates[entityId]);
    }
  }

  function updateInternalEntity(entityId, state) {
    var now = (new Date()).toISOString();
    var obj = {
      entity_id: entityId,
      state: state,
      attributes: {
        friendly_name: entityId
      },
      last_changed: now,
      last_updated: now
    };
    entityStates[entityId] = obj;
    if (entityCallbacks[entityId]) {
      var cbs = entityCallbacks[entityId];
      for (var i = 0; i < cbs.length; i++) cbs[i](obj);
    }
    if (page0Callbacks[entityId]) {
      var p0cbs = page0Callbacks[entityId];
      for (var p0 = 0; p0 < p0cbs.length; p0++) p0cbs[p0](obj);
    }
  }

  function subscribeToPageEntities(pageConfig) {
    // Collect unique entity IDs referenced on this page
    // including camera-specific fields
    var entities = {};
    for (var i = 0; i < pageConfig.widgets.length; i++) {
      var w = pageConfig.widgets[i];
      if (w.entity)          entities[w.entity]          = true;
      if (w.entity2)         entities[w.entity2]         = true;  // secondary entity
      if (w.snapshot_entity) entities[w.snapshot_entity] = true;
      if (w.stream_entity)   entities[w.stream_entity]   = true;
    }

    // If WS is ready, subscribe to state_changed for these entities
    if (ws && ws.readyState === 1) {
      subscribeStateChanged();
      // Fetch current states for all referenced entities
      for (var entityId in entities) {
        if (entities.hasOwnProperty(entityId)) {
          fetchEntityState(entityId);
        }
      }
    }
  }

  function fetchEntityState(entityId) {
    // Fetch a single entity's current state via REST - avoids re-fetching all states
    var url = haUrl + '/api/states/' + entityId;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.setRequestHeader('Authorization', 'Bearer ' + haToken);
    xhr.onload = function() {
      if (xhr.status === 200) {
        try {
          var state = JSON.parse(xhr.responseText);
          entityStates[state.entity_id] = state;
          if (entityCallbacks[state.entity_id]) {
            var cbs = entityCallbacks[state.entity_id];
            for (var i = 0; i < cbs.length; i++) cbs[i](state);
          }
        } catch(e) {}
      }
    };
    xhr.send();
  }

  // ---- WebSocket connection ---------------------------------
  function connectWebSocket() {
    setConnStatus('connecting');

    var wsUrl = haUrl.replace(/^http/, 'ws') + '/api/websocket';

    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      setConnStatus('disconnected');
      scheduleReconnect();
      return;
    }

    ws.onopen = function () {
      // HA WS protocol: first message is auth_required
    };

    ws.onmessage = function (evt) {
      var msg;
      try { msg = JSON.parse(evt.data); } catch (e) { return; }
      handleWsMessage(msg);
    };

    ws.onerror = function () {
      setConnStatus('disconnected');
    };

    ws.onclose = function () {
      setConnStatus('disconnected');
      scheduleReconnect();
    };
  }

    // Safe WebSocket send - never throws even if socket is closing
  function wsSend(payload) {
    try {
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify(payload));
      }
    } catch(e) {
      console.warn('HAven: wsSend failed:', e.message);
    }
  }

  function handleWsMessage(msg) {
    switch (msg.type) {
      case 'auth_required':
        console.log('HAven: authenticating, token length:', haToken.length);
        wsSend({ type: 'auth', access_token: haToken });
        break;

      case 'auth_ok':
        setConnStatus('connected');
        fetchAllStates();
        subscribeStateChanged();
        subscribeHavenCommand();
        break;

      case 'auth_invalid':
        // Do NOT clear the token - it may be a stale socket issue
        // Just log and show setup so user can retry
        console.warn('HAven: auth_invalid received');
        setConnStatus('disconnected');
        showSetup();
        break;

      case 'result':
        // Handle camera/stream responses
        if (pendingStreamRequests[msg.id]) {
          var streamCb = pendingStreamRequests[msg.id];
          delete pendingStreamRequests[msg.id];
          streamCb(msg.success ? msg.result : null);
          break;
        }
        if (pendingAgendaRequests[msg.id]) {
          var agendaCb = pendingAgendaRequests[msg.id];
          delete pendingAgendaRequests[msg.id];
          agendaCb(msg.success ? msg.result : null);
          break;
        }
        if (msg.success && msg.result && Array.isArray(msg.result)) {
          // This is the get_states response
          for (var i = 0; i < msg.result.length; i++) {
            var state = msg.result[i];
            entityStates[state.entity_id] = state;
            // Fire callbacks for any widget watching this entity
            if (entityCallbacks[state.entity_id]) {
              var cbs = entityCallbacks[state.entity_id];
              for (var c = 0; c < cbs.length; c++) {
                cbs[c](state);
              }
            }
          }
        }
        break;

      case 'event':
        if (msg.event && msg.event.event_type === 'state_changed') {
          var data    = msg.event.data;
          var entId   = data.entity_id;
          var newState = data.new_state;

          // Update cache
          entityStates[entId] = newState;

          // Fire page 0 callbacks (persistent - always active)
          if (page0Callbacks[entId] && newState) {
            var p0cbs = page0Callbacks[entId];
            for (var p0 = 0; p0 < p0cbs.length; p0++) p0cbs[p0](newState);
          }

          // Fire callbacks for the current page
          if (entityCallbacks[entId] && newState) {
            var callbacks = entityCallbacks[entId];
            for (var j = 0; j < callbacks.length; j++) {
              callbacks[j](newState);
            }
          }
        }
        if (msg.event && msg.event.event_type === 'haven_command') {
          handleHavenCommand(msg.event.data);
        }
        break;
    }
  }

  function fetchAllStates() {
    wsSend({ id: msgId++, type: 'get_states' });
  }

  function subscribeStateChanged() {
    if (wsSubscriptionId) return;
    var id = msgId++;
    wsSubscriptionId = id;
    wsSend({ id: id, type: 'subscribe_events', event_type: 'state_changed' });
  }

  function subscribeHavenCommand() {
    if (wsCommandSubId) return;
    var id = msgId++;
    wsCommandSubId = id;
    wsSend({ id: id, type: 'subscribe_events', event_type: 'haven_command' });
  }

  function handleHavenCommand(data) {
    if (!data) return;
    // Device filter: if the command names a device, ignore it unless it matches ours
    if (data.device && havenDeviceId && data.device !== havenDeviceId) return;

    var action = data.action;

    if (action === 'navigate') {
      var page = parseInt(data.page, 10);
      resetScreensaverTimer();
      if (!isNaN(page)) navigateTo(page);

    } else if (action === 'wake') {
      resetScreensaverTimer();

    } else if (action === 'dim') {
      activateScreensaver();

    } else if (action === 'speak') {
      if (!data.text || !window.speechSynthesis) return;
      // Cancel any current speech before starting new utterance
      window.speechSynthesis.cancel();
      var utt = new SpeechSynthesisUtterance(String(data.text));
      if (data.volume !== undefined) utt.volume = parseFloat(data.volume);
      if (data.rate   !== undefined) utt.rate   = parseFloat(data.rate);
      if (data.pitch  !== undefined) utt.pitch  = parseFloat(data.pitch);
      window.speechSynthesis.speak(utt);
    }
  }

  function callService(serviceDomain, entityId) {
    var parts = serviceDomain.split('.');
    wsSend({ id: msgId++, type: 'call_service', domain: parts[0], service: parts[1], target: { entity_id: entityId } });
  }

  // Handle any action type - service call, page navigation, or automation trigger
  function handleAction(action, dynamicValue, tokenMap) {
    if (!action) return;

    // Support legacy format: { service, entity_id } with no type field
    var type = action.type || 'service';

    if (type === 'navigate') {
      var targetPage = resolveNavigatePage(action);
      if (targetPage !== null) navigateTo(targetPage);
      return;
    }

    if (type === 'automation') {
      wsSend({ id: msgId++, type: 'call_service', domain: 'automation', service: 'trigger',
               target: { entity_id: action.entity_id } });
      return;
    }

    if (type === 'service') {
      var svc = action.service || '';
      var parts = svc.split('.');
      if (parts.length === 2) {
        var payload = { id: msgId++, type: 'call_service', domain: parts[0], service: parts[1] };
        if (action.entity_id) payload.target = { entity_id: action.entity_id };
        if (action.data) {
          var map = {};
          if (tokenMap) {
            for (var tk in tokenMap) {
              if (tokenMap.hasOwnProperty(tk)) map[tk] = tokenMap[tk];
            }
          }
          if (dynamicValue !== undefined) map['$value'] = dynamicValue;
          payload.service_data = injectActionTokens(action.data, map);
        }
        wsSend(payload);
      }
      return;
    }

    // Shorthand: { service: 'domain.service', entity_id: ... } without explicit type
    if (action.service) {
      handleAction({ type: 'service', service: action.service, entity_id: action.entity_id, data: action.data }, dynamicValue, tokenMap);
    }
  }

  // Recursively replace "$value" tokens in action.data for slider service calls.
  // Token replacement is raw-only: "$value" => current numeric slider value.
  function injectActionTokens(node, tokenMap) {
    if (node && typeof node === 'string' && tokenMap && tokenMap[node] !== undefined) return tokenMap[node];

    if (node && Object.prototype.toString.call(node) === '[object Array]') {
      var arr = [];
      for (var i = 0; i < node.length; i++) arr.push(injectActionTokens(node[i], tokenMap));
      return arr;
    }

    if (node && typeof node === 'object') {
      var out = {};
      for (var k in node) {
        if (node.hasOwnProperty(k)) out[k] = injectActionTokens(node[k], tokenMap);
      }
      return out;
    }

    return node;
  }

  // Backward-compatible wrapper for slider token replacement.
  function injectActionValue(node, value) {
    return injectActionTokens(node, { '$value': value });
  }

  function scheduleReconnect() {
    if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
    wsSubscriptionId = null;
    wsCommandSubId   = null;
    wsReconnectTimer = setTimeout(function () {
      connectWebSocket();
    }, 5000);
  }

  // ---- Connection status indicator -------------------------
  function setConnStatus(status) {
    var el = document.getElementById('conn-status');
    el.className = 'conn-' + status;
    updateInternalEntity(INTERNAL_CONN_ENTITY, status);
  }

  // ---- Utility ---------------------------------------------
  function setUrlParam(name, value) {
    var search = window.location.search.substring(1);
    var parts  = search ? search.split('&') : [];
    var found  = false;
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].split('=')[0] === name) {
        parts[i] = name + '=' + value;
        found = true;
        break;
      }
    }
    if (!found) parts.push(name + '=' + value);
    return window.location.pathname + '?' + parts.join('&');
  }

  function getUrlParam(name) {
    var search = window.location.search.substring(1);
    var parts  = search.split('&');
    for (var i = 0; i < parts.length; i++) {
      var pair = parts[i].split('=');
      if (decodeURIComponent(pair[0]) === name) {
        return pair[1] ? decodeURIComponent(pair[1]) : '';
      }
    }
    return null;
  }

  function showFatalError(msg) {
    var canvas = document.getElementById('canvas');
    canvas.innerHTML = '';
    canvas.style.background = '#1a0a0a';
    var err = document.createElement('div');
    err.style.cssText = 'color:#D9534F;padding:20px;font-size:14px;white-space:pre-wrap;';
    err.textContent = '⚠ HAven Error\n\n' + msg;
    canvas.appendChild(err);
  }

  // ---- Start -----------------------------------------------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
