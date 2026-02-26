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
  var entityCallbacks = {};   // entityId -> [callback, ...]
  var entityStates = {};      // entityId -> stateObject (cached)
  var returnTimer = null;
  var clockTimer = null;
  var haUrl = '';
  var haToken = '';

  // ---- Init -------------------------------------------------
  function init() {
    haUrl   = localStorage.getItem('webhash_url')   || '';
    haToken = localStorage.getItem('webhash_token') || '';

    if (!haUrl || !haToken) {
      showSetup();
      return;
    }

    loadConfig();
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

      localStorage.setItem('webhash_url', url);
      localStorage.setItem('webhash_token', token);
      haUrl   = url;
      haToken = token;

      overlay.classList.add('hidden');
      loadConfig();
    });
  }

  // ---- Config loading ---------------------------------------
  function loadConfig() {
    var deviceParam = getUrlParam('device') || 'example';
    var configUrl   = 'devices/' + deviceParam + '.json';

    fetchJson(configUrl, function (err, data) {
      if (err) {
        showFatalError('Could not load device config: ' + configUrl + '\n' + err);
        return;
      }
      config = data;
      setupCanvas();
      setupPageNav();
      renderPage(config.device.default_page || 1);
      connectWebSocket();
      startClock();
    });
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
    var canvas  = document.getElementById('canvas');
    var cw      = config.device.canvas.width;
    var ch      = config.device.canvas.height;
    var scaleX  = window.innerWidth  / cw;
    var scaleY  = window.innerHeight / ch;
    var scale   = Math.min(scaleX, scaleY);

    // Center the scaled canvas
    var scaledW = cw * scale;
    var scaledH = ch * scale;
    var offsetX = (window.innerWidth  - scaledW) / 2;
    var offsetY = (window.innerHeight - scaledH) / 2;

    canvas.style.webkitTransform = 'translate(' + offsetX + 'px,' + offsetY + 'px) scale(' + scale + ')';
    canvas.style.transform       = 'translate(' + offsetX + 'px,' + offsetY + 'px) scale(' + scale + ')';
  }

  // ---- Page rendering ---------------------------------------
  function renderPage(pageId) {
    currentPage = pageId;

    // Clear entity callbacks from previous page
    entityCallbacks = {};

    var canvas  = document.getElementById('canvas');
    canvas.innerHTML = '';

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

  // ---- Widget rendering -------------------------------------
  function renderWidget(w, canvas) {
    var el = document.createElement('div');
    el.id        = 'w-' + w.id;
    el.className = 'widget';
    el.style.left   = w.x + 'px';
    el.style.top    = w.y + 'px';
    el.style.width  = w.w + 'px';
    el.style.height = w.h + 'px';

    switch (w.type) {
      case 'label':  renderLabel(el, w);  break;
      case 'rect':   renderRect(el, w);   break;
      case 'bar':    renderBar(el, w);    break;
      case 'button': renderButton(el, w); break;
      case 'clock':  renderClock(el, w);  break;
      default:
        el.style.background = 'rgba(255,0,0,0.3)';
        el.textContent = 'Unknown: ' + w.type;
    }

    canvas.appendChild(el);
  }

  // -- Label --
  function renderLabel(el, w) {
    el.className += ' widget-label align-' + (w.align || 'left');
    el.style.color      = resolveColor(w.color      || 'text');
    el.style.background = resolveColor(w.background || 'transparent');
    el.style.fontSize   = (w.font_size || config.theme.font_size || 16) + 'px';
    el.style.fontWeight = w.font_weight || '400';
    el.style.padding    = '0 4px';
    el.textContent = w.text || '';

    if (w.entity) {
      registerEntityCallback(w.entity, function (state) {
        updateLabelFromState(el, w, state);
      });
    }
  }

  function updateLabelFromState(el, w, state) {
    var val = state ? state.state : null;

    // Apply text
    el.textContent = formatValue(val, w);

    // Apply state-based color if defined
    var resolvedState = resolveWidgetState(w, state);
    if (resolvedState && resolvedState.color) {
      el.style.color = resolveColor(resolvedState.color);
    } else {
      el.style.color = resolveColor(w.color || 'text');
    }
  }

  // -- Rect --
  function renderRect(el, w) {
    el.className += ' widget-rect';
    el.style.background  = resolveColor(w.background || 'surface');
    el.style.borderRadius = (w.radius !== undefined ? w.radius : 0) + 'px';
  }

  // -- Bar --
  function renderBar(el, w) {
    el.className += ' widget-bar';
    el.style.background   = 'transparent';
    el.style.borderRadius = (w.radius !== undefined ? w.radius : 0) + 'px';
    el.style.overflow     = 'hidden';

    var fill = document.createElement('div');
    fill.className = 'widget-bar-fill';
    fill.style.borderRadius = (w.radius !== undefined ? w.radius : 0) + 'px';
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
    iconEl.textContent  = w.icon_off || '';
    labelEl.textContent = w.label    || '';

    el.appendChild(iconEl);
    el.appendChild(labelEl);

    // Apply initial off-state styling
    applyButtonState(el, iconEl, labelEl, w, 'off');

    if (w.entity) {
      registerEntityCallback(w.entity, function (state) {
        var stateVal = state ? state.state : 'off';
        applyButtonState(el, iconEl, labelEl, w, stateVal);
        iconEl.textContent = (stateVal === 'on' && w.icon_on) ? w.icon_on : (w.icon_off || '');
      });
    }

    if (w.action) {
      el.addEventListener('click', function () {
        callService(w.action.service, w.action.entity_id || w.entity);
        resetReturnTimer();
      });
    }
  }

  function applyButtonState(el, iconEl, labelEl, w, stateKey) {
    var states = w.states || {};
    var s = states[stateKey] || states['default'] || {};

    el.style.background   = resolveColor(s.background || w.background || 'surface2');
    iconEl.style.color    = resolveColor(s.icon_color  || w.icon_color  || 'text');
    labelEl.style.color   = resolveColor(s.label_color || w.label_color || 'text_dim');
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

  // ---- State condition resolution ---------------------------
  function resolveWidgetState(w, haState) {
    if (!w.states || !w.state_condition || !haState) return null;

    var cond = w.state_condition;
    var val  = parseFloat(haState.state);

    if (cond.type === 'above' && !isNaN(val) && val > cond.value) {
      return w.states[cond.state_key] || null;
    }
    if (cond.type === 'below' && !isNaN(val) && val < cond.value) {
      return w.states[cond.state_key] || null;
    }
    if (cond.type === 'equals' && haState.state === String(cond.value)) {
      return w.states[cond.state_key] || null;
    }

    return null;
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

  function subscribeToPageEntities(pageConfig) {
    // Collect unique entity IDs referenced on this page
    var entities = {};
    for (var i = 0; i < pageConfig.widgets.length; i++) {
      var w = pageConfig.widgets[i];
      if (w.entity) entities[w.entity] = true;
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
    if (!ws || ws.readyState !== 1) return;
    var id = msgId++;
    ws.send(JSON.stringify({
      id: id,
      type: 'get_states'
    }));
    // We'll handle the response in onmessage by checking all states
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

  function handleWsMessage(msg) {
    switch (msg.type) {
      case 'auth_required':
        ws.send(JSON.stringify({ type: 'auth', access_token: haToken }));
        break;

      case 'auth_ok':
        setConnStatus('connected');
        // Fetch all states at once then subscribe to changes
        fetchAllStates();
        subscribeStateChanged();
        break;

      case 'auth_invalid':
        setConnStatus('disconnected');
        // Clear stored token so setup screen shows
        localStorage.removeItem('webhash_token');
        showSetup();
        break;

      case 'result':
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

          // Fire callbacks only if this entity is on the current page
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
    var id = msgId++;
    ws.send(JSON.stringify({ id: id, type: 'get_states' }));
  }

  function subscribeStateChanged() {
    if (wsSubscriptionId) return; // Already subscribed
    var id = msgId++;
    wsSubscriptionId = id;
    ws.send(JSON.stringify({
      id: id,
      type: 'subscribe_events',
      event_type: 'state_changed'
    }));
  }

  function callService(serviceDomain, entityId) {
    if (!ws || ws.readyState !== 1) return;
    var parts   = serviceDomain.split('.');
    var domain  = parts[0];
    var service = parts[1];
    ws.send(JSON.stringify({
      id: msgId++,
      type: 'call_service',
      domain: domain,
      service: service,
      target: { entity_id: entityId }
    }));
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
