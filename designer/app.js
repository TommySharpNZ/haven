import { loadDeviceList, getDeviceFromQuery, fetchConfig } from './io.js';
import { createGridLayer, drawGrid } from './grid.js';
import { createWidgetGroup } from './render.js';
import { renderTree } from './tree.js';
import { updateProps } from './selection.js';

var stage;
var gridLayer;
var pageLayer;
var overlayLayer;
var uiLayer;
var transformer;
var guideLayer;
var config;
var currentPageId = 1;
var selectedIds = [];
var hidden = {};
var snapEnabled = true;
var panEnabled = false;
var gridSize = 8;
var undoStack = [];
var redoStack = [];
var MAX_UNDO = 50;

var pickDeviceBtn = document.getElementById('pickDeviceBtn');
var pageSelect = document.getElementById('pageSelect');
var gridSelect = document.getElementById('gridSelect');
var toggleSnap = document.getElementById('toggleSnap');
var togglePan = document.getElementById('togglePan');
var undoBtn = document.getElementById('undoBtn');
var redoBtn = document.getElementById('redoBtn');
var saveBtn = document.getElementById('saveBtn');
var previewBtn = document.getElementById('previewBtn');
var addLabelBtn = document.getElementById('addLabelBtn');
var addRectBtn = document.getElementById('addRectBtn');
var addHGuideBtn = document.getElementById('addHGuideBtn');
var addVGuideBtn = document.getElementById('addVGuideBtn');
var clearGuidesBtn = document.getElementById('clearGuidesBtn');
var treeEl = document.getElementById('tree');
var propsEl = document.getElementById('props');
var statusEl = document.getElementById('status');

var devicesDirHandle = null;
var currentDevice = '';
var previewActive = false;
var previewOverlay = null;
var previewIframe = null;
var guidesVisible = true;
var guides = [];

init();

function init() {
  var device = getDeviceFromQuery();
  var last = localStorage.getItem('webhasp_designer_last_device');
  if (device && device !== 'test-designer') {
    loadDevice(device);
  } else if (last) {
    loadDevice(last);
  }
  pickDeviceBtn.addEventListener('click', function () {
    pickDeviceFile();
  });
  pageSelect.addEventListener('change', function () {
    currentPageId = parseInt(pageSelect.value, 10);
    renderPage();
  });
  gridSelect.addEventListener('change', function () {
    gridSize = parseInt(gridSelect.value, 10);
    drawGrid(gridLayer, gridSize, config.device.canvas.width, config.device.canvas.height);
  });
  toggleSnap.addEventListener('click', function () {
    snapEnabled = !snapEnabled;
    toggleSnap.textContent = 'Snap: ' + (snapEnabled ? 'On' : 'Off');
  });
  togglePan.addEventListener('click', function () {
    panEnabled = !panEnabled;
    togglePan.textContent = 'Pan: ' + (panEnabled ? 'On' : 'Off');
    stage.draggable(panEnabled);
  });

  undoBtn.addEventListener('click', function () { undo(); });
  redoBtn.addEventListener('click', function () { redo(); });
  saveBtn.addEventListener('click', function () { saveConfig(); });
  previewBtn.addEventListener('click', function () { togglePreview(); });
  addLabelBtn.addEventListener('click', function () { addWidget('label'); });
  addRectBtn.addEventListener('click', function () { addWidget('rectangle'); });
  addHGuideBtn.addEventListener('click', function () { addGuide('h'); });
  addVGuideBtn.addEventListener('click', function () { addGuide('v'); });
  clearGuidesBtn.addEventListener('click', function () { clearGuides(); });

  window.addEventListener('keydown', function (e) {
    var key = e.key || '';
    var isMac = navigator.platform.indexOf('Mac') === 0;
    var mod = isMac ? e.metaKey : e.ctrlKey;
    if (!mod) return;
    if (key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if (key.toLowerCase() === 'z' && e.shiftKey) {
      e.preventDefault();
      redo();
    }
  });

  window.addEventListener('keydown', function (e) {
    if (!selectedIds.length) return;
    var tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    var dx = 0;
    var dy = 0;
    var step = gridSize;
    switch (e.key) {
      case 'ArrowLeft': dx = -step; break;
      case 'ArrowRight': dx = step; break;
      case 'ArrowUp': dy = -step; break;
      case 'ArrowDown': dy = step; break;
      default: return;
    }
    e.preventDefault();
    pushHistory();
    selectedIds.forEach(function (id) {
      var w = getWidgetById(id);
      if (!w) return;
      w.x = (w.x || 0) + dx;
      w.y = (w.y || 0) + dy;
    });
    renderPage();
  });

}

function loadDevice(device) {
  currentDevice = device;
  fetchConfig(device).then(function (data) {
    config = data;
    currentPageId = config.device.default_page || 1;
    resetHistory();
    setupStage();
    buildPageSelect();
    renderPage();
    setStatus('Loaded ' + device, true);
  }).catch(function (err) {
    setStatus('Load error: ' + err.message, true);
  });
}

async function pickDeviceFile() {
  if (!window.showOpenFilePicker) {
    setStatus('File picker not supported in this browser', true);
    return;
  }
  try {
    var handles = await window.showOpenFilePicker({
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      multiple: false
    });
    if (!handles || !handles.length) return;
    var handle = handles[0];
    var file = await handle.getFile();
    var text = await file.text();
    var data = JSON.parse(text);

    var name = file.name.replace(/\.json$/i, '');
    currentDevice = name;
    try { localStorage.setItem('webhasp_designer_last_device', name); } catch (e) {}

    config = data;
    currentPageId = config.device.default_page || 1;
    resetHistory();
    setupStage();
    buildPageSelect();
    renderPage();
    setStatus('Loaded ' + file.name, true);
  } catch (err) {
    setStatus('Pick failed: ' + err.message, true);
  }
}


function setupStage() {
  var wrap = document.getElementById('stage');
  wrap.innerHTML = '';

  stage = new Konva.Stage({
    container: 'stage',
    width: wrap.clientWidth,
    height: wrap.clientHeight,
    draggable: false
  });

  stage.on('wheel', function (e) {
    e.evt.preventDefault();
    var oldScale = stage.scaleX();
    var pointer = stage.getPointerPosition();
    var scaleBy = 1.05;
    var direction = e.evt.deltaY > 0 ? -1 : 1;
    var newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

    var mousePoint = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale
    };

    stage.scale({ x: newScale, y: newScale });
    var newPos = {
      x: pointer.x - mousePoint.x * newScale,
      y: pointer.y - mousePoint.y * newScale
    };
    stage.position(newPos);
    stage.batchDraw();
    syncPreviewTransform();
  });

  // Right-click pan (temporary)
  stage.on('mousedown', function (e) {
    if (e.evt && e.evt.button === 2) {
      e.evt.preventDefault();
      stage.draggable(true);
      stage.startDrag();
    }
  });
  stage.on('mouseup', function (e) {
    if (e.evt && e.evt.button === 2) {
      stage.draggable(panEnabled);
    }
  });
  stage.on('dragmove', function () {
    syncPreviewTransform();
  });
  stage.on('contextmenu', function (e) {
    e.evt.preventDefault();
  });

  stage.on('click', function (e) {
    if (e.target === stage) {
      selectedIds = [];
      renderPage();
    }
  });

  gridLayer = createGridLayer(stage, gridSize, config.device.canvas.width, config.device.canvas.height);
  pageLayer = new Konva.Layer();
  overlayLayer = new Konva.Layer();
  uiLayer = new Konva.Layer();
  guideLayer = new Konva.Layer();
  stage.add(pageLayer);
  stage.add(overlayLayer);
  stage.add(guideLayer);
  stage.add(uiLayer);

  transformer = new Konva.Transformer({
    rotateEnabled: false,
    ignoreStroke: true,
    anchorSize: 8,
    borderStroke: '#8ADF45',
    borderStrokeWidth: 1,
    anchorFill: '#8ADF45',
    anchorStroke: '#0b1a05'
  });
  uiLayer.add(transformer);

  window.addEventListener('resize', function () {
    stage.width(wrap.clientWidth);
    stage.height(wrap.clientHeight);
    syncPreviewTransform();
  });
}

function buildPageSelect() {
  pageSelect.innerHTML = '';
  config.pages.forEach(function (p) {
    if (p.id === 0) return;
    var opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.label || ('Page ' + p.id);
    pageSelect.appendChild(opt);
  });
  pageSelect.value = currentPageId;
}

function renderPage() {
  pageLayer.destroyChildren();
  overlayLayer.destroyChildren();

  var page = config.pages.find(function (p) { return p.id === currentPageId; });
  var page0 = config.pages.find(function (p) { return p.id === 0; });

  if (!page) return;

  var widgets = page.widgets || [];
  var overlayWidgets = page0 ? (page0.widgets || []) : [];

  widgets.forEach(function (w) {
    var g = createWidgetGroup(w, config.theme);
    if (hidden[w.id]) g.visible(false);
    wireDrag(g, w);
    wireSelect(g, w);
    pageLayer.add(g);
  });

  overlayWidgets.forEach(function (w) {
    var g = createWidgetGroup(w, config.theme);
    if (hidden[w.id]) g.visible(false);
    wireDrag(g, w);
    wireSelect(g, w);
    overlayLayer.add(g);
  });

  pageLayer.draw();
  overlayLayer.draw();
  renderGuides();
  if (!transformer.getLayer()) {
    uiLayer.add(transformer);
  }
  var selNodes = [];
  selectedIds.forEach(function (id) {
    var gsel = findGroupById(id);
    if (gsel) selNodes.push(gsel);
  });
  transformer.nodes(selNodes);
  uiLayer.draw();

  renderTree(treeEl, widgets, selectedIds, hidden, onSelectTree, onToggleHide);
  updateProps(propsEl, getSelectedWidgets(), onPropChange, onDeleteSelected, onDuplicateSelected, onAlignSelected);
  updateHistoryButtons();
  syncPreviewTransform();
  if (previewActive) refreshPreview();
}

function wireDrag(group, w) {
  if (previewActive) {
    group.draggable(false);
  }
  group.on('dragmove', function () {
    if (snapEnabled) {
      var x = Math.round(group.x() / gridSize) * gridSize;
      var y = Math.round(group.y() / gridSize) * gridSize;
      group.position({ x: x, y: y });
    }
    stage.batchDraw();
  });
  group.on('dragend', function () {
    pushHistory();
    w.x = Math.round(group.x());
    w.y = Math.round(group.y());
    updateProps(propsEl, w, onPropChange, onDeleteSelected, onDuplicateSelected);
  });
}

function wireSelect(group, w) {
  group.on('click', function (e) {
    e.cancelBubble = true;
    var additive = !!(e.evt && e.evt.shiftKey);
    setSelection(w.id, additive);
    renderPage();
  });

  group.on('transformend', function () {
    var rect = group._rect;
    if (!rect) return;
    pushHistory();
    var scaleX = group.scaleX();
    var scaleY = group.scaleY();
    var newW = rect.width() * scaleX;
    var newH = rect.height() * scaleY;

    if (snapEnabled) {
      newW = Math.max(4, Math.round(newW / gridSize) * gridSize);
      newH = Math.max(4, Math.round(newH / gridSize) * gridSize);
    }

    rect.width(newW);
    rect.height(newH);
    group.scale({ x: 1, y: 1 });

    if (group._label) {
      group._label.width(Math.max(0, newW - 12));
    }

    w.w = Math.round(newW);
    w.h = Math.round(newH);
    updateProps(propsEl, w, onPropChange, onDeleteSelected, onDuplicateSelected);
    renderPage();
  });
}

function onSelectTree(id, additive) {
  setSelection(id, !!additive);
  renderPage();
}

function onToggleHide(id, hiddenState) {
  hidden[id] = hiddenState;
  renderPage();
}

function loadGuides() {
  if (config && config.designer && config.designer.guides && config.designer.guides[currentPageId]) {
    guides = config.designer.guides[currentPageId] || [];
    return;
  }
  guides = [];
}

function saveGuides() {
  if (config) {
    config.designer = config.designer || {};
    config.designer.guides = config.designer.guides || {};
    config.designer.guides[currentPageId] = guides;
  }
}

function renderGuides() {
  if (!guideLayer) return;
  guideLayer.destroyChildren();
  loadGuides();
  if (!guidesVisible) {
    guideLayer.draw();
    return;
  }

  guides.forEach(function (g) {
    var group;
    var line;
    var hit;
    if (g.type === 'h') {
      group = new Konva.Group({
        x: 0,
        y: g.pos,
        draggable: true,
        dragBoundFunc: function (pos) {
          return {
            x: 0,
            y: Math.max(0, Math.min(config.device.canvas.height, pos.y))
          };
        }
      });
      line = new Konva.Line({
        points: [0, 0, config.device.canvas.width, 0],
        stroke: '#ffcc66',
        strokeWidth: 1,
        dash: [6, 4],
        hitStrokeWidth: 10
      });
      hit = new Konva.Rect({
        x: 0,
        y: -6,
        width: config.device.canvas.width,
        height: 12,
        fill: 'rgba(0,0,0,0)'
      });
    } else {
      group = new Konva.Group({
        x: g.pos,
        y: 0,
        draggable: true,
        dragBoundFunc: function (pos) {
          return {
            x: Math.max(0, Math.min(config.device.canvas.width, pos.x)),
            y: 0
          };
        }
      });
      line = new Konva.Line({
        points: [0, 0, 0, config.device.canvas.height],
        stroke: '#ffcc66',
        strokeWidth: 1,
        dash: [6, 4],
        hitStrokeWidth: 10
      });
      hit = new Konva.Rect({
        x: -6,
        y: 0,
        width: 12,
        height: config.device.canvas.height,
        fill: 'rgba(0,0,0,0)'
      });
    }
    group.on('dragmove', function () {
      if (g.type === 'h') {
        var ny = group.y();
        if (snapEnabled) ny = Math.round(ny / gridSize) * gridSize;
        g.pos = Math.round(ny);
        group.y(ny);
        group.x(0);
      } else {
        var nx = group.x();
        if (snapEnabled) nx = Math.round(nx / gridSize) * gridSize;
        g.pos = Math.round(nx);
        group.x(nx);
        group.y(0);
      }
    });
    group.on('dragend', function () {
      pushHistory();
      saveGuides();
    });
    group.on('mousedown', function (e) {
      if (e.evt && e.evt.button === 2) {
        e.evt.preventDefault();
        removeGuide(g.id);
      }
    });
    group.on('contextmenu', function (e) {
      e.evt.preventDefault();
      removeGuide(g.id);
    });
    group.add(hit);
    group.add(line);
    guideLayer.add(group);
  });
  guideLayer.draw();
}

function addGuide(type) {
  if (!config) return;
  loadGuides();
  var id = 'g' + Date.now();
  var pos = type === 'h'
    ? Math.round(config.device.canvas.height / 2)
    : Math.round(config.device.canvas.width / 2);
  guides.push({ id: id, type: type, pos: pos });
  pushHistory();
  saveGuides();
  renderGuides();
}

function removeGuide(id) {
  guides = guides.filter(function (g) { return g.id !== id; });
  pushHistory();
  saveGuides();
  renderGuides();
}

function clearGuides() {
  guides = [];
  pushHistory();
  saveGuides();
  renderGuides();
}

function resetHistory() {
  undoStack = [];
  redoStack = [];
  pushHistory(true);
}

function pushHistory(isInit) {
  if (!config) return;
  var snap = JSON.stringify(config);
  if (!isInit && undoStack.length && undoStack[undoStack.length - 1] === snap) return;
  undoStack.push(snap);
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  if (!isInit) redoStack = [];
  updateHistoryButtons();
}

function undo() {
  if (undoStack.length < 2) return;
  var current = undoStack.pop();
  redoStack.push(current);
  var prev = undoStack[undoStack.length - 1];
  config = JSON.parse(prev);
  renderPage();
  updateHistoryButtons();
}

function redo() {
  if (!redoStack.length) return;
  var next = redoStack.pop();
  undoStack.push(next);
  config = JSON.parse(next);
  renderPage();
  updateHistoryButtons();
}

function updateHistoryButtons() {
  undoBtn.disabled = undoStack.length < 2;
  redoBtn.disabled = redoStack.length === 0;
}

async function saveConfig() {
  if (!config) return;
  if (!window.showDirectoryPicker) {
    statusEl.textContent = 'Save not supported in this browser';
    downloadConfig();
    return;
  }

  try {
    if (!devicesDirHandle) {
      devicesDirHandle = await window.showDirectoryPicker();
    }

    var deviceFile = currentDevice + '.json';
    var now = new Date();
    var stamp = now.getFullYear().toString()
      + pad2(now.getMonth() + 1)
      + pad2(now.getDate())
      + '-' + pad2(now.getHours())
      + pad2(now.getMinutes())
      + pad2(now.getSeconds());

    // Backup existing file if present
    try {
      var existingHandle = await devicesDirHandle.getFileHandle(deviceFile);
      var existingFile = await existingHandle.getFile();
      var existingText = await existingFile.text();

      var backupsDir = await devicesDirHandle.getDirectoryHandle('backups', { create: true });
      var backupName = currentDevice + '-' + stamp + '.json';
      var backupHandle = await backupsDir.getFileHandle(backupName, { create: true });
      var backupWritable = await backupHandle.createWritable();
      await backupWritable.write(existingText);
      await backupWritable.close();
    } catch (e) {
      // If file doesn't exist yet, skip backup
    }

    var handle = await devicesDirHandle.getFileHandle(deviceFile, { create: true });
    var writable = await handle.createWritable();
    await writable.write(JSON.stringify(config, null, 2) + '\n');
    await writable.close();
    setStatus('Saved ' + deviceFile + ' (backup created)', true);
  } catch (err) {
    setStatus('Save failed: ' + err.message, true);
  }
}

function downloadConfig() {
  var blob = new Blob([JSON.stringify(config, null, 2) + '\n'], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = currentDevice + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}

function setStatus(msg, clearOnNext) {
  statusEl.textContent = msg || '';
  if (!clearOnNext) return;
  var cleared = false;
  function clear() {
    if (cleared) return;
    cleared = true;
    statusEl.textContent = '';
    window.removeEventListener('mousedown', clear);
    window.removeEventListener('keydown', clear);
    window.removeEventListener('wheel', clear);
    window.removeEventListener('touchstart', clear);
  }
  window.addEventListener('mousedown', clear);
  window.addEventListener('keydown', clear);
  window.addEventListener('wheel', clear);
  window.addEventListener('touchstart', clear);
}

function togglePreview() {
  previewActive = !previewActive;
  previewBtn.textContent = 'Preview: ' + (previewActive ? 'On' : 'Off');

  if (!previewActive) {
    if (previewOverlay && previewOverlay.parentNode) {
      previewOverlay.parentNode.removeChild(previewOverlay);
    }
    previewOverlay = null;
    previewIframe = null;
    setEditingEnabled(true);
    return;
  }

  setEditingEnabled(false);

  previewOverlay = document.createElement('div');
  previewOverlay.style.position = 'absolute';
  previewOverlay.style.inset = '0';
  previewOverlay.style.background = 'transparent';
  previewOverlay.style.zIndex = '10';
  previewOverlay.style.pointerEvents = 'none';

  var previewCanvas = document.createElement('div');
  previewCanvas.style.position = 'absolute';
  previewCanvas.style.top = '0';
  previewCanvas.style.left = '0';
  previewCanvas.style.width = config.device.canvas.width + 'px';
  previewCanvas.style.height = config.device.canvas.height + 'px';
  previewCanvas.style.transformOrigin = '0 0';

  previewIframe = document.createElement('iframe');
  previewIframe.style.width = '100%';
  previewIframe.style.height = '100%';
  previewIframe.style.border = '0';

  previewIframe.srcdoc = buildPreviewHtml();
  previewCanvas.appendChild(previewIframe);
  previewOverlay.appendChild(previewCanvas);
  document.getElementById('stage-wrap').appendChild(previewOverlay);
  syncPreviewTransform();
}

function syncPreviewTransform() {
  if (!previewActive || !previewOverlay) return;
  var scale = stage.scaleX();
  var x = stage.x();
  var y = stage.y();
  var previewCanvas = previewOverlay.firstChild;
  if (!previewCanvas) return;
  previewCanvas.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + scale + ')';
}

function refreshPreview() {
  if (!previewIframe) return;
  previewIframe.srcdoc = buildPreviewHtml();
}

function buildPreviewHtml() {
  var payload = JSON.stringify(config);
  var v = Date.now();
  return [
    '<!DOCTYPE html>',
    '<html><head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">',
    '<title>WebHASP Preview</title>',
    '<script>window.WEBHASP_PREVIEW = true;</script>',
    '<script>window.WEBHASP_OVERRIDE_CONFIG = ' + payload + ';</script>',
    '<script>window.WEBHASP_OVERRIDE_PAGE = ' + Number(currentPageId) + ';</script>',
    '<link rel="stylesheet" href="style.css?v=' + v + '">',
    '<link rel="stylesheet" href="fonts/materialdesignicons.css?v=' + v + '">',
    '</head><body>',
    '<div id="setup-overlay" class="hidden"></div>',
    '<div id="canvas-wrapper"><div id="canvas"></div></div>',
    '<div id="conn-status" class="conn-disconnected"></div>',
    '<div id="page-nav"></div>',
    '<script src="app.js?v=' + v + '"></script>',
    '</body></html>'
  ].join('');
}

function setEditingEnabled(enabled) {
  if (transformer) transformer.listening(enabled);
  if (!pageLayer) return;
  pageLayer.getChildren().forEach(function (g) { g.draggable(enabled); });
  overlayLayer.getChildren().forEach(function (g) { g.draggable(enabled); });
  if (guideLayer) guideLayer.listening(enabled);
}

function findGroupById(id) {
  var found = null;
  pageLayer.getChildren().forEach(function (g) {
    if (g.id() === id) found = g;
  });
  if (!found) {
    overlayLayer.getChildren().forEach(function (g) {
      if (g.id() === id) found = g;
    });
  }
  return found;
}

function getWidgetById(id) {
  if (!id || !config) return null;
  for (var i = 0; i < config.pages.length; i++) {
    var p = config.pages[i];
    if (!p.widgets) continue;
    for (var j = 0; j < p.widgets.length; j++) {
      if (p.widgets[j].id === id) return p.widgets[j];
    }
  }
  return null;
}

function onPropChange(key, value) {
  if (selectedIds.length !== 1) return;
  var w = getWidgetById(selectedIds[0]);
  if (!w) return;
  pushHistory();
  if (key && typeof key === 'object' && key.path) {
    setByPath(w, key.path, key.value);
  } else {
    if (value === undefined) {
      delete w[key];
    } else {
      w[key] = value;
    }
  }
  renderPage();
}

function setByPath(obj, path, value) {
  if (!obj || !path || !path.length) return;
  var cur = obj;
  for (var i = 0; i < path.length - 1; i++) {
    var k = path[i];
    if (!cur[k]) cur[k] = {};
    cur = cur[k];
  }
  var last = path[path.length - 1];
  if (value === undefined) {
    delete cur[last];
  } else {
    cur[last] = value;
  }
}

function onDeleteSelected() {
  if (!selectedIds.length || !config) return;
  pushHistory();
  selectedIds.forEach(function (id) { removeWidgetById(id); });
  selectedIds = [];
  renderPage();
}

function onDuplicateSelected() {
  pushHistory();
  var newIds = [];
  selectedIds.forEach(function (id) {
    var found = findWidgetEntry(id);
    if (!found || !found.page) return;
    var w = found.widget;
    var copy = JSON.parse(JSON.stringify(w));
    copy.id = generateId(w.type || 'widget');
    copy.x = (copy.x || 0) + 10;
    copy.y = (copy.y || 0) + 10;
    found.page.widgets.push(copy);
    newIds.push(copy.id);
  });
  if (newIds.length) selectedIds = newIds;
  renderPage();
}

function addWidget(type) {
  if (!config) return;
  var page = config.pages.find(function (p) { return p.id === currentPageId; });
  if (!page) return;

  var id = generateId(type);
  var pos = getViewportCenter();
  var w = {
    id: id,
    type: type,
    x: Math.round(pos.x),
    y: Math.round(pos.y),
    w: type === 'label' ? 180 : 200,
    h: type === 'label' ? 40 : 80
  };

  if (type === 'label') {
    w.text = 'New Label';
    w.font_size = 18;
    w.color = 'text';
    w.background = 'surface';
  }
  if (type === 'rectangle') {
    w.background = 'surface2';
    w.radius = 6;
  }

  pushHistory();
  page.widgets.push(w);
  selectedIds = [id];
  renderPage();
}

function generateId(prefix) {
  var base = prefix + '_';
  var n = 1;
  while (getWidgetById(base + n)) n++;
  return base + n;
}

function getViewportCenter() {
  var scale = stage.scaleX();
  var x = (stage.width() / 2 - stage.x()) / scale;
  var y = (stage.height() / 2 - stage.y()) / scale;
  return { x: x, y: y };
}

function setSelection(id, additive) {
  if (!additive) {
    selectedIds = [id];
    return;
  }
  var idx = selectedIds.indexOf(id);
  if (idx === -1) selectedIds.push(id);
  else selectedIds.splice(idx, 1);
}

function getSelectedWidgets() {
  if (!selectedIds.length) return [];
  var out = [];
  selectedIds.forEach(function (id) {
    var w = getWidgetById(id);
    if (w) out.push(w);
  });
  return out;
}

function findWidgetEntry(id) {
  if (!id || !config) return null;
  for (var i = 0; i < config.pages.length; i++) {
    var p = config.pages[i];
    if (!p.widgets) continue;
    for (var j = 0; j < p.widgets.length; j++) {
      if (p.widgets[j].id === id) {
        return { page: p, widget: p.widgets[j], index: j };
      }
    }
  }
  return null;
}

function removeWidgetById(id) {
  if (!id || !config) return;
  for (var i = 0; i < config.pages.length; i++) {
    var p = config.pages[i];
    if (!p.widgets) continue;
    p.widgets = p.widgets.filter(function (w) { return w.id !== id; });
  }
}

function onAlignSelected(action) {
  if (!selectedIds.length) return;
  var reorderActions = { front: true, back: true, up: true, down: true };
  if (reorderActions[action]) {
    reorderSelected(action);
    return;
  }

  if (selectedIds.length < 2) return;
  var anchor = getWidgetById(selectedIds[0]);
  if (!anchor) return;
  var ax = anchor.x || 0;
  var ay = anchor.y || 0;
  var aw = anchor.w || 0;
  var ah = anchor.h || 0;
  var left = ax;
  var right = ax + aw;
  var top = ay;
  var bottom = ay + ah;
  var centerX = ax + aw / 2;
  var centerY = ay + ah / 2;

  pushHistory();
  selectedIds.slice(1).forEach(function (id) {
    var w = getWidgetById(id);
    if (!w) return;
    var ww = w.w || 0;
    var wh = w.h || 0;
    if (action === 'left') w.x = left;
    if (action === 'right') w.x = right - ww;
    if (action === 'center') w.x = Math.round(centerX - ww / 2);
    if (action === 'top') w.y = top;
    if (action === 'bottom') w.y = bottom - wh;
    if (action === 'middle') w.y = Math.round(centerY - wh / 2);
  });
  renderPage();
}

function reorderSelected(action) {
  if (!config) return;
  pushHistory();
  config.pages.forEach(function (p) {
    if (!p.widgets || !p.widgets.length) return;
    var selectedSet = {};
    selectedIds.forEach(function (id) { selectedSet[id] = true; });
    if (action === 'front') {
      var keep = p.widgets.filter(function (w) { return !selectedSet[w.id]; });
      var picked = p.widgets.filter(function (w) { return selectedSet[w.id]; });
      p.widgets = keep.concat(picked);
      return;
    }
    if (action === 'back') {
      var keepBack = p.widgets.filter(function (w) { return !selectedSet[w.id]; });
      var pickedBack = p.widgets.filter(function (w) { return selectedSet[w.id]; });
      p.widgets = pickedBack.concat(keepBack);
      return;
    }
    if (action === 'up' || action === 'down') {
      var dir = action === 'up' ? 1 : -1;
      var max = p.widgets.length - 1;
      if (dir === 1) {
        for (var i = max - 1; i >= 0; i--) {
          var w = p.widgets[i];
          if (selectedSet[w.id] && !selectedSet[p.widgets[i + 1].id]) {
            var tmp = p.widgets[i + 1];
            p.widgets[i + 1] = w;
            p.widgets[i] = tmp;
          }
        }
      } else {
        for (var j = 1; j <= max; j++) {
          var w2 = p.widgets[j];
          if (selectedSet[w2.id] && !selectedSet[p.widgets[j - 1].id]) {
            var tmp2 = p.widgets[j - 1];
            p.widgets[j - 1] = w2;
            p.widgets[j] = tmp2;
          }
        }
      }
      return;
    }
  });
  renderPage();
}
