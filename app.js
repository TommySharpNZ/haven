/* ============================================================
   WebHASP - app.js
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
  var msgId = 1;
  var entityCallbacks = {};        // entityId -> [callback, ...] for current page
  var page0Callbacks  = {};        // entityId -> [callback, ...] persistent (page 0 widgets)
  var pendingStreamRequests = {};  // msgId -> callback for camera/stream responses
  var activePageTimers      = [];  // setInterval IDs to clear on page change
  var entityStates = {};      // entityId -> stateObject (cached)
  var INTERNAL_CONN_ENTITY = 'internal.connectionstatus';
  var INTERNAL_TIME_ENTITY = 'internal.currentdtm';
  var returnTimer = null;
  var clockTimer = null;
  var internalTimeTimer = null;
  var haUrl = '';
  var haToken = '';

  // ---- Init -------------------------------------------------
  function init() {
    haUrl   = localStorage.getItem('webhasp_url')   || '';
    haToken = localStorage.getItem('webhasp_token') || '';

    console.log('WebHASP init: url=' + haUrl + ' tokenLength=' + haToken.length);

    if (!haUrl || !haToken) {
      // No localStorage credentials - try loading config file anyway
      // in case it has ha.url and ha.token defined
      console.log('WebHASP init: no localStorage credentials, checking device config');
      loadConfigForCredentials();
      return;
    }

    console.log('WebHASP init: credentials found, loading config');
    loadConfig();
  }

  // Load config purely to extract credentials if present
  // Falls back to setup screen if config missing or has no credentials
  function loadConfigForCredentials() {
    var deviceParam = getUrlParam('device') || 'default';
    var base        = window.location.pathname.replace(/\/[^\/]*$/, '/');
    var configUrl   = base + 'devices/' + deviceParam + '.json?v=' + (window.WEBHASP_VERSION || Date.now());

    fetchJson(configUrl, function(err, data) {
      if (!err && data && data.ha && data.ha.url && data.ha.token) {
        console.log('WebHASP init: credentials found in device config');
        haUrl   = data.ha.url;
        haToken = data.ha.token;
        // Store in localStorage so subsequent loads are instant
        localStorage.setItem('webhasp_url',   haUrl);
        localStorage.setItem('webhasp_token', haToken);
        loadConfig();
      } else {
        console.log('WebHASP init: no credentials in config, showing setup');
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

    urlInput.value   = haUrl;
    tokenInput.value = haToken;

    saveBtn.addEventListener('click', function () {
      var url   = urlInput.value.trim().replace(/\/$/, '');
      var token = tokenInput.value.trim();
      errorEl.textContent = '';

      if (!url) { errorEl.textContent = 'Please enter your Home Assistant URL.'; return; }
      if (!token) { errorEl.textContent = 'Please enter your access token.'; return; }

      localStorage.setItem('webhasp_url', url);
      localStorage.setItem('webhasp_token', token);

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
      loadConfigFromUrl(base + 'devices/' + deviceParam + '.json?v=' + (window.WEBHASP_VERSION || Date.now()), deviceParam);
    } else {
      // No device specified - try default.json, fall back to landing page
      console.log('WebHASP: no device specified, trying default.json');
      fetchJson(base + 'devices/default.json?v=' + (window.WEBHASP_VERSION || Date.now()), function(err, data) {
        if (!err && data) {
          console.log('WebHASP: default.json found, loading');
          applyConfig(data);
        } else {
          console.log('WebHASP: no default.json found, showing landing page');
          showLandingPage(base);
        }
      });
    }
  }

  function loadConfigFromUrl(configUrl, deviceParam) {
    console.log('WebHASP loadConfig: fetching ' + configUrl);
    fetchJson(configUrl, function (err, data) {
      if (err) {
        showFatalError('Could not load device config: devices/' + deviceParam + '.json\n' + err);
        return;
      }
      applyConfig(data);
    });
  }

  function applyConfig(data) {
    console.log('WebHASP loadConfig: success, hiding setup overlay');
    var overlay = document.getElementById('setup-overlay');
    if (overlay) overlay.classList.add('hidden');
    config = data;
    setupCanvas();
    setupPageNav();
    renderPage0();   // persistent overlay - renders once, never cleared
    renderPage(config.device.default_page || 1);
    connectWebSocket();
    startClock();
    startInternalTime();
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
      '  <div class="landing-logo">WebHASP</div>',
      '  <div class="landing-tagline">Browser-based Home Assistant Dashboard</div>',
      '  <div class="landing-divider"></div>',
      '  <div class="landing-section">',
      '    <div class="landing-label">No device specified</div>',
      '    <div class="landing-hint">Access your dashboard using a <code>?device=</code> URL parameter:</div>',
      '    <div class="landing-example">index.html?device=<em>your-device-name</em></div>',
      '  </div>',
      '  <div class="landing-section">',
      '    <div class="landing-label">Device configs live here</div>',
      '    <div class="landing-hint"><code>config/www/webhasp/devices/your-device-name.json</code></div>',
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
    var els = overlay.querySelectorAll('.widget-button, .widget-image');
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
      // Relative paths resolved against webhasp root
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
    for (var w = 0; w < pageConfig.widgets.length; w++) {
      renderWidget(pageConfig.widgets[w], canvas);
    }

    // Re-attach page 0 overlay on top
    if (page0) {
      canvas.appendChild(page0);
    }

    // Re-subscribe to relevant entities for this page
    subscribeToPageEntities(pageConfig);

    // Update page nav dots
    updatePageNav(pageId);

    // Reset return-to-default timer on page change
    resetReturnTimer();
  }

  // ---- Page navigation --------------------------------------
  function setupPageNav() {
    var nav = document.getElementById('page-nav');
    nav.innerHTML = '';

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

    setupSwipeNav();
  }

  // ---- Swipe gesture navigation ----------------------------
  function setupSwipeNav() {
    var canvas  = document.getElementById('canvas');
    var touchStartX = 0;
    var touchStartY = 0;
    var touchStartTime = 0;

    // Any touch or click anywhere on the canvas resets the return timer
    canvas.addEventListener('touchstart', function(e) {
      resetReturnTimer();
      touchStartX    = e.touches[0].clientX;
      touchStartY    = e.touches[0].clientY;
      touchStartTime = Date.now();
    }, { passive: true });

    canvas.addEventListener('mousedown', function() {
      resetReturnTimer();
    });

    canvas.addEventListener('touchend', function(e) {
      var dx   = e.changedTouches[0].clientX - touchStartX;
      var dy   = e.changedTouches[0].clientY - touchStartY;
      var dt   = Date.now() - touchStartTime;
      var adx  = Math.abs(dx);
      var ady  = Math.abs(dy);

      // Must be: horizontal, fast enough, long enough, not mostly vertical
      if (dt > 500)  return;  // too slow - probably a press not a swipe
      if (adx < 50)  return;  // too short
      if (ady > adx) return;  // more vertical than horizontal - ignore

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
  }

  function updatePageNav(pageId) {
    var dots = document.querySelectorAll('.page-dot');
    for (var i = 0; i < dots.length; i++) {
      var dot = dots[i];
      if (parseInt(dot.getAttribute('data-page'), 10) === pageId) {
        dot.className = 'page-dot active';
      } else {
        dot.className = 'page-dot';
      }
    }
  }

  function navigateTo(pageId) {
    if (pageId === currentPage) return;
    if (pageId === 0) return;  // page 0 is a persistent overlay, not navigable
    renderPage(pageId);
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
  function renderWidget(w, canvas) {
    var el = document.createElement('div');
    el.id        = 'w-' + w.id;
    el.className = 'widget';
    el.style.left   = w.x + 'px';
    el.style.top    = w.y + 'px';
    el.style.width  = w.w + 'px';
    el.style.height = w.h + 'px';

    // Apply base opacity if specified
    if (w.opacity !== undefined) {
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
      case 'label':        renderLabel(el, w);       break;
      case 'rect':         renderRectangle(el, w);   break;
      case 'rectangle':    renderRectangle(el, w);   break;
      case 'bar':          renderBar(el, w);          break;
      case 'button':       renderButton(el, w);       break;
      case 'clock':        renderClock(el, w);        break;
      case 'image':        renderImage(el, w);        break;
      case 'camera':       renderCamera(el, w);       break;
      case 'arc':          renderArc(el, w);          break;
      default:
        el.style.background = 'rgba(255,0,0,0.3)';
        el.textContent = 'Unknown: ' + w.type;
    }

    // Visibility condition - hide widget based on entity state
    if (w.visible) {
      applyVisibility(el, w);
      if (w.visible.entity) {
        registerEntityCallback(w.visible.entity, function(state) {
          applyVisibility(el, w, state);
        });
      }
    }

    canvas.appendChild(el);
  }

  function applyVisibility(el, w, state) {
    var v = w.visible;
    var entityState = state || entityStates[v.entity];
    var val = entityState ? parseFloat(entityState.state) : null;
    var strVal = entityState ? entityState.state : null;
    var visible = true;

    if (v.type === 'above')  visible = (val !== null && val > v.value);
    if (v.type === 'below')  visible = (val !== null && val < v.value);
    if (v.type === 'equals') visible = (strVal === String(v.value));
    if (v.type === 'not_equals') visible = (strVal !== String(v.value));

    el.style.display = visible ? '' : 'none';
  }

  // -- Label --
  function renderLabel(el, w) {
    el.className += ' widget-label align-' + (w.align || 'left');
    el.style.color          = resolveColor(w.color      || 'text');
    el.style.background     = resolveColor(w.background || 'transparent');
    el.style.fontSize       = (w.font_size || config.theme.font_size || 16) + 'px';
    el.style.fontWeight     = w.font_weight || '400';
    el.style.padding        = '0 4px';
    if (w.letter_spacing !== undefined) el.style.letterSpacing = w.letter_spacing + 'px';
    if (w.opacity !== undefined)        el.style.opacity       = w.opacity;
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

    if (w.entity) {
      registerEntityCallback(w.entity, function (state) {
        updateLabelFromState(el, w, state);
      });
    }
  }

  function updateLabelFromState(el, w, state) {
    var val = state ? state.state : null;

    // Apply text - handles plain text and [fa-name] icon tokens
    var resolvedState = resolveWidgetState(w, state);
    var s = resolvedState || {};
    var textOverride = (s.text !== undefined) ? String(s.text) : null;
    var useTemplateText = (w.text && hasTemplate(w.text));
    var baseText = useTemplateText ? String(w.text) : (textOverride !== null ? textOverride : formatValue(val, w));
    var formatted = applyTemplate(baseText, state);
    if (formatted.length === 1 && formatted.charCodeAt(0) >= 0xF000 && formatted.charCodeAt(0) <= 0xF8FF) {
      el.style.fontFamily = 'FontAwesome';
      setContent(el, formatted);
    } else {
      el.textContent = '';
      setContent(el, formatted);
    }

    // Apply state-based styles
    var colorToken = s.color || w.color || 'text';
    colorToken = applyTemplate(colorToken, state);
    el.style.color   = resolveColor(colorToken);
    if (s.opacity   !== undefined) el.style.opacity       = s.opacity;
    if (s.letter_spacing !== undefined) el.style.letterSpacing = s.letter_spacing + 'px';
  }

  // -- Rectangle --
  function renderRectangle(el, w) {
    el.className += ' widget-rectangle';
    el.style.borderRadius = (w.radius !== undefined ? w.radius : 0) + 'px';
    el.style.background   = resolveColor(w.background || 'surface');

    // If no action, pass pointer events through so taps reach widgets below
    if (!w.action) {
      el.style.pointerEvents = 'none';
    } else {
      el.style.pointerEvents = 'auto';
      el.style.cursor = 'pointer';

      // Apply initial state styling
      if (w.entity && w.states) {
        var currentState = entityStates[w.entity];
        if (currentState) {
          applyRectangleState(el, w, currentState.state);
        }
      }

      // Register entity callback for state-based styling
      if (w.entity) {
        registerEntityCallback(w.entity, function(state) {
          applyRectangleState(el, w, state ? state.state : null);
        });
      }

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

  function applyRectangleState(el, w, stateVal) {
    var states = w.states || {};
    var s = states[stateVal] || states['default'] || {};
    el.style.background = resolveColor(s.background || w.background || 'surface');
    if (s.opacity      !== undefined) el.style.opacity     = s.opacity;
    if (s.border_color !== undefined) el.style.borderColor = resolveColor(s.border_color);
    if (s.border_width !== undefined) {
      el.style.borderWidth = s.border_width + 'px';
      el.style.borderStyle = 'solid';
      el.style.boxSizing   = 'border-box';
    }
  }

  // -- Bar --
  function renderBar(el, w) {
    el.className += ' widget-bar';
    var radius = (w.radius !== undefined ? w.radius : 0) + 'px';

    // Track (background) - built into the widget, no separate rect needed
    el.style.background   = resolveColor(w.track_color || 'surface2');
    el.style.borderRadius = radius;
    el.style.overflow     = 'hidden';

    var fill = document.createElement('div');
    fill.className = 'widget-bar-fill';
    fill.style.borderRadius = radius;
    fill.style.background   = '#008000';
    el.appendChild(fill);

    if (w.entity) {
      registerEntityCallback(w.entity, function (state) {
        updateBarFromState(fill, w, state);
      });
    }
  }

  function updateBarFromState(fill, w, state) {
    var val = state ? parseFloat(state.state) : 0;
    if (isNaN(val)) val = 0;

    var max      = w.max || 100;
    var pct      = Math.max(0, Math.min(100, (val / max) * 100));
    fill.style.width = pct + '%';

    // Threshold color
    var color = '#008000';
    if (w.thresholds) {
      var normalizedPct = pct;
      for (var i = 0; i < w.thresholds.length; i++) {
        var t = w.thresholds[i];
        if (t['default']) {
          color = t.color;
        } else if (t.below !== undefined && normalizedPct <= t.below) {
          color = t.color;
          break;
        }
      }
    }
    fill.style.background = color;
  }

  // -- Button --
  function renderButton(el, w) {
    el.className += ' widget-button';

    var iconEl  = document.createElement('div');
    var labelEl = document.createElement('div');
    iconEl.className  = 'btn-icon';
    labelEl.className = 'btn-label';

    // setButtonIcon resolves [fa-name] tokens or raw FA codepoints
    function setButtonIcon(icon) {
      setContent(iconEl, icon || '');
    }

    setButtonIcon(w.icon_off || '');
    labelEl.textContent = w.label || '';

    el.appendChild(iconEl);
    el.appendChild(labelEl);

    // Apply initial off-state styling
    applyButtonState(el, iconEl, labelEl, w, 'off');

    if (w.entity) {
      registerEntityCallback(w.entity, function (state) {
        var stateVal = state ? state.state : 'off';
        applyButtonState(el, iconEl, labelEl, w, stateVal);
        setButtonIcon((stateVal === 'on' && w.icon_on) ? w.icon_on : (w.icon_off || ''));
      });
    }

    if (w.action) {
      el.addEventListener('click', function () {
        handleAction(w.action);
        resetReturnTimer();
      });
      el.style.cursor = 'pointer';
      el.addEventListener('mousedown',  function() { el.style.opacity = '0.75'; });
      el.addEventListener('mouseup',    function() { el.style.opacity = '1'; });
      el.addEventListener('mouseleave', function() { el.style.opacity = '1'; });
      el.addEventListener('touchstart', function() { el.style.opacity = '0.75'; }, { passive: true });
      el.addEventListener('touchend',   function() { el.style.opacity = '1'; });
    }
  }

  function applyButtonState(el, iconEl, labelEl, w, stateKey) {
    var states = w.states || {};
    var s = states[stateKey] || states['default'] || {};

    el.style.background   = resolveColor(s.background || w.background || 'surface2');
    iconEl.style.color    = resolveColor(s.icon_color  || w.icon_color  || 'text');
    labelEl.style.color   = resolveColor(s.label_color || w.label_color || 'text_dim');
  }

  // ---- Arc / gauge widget ----------------------------------
  // SVG-based circular arc gauge. Driven by a numeric HA entity.
  //
  // Config:
  //   entity        - HA entity providing the numeric value
  //   min           - value at start of arc (default 0)
  //   max           - value at end of arc (default 100)
  //   start_angle   - degrees, 0 = top, clockwise (default 135)
  //   end_angle     - degrees (default 405, i.e. 135 + 270)
  //   line_width    - arc stroke width in px (default 12)
  //   track_color   - background arc color (default surface2 token)
  //   label         - static text shown below the value (optional)
  //   format        - value format (same as label widget)
  //   thresholds    - same format as bar widget, color changes by % of range
  //
  // Example:
  //   { "type": "arc", "x": 100, "y": 100, "w": 160, "h": 160,
  //     "entity": "sensor.battery_state_of_charge",
  //     "min": 0, "max": 100,
  //     "start_angle": 135, "end_angle": 405,
  //     "line_width": 14,
  //     "thresholds": [
  //       { "below": 20, "color": "danger" },
  //       { "below": 50, "color": "warning" },
  //       { "default": true, "color": "primary" }
  //     ],
  //     "label": "Battery" }

  function renderArc(el, w) {
    el.className += ' widget-arc';
    el.style.overflow = 'visible';

    var min        = w.min !== undefined ? w.min : 0;
    var max        = w.max !== undefined ? w.max : 100;
    var startAngle = w.start_angle !== undefined ? w.start_angle : 135;
    var endAngle   = w.end_angle   !== undefined ? w.end_angle   : 405;
    var lineWidth  = w.line_width  !== undefined ? w.line_width  : 12;
    var trackColor = resolveColor(w.track_color || 'surface2');

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

    if (w.label) {
      var lblEl = document.createElement('div');
      lblEl.style.cssText = 'font-size:' + Math.round(size * 0.11) + 'px;margin-top:4px;color:' + resolveColor(w.label_color || 'text_muted') + ';';
      setContent(lblEl, w.label);
      valueEl.appendChild(lblEl);
    }

    el.appendChild(valueEl);

    // Update function - called on entity state change
    function updateArc(state) {
      if (!state) return;
      var raw = parseFloat(state.state);
      if (isNaN(raw)) { numEl.textContent = state.state; return; }

      var val     = Math.max(min, Math.min(max, raw));
      var pct     = (val - min) / (max - min);
      var fillEnd = startAngle + pct * (endAngle - startAngle);

      // Determine color from thresholds
      var arcColor = resolveColor(w.color || 'primary');
      if (w.thresholds) {
        var pctInt = Math.round(pct * 100);
        for (var t = 0; t < w.thresholds.length; t++) {
          var th = w.thresholds[t];
          if (th.default || pctInt < th.below) {
            arcColor = resolveColor(th.color);
            break;
          }
        }
      }

      valuePath.setAttribute('stroke', arcColor);
      if (pct <= 0) {
        valuePath.setAttribute('d', '');
      } else if (pct >= 1) {
        // Full arc - draw as track to avoid path calculation edge case
        valuePath.setAttribute('d', describeArc(cx, cy, r, startAngle, endAngle - 0.01));
      } else {
        valuePath.setAttribute('d', describeArc(cx, cy, r, startAngle, fillEnd));
      }

      numEl.textContent = formatValue(state.state, w);
      numEl.style.color = arcColor;
    }

    if (w.entity) {
      registerEntityCallback(w.entity, updateArc);
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
    el.style.borderRadius = (w.radius !== undefined ? w.radius : 0) + 'px';
    el.style.background   = '#000';
    el.style.cursor       = w.fullscreen_on_tap ? 'pointer' : 'default';

    var img = document.createElement('img');
    img.style.width     = '100%';
    img.style.height    = '100%';
    img.style.objectFit = w.fit || 'cover';
    img.style.display   = 'block';
    img.src = w.url || '';
    el.appendChild(img);

    if (w.fullscreen_on_tap) {
      el.addEventListener('click', function() {
        openFullscreenImage(w.url, null);
      });
    }
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
      renderCameraSnapshot(el, w, snapshotEntity, w.refresh_interval || 3000);
    } else if (preview === 'poster') {
      renderCameraSnapshot(el, w, snapshotEntity, w.refresh_interval || 60000, true);
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
    loader.className   = 'camera-loader';
    loader.textContent = '';
    el.appendChild(loader);

    // Request a signed MJPEG stream URL - one sign per session, stream stays open
    var path = '/api/camera_proxy_stream/' + entity;
    requestSignedUrl(path, 3600, function(url) {
      if (!url) { loader.textContent = ''; return; }
      img.onload = function() { loader.style.display = 'none'; };
      img.onerror = function() { loader.textContent = ''; };
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
    loader.className   = 'camera-loader';
    loader.textContent = '';
    el.appendChild(loader);

    if (showPlayButton) {
      var playBtn = document.createElement('div');
      playBtn.className = 'camera-play-btn';
      playBtn.textContent = '';  // FA play-circle
      el.appendChild(playBtn);
    }

    var active = true;
    var pendingSignIds = [];

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
          fetchEntityState(entity);
        }
        var path   = '/api/camera_proxy/' + entity;
        var ttl    = Math.ceil(interval / 1000) + 5;
        var signId = requestSignedUrl(path, ttl, function(signedUrl) {
          var i = pendingSignIds.indexOf(signId);
          if (i !== -1) pendingSignIds.splice(i, 1);
          if (!signedUrl || !active) return;
          var fb = new Image();
          fb.onload = function() { if (!active) return; img.src = fb.src; loader.style.display = 'none'; };
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
    loader.className   = 'camera-loader';
    loader.textContent = '';
    el.appendChild(img);
    el.appendChild(loader);

    var url = w.url || '';

    img.onload  = function() { loader.style.display = 'none'; };
    img.onerror = function() {
      loader.style.display = 'flex';
      loader.textContent   = '';  // warning - likely cert or mixed content
    };

    var active = true;
    var doFetch = function() {
      if (!active) return;
      // Always bust cache - the rs= param in Reolink URLs isn't enough
      img.src = url + (url.indexOf('?') !== -1 ? '&' : '?') + '_t=' + Date.now();
    };

    doFetch();

    if (w.refresh_interval) {
      var timer = setInterval(doFetch, w.refresh_interval);
      activePageTimers.push({ id: timer, stop: function() { active = false; } });
    }

    if (w.preview === 'poster') {
      var playBtn = document.createElement('div');
      playBtn.className   = 'camera-play-btn';
      playBtn.textContent = '';
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
    loader.className   = 'camera-loader';
    loader.textContent = '';
    loader.style.position = 'relative';
    loader.style.width    = '100%';
    loader.style.height   = '100%';
    overlay.content.appendChild(loader);
    document.body.appendChild(overlay.el);

    var streamMsgId = msgId++;
    pendingStreamRequests[streamMsgId] = function(result) {
      if (!result || !result.url) {
        loader.textContent = '';
        return;
      }
      var streamUrl = haUrl + result.url;
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
        video.play().catch(function() {
          video.muted = true;
          video.play();
        });
      }

      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS - Safari and iOS
        video.src = streamUrl;
        startPlayback();
      } else if (window.Hls && window.Hls.isSupported()) {
        var hls = new window.Hls();
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hls.on(window.Hls.Events.MANIFEST_PARSED, startPlayback);
        overlay.el.addEventListener('overlay-close', function() { hls.destroy(); });
      } else {
        // Load HLS.js dynamically - only fetched once then cached by browser
        var script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.4.12/hls.min.js';
        script.onload = function() {
          if (window.Hls.isSupported()) {
            var hls = new window.Hls();
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            hls.on(window.Hls.Events.MANIFEST_PARSED, startPlayback);
            overlay.el.addEventListener('overlay-close', function() { hls.destroy(); });
          } else {
            loader.textContent = '';
            loader.style.display = 'flex';
          }
        };
        script.onerror = function() {
          loader.textContent = '';
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
    closeBtn.textContent      = '';
    closeBtn.style.fontFamily = 'FontAwesome';
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
          ? Math.round(num) + ' w'
          : (num / 1000).toFixed(2) + ' kW';

      case 'power_abs':
        if (isNaN(num)) return '--';
        num = Math.abs(num);
        return num < 1000
          ? Math.round(num) + ' w'
          : (num / 1000).toFixed(2) + ' kW';

      case 'power_prefix':
        if (isNaN(num)) return prefix + '--';
        return prefix + (num < 1000
          ? Math.round(num) + ' w'
          : (num / 1000).toFixed(2) + ' kW');

      case 'kwh':
        if (isNaN(num)) return '--';
        return num.toFixed(1) + ' kWh';

      case 'percent':
        if (isNaN(num)) return '--%';
        return Math.round(num) + '%';

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

  function applyTemplate(str, state) {
    if (!str) return '';
    var s = String(str);
    if (s.indexOf('{{') === -1) return s;

    return s.replace(/\{\{([\s\S]*?)\}\}/g, function(_, expr) {
      var val = evaluateExpression(expr, state);
      if (val === null || val === undefined) return '';
      return String(val);
    });
  }

  function evaluateExpression(expr, state) {
    var key = String(expr).trim();
    if (!key) return '';

    var fn = templateExprCache[key];
    if (!fn) {
      try {
        fn = new Function(
          'state', 'state_str', 'attr', 'round', 'min', 'max', 'abs', 'floor', 'ceil',
          '"use strict"; return (' + key + ');'
        );
      } catch (e) {
        templateExprCache[key] = null;
        return '';
      }
      templateExprCache[key] = fn;
    }
    if (!fn) return '';

    var raw = state ? state.state : null;
    var num = parseFloat(raw);
    var stateVal = (!isNaN(num) ? num : raw);
    var stateStr = (raw !== null && raw !== undefined) ? String(raw) : '';
    var attrs = state && state.attributes ? state.attributes : {};

    try {
      return fn(stateVal, stateStr, attrs, tmplRound, Math.min, Math.max, Math.abs, Math.floor, Math.ceil);
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

  // ---- State condition resolution ---------------------------
  // Evaluate a single condition object against a HA state value.
  // Returns the matching states entry or null.
  function evalCondition(cond, haState) {
    if (!cond || !haState) return null;
    var num = parseFloat(haState.state);
    var str = haState.state;
    switch (cond.type) {
      case 'above':      return (!isNaN(num) && num > cond.value)       ? cond.state_key : null;
      case 'below':      return (!isNaN(num) && num < cond.value)       ? cond.state_key : null;
      case 'equals':     return (str === String(cond.value))            ? cond.state_key : null;
      case 'not_equals': return (str !== String(cond.value))            ? cond.state_key : null;
      default:           return null;
    }
  }

  // Resolve which named state applies given the current HA entity state.
  // state_condition can be a single condition object OR an array of conditions
  // evaluated in order - first match wins.
  //
  // Single condition (legacy, still supported):
  //   "state_condition": { "type": "above", "value": 0, "state_key": "active" }
  //
  // Multiple conditions (new - first match wins, like CSS):
  //   "state_condition": [
  //     { "type": "below", "value": 20, "state_key": "low" },
  //     { "type": "below", "value": 50, "state_key": "medium" },
  //     { "type": "above", "value": 50, "state_key": "ok" }
  //   ]
  function resolveWidgetState(w, haState) {
    if (!w.states || !w.state_condition || !haState) return null;

    var conditions = Array.isArray(w.state_condition)
      ? w.state_condition
      : [w.state_condition];

    for (var i = 0; i < conditions.length; i++) {
      var key = evalCondition(conditions[i], haState);
      if (key && w.states[key]) return w.states[key];
    }

    return null;
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

    var re = /\[mdi:([\w-]+)\]/g;
    var m  = re.exec(str);
    if (!m) { el.textContent = decodeEntities(str); return; }  // plain text - fast path

    // Split string into text and icon segments, preserving all whitespace.
    // Spacing is entirely the user's responsibility - put spaces in the
    // config text where you want them e.g. "[mdi:home] Living Room"
    el.textContent = '';
    var last = 0;
    do {
      if (m.index > last) {
        el.appendChild(document.createTextNode(decodeEntities(str.slice(last, m.index))));
      }
      var span = document.createElement('span');
      span.className = 'mdi mdi-' + m[1];
      el.appendChild(span);
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
      if (w.snapshot_entity) entities[w.snapshot_entity] = true;
      if (w.stream_entity)   entities[w.stream_entity]   = true;
      if (w.visible && w.visible.entity) entities[w.visible.entity] = true;
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
      console.warn('WebHASP: wsSend failed:', e.message);
    }
  }

  function handleWsMessage(msg) {
    console.log('WebHASP WS:', msg.type);
    switch (msg.type) {
      case 'auth_required':
        console.log('WebHASP: authenticating, token length:', haToken.length);
        wsSend({ type: 'auth', access_token: haToken });
        break;

      case 'auth_ok':
        setConnStatus('connected');
        fetchAllStates();
        subscribeStateChanged();
        break;

      case 'auth_invalid':
        // Do NOT clear the token - it may be a stale socket issue
        // Just log and show setup so user can retry
        console.warn('WebHASP: auth_invalid received');
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

  function callService(serviceDomain, entityId) {
    var parts = serviceDomain.split('.');
    wsSend({ id: msgId++, type: 'call_service', domain: parts[0], service: parts[1], target: { entity_id: entityId } });
  }

  // Handle any action type - service call, page navigation, or automation trigger
  function handleAction(action) {
    if (!action) return;

    // Support legacy format: { service, entity_id } with no type field
    var type = action.type || 'service';

    if (type === 'navigate') {
      navigateTo(action.page);
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
        if (action.data)      payload.service_data = action.data;
        wsSend(payload);
      }
      return;
    }

    // Shorthand: { service: 'domain.service', entity_id: ... } without explicit type
    if (action.service) {
      handleAction({ type: 'service', service: action.service, entity_id: action.entity_id, data: action.data });
    }
  }

  function scheduleReconnect() {
    if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
    wsSubscriptionId = null;
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
    err.textContent = '⚠ WebHASP Error\n\n' + msg;
    canvas.appendChild(err);
  }

  // ---- Start -----------------------------------------------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
