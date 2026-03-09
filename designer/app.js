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
var locked = {};
var treeFilter = '';
var snapEnabled = true;
var panEnabled = false;
var gridSize = 4;
var undoStack = [];
var redoStack = [];
var MAX_UNDO = 50;
var isDirty = false;
var transforming = false;
var widgetClipboard = null; // { items:[{widget,pageId}], copiedAt:number }
var clipboardPasteCount = 0;

var pickDeviceBtn = document.getElementById('pickDeviceBtn');
var pageSelect = document.getElementById('pageSelect');
var gridSelect = document.getElementById('gridSelect');
var toggleSnap = document.getElementById('toggleSnap');
var togglePan = document.getElementById('togglePan');
var undoBtn = document.getElementById('undoBtn');
var redoBtn = document.getElementById('redoBtn');
var copyBtn = document.getElementById('copyBtn');
var cutBtn = document.getElementById('cutBtn');
var pasteBtn = document.getElementById('pasteBtn');
var saveBtn = document.getElementById('saveBtn');
var previewBtn = document.getElementById('previewBtn');
var addLabelBtn  = document.getElementById('addLabelBtn');
var addRectBtn   = document.getElementById('addRectBtn');
var addButtonBtn = document.getElementById('addButtonBtn');
var addImageBtn  = document.getElementById('addImageBtn');
var addBarBtn    = document.getElementById('addBarBtn');
var addArcBtn    = document.getElementById('addArcBtn');
var addSliderBtn = document.getElementById('addSliderBtn');
var addSwitchBtn = document.getElementById('addSwitchBtn');
var addSceneBtn  = document.getElementById('addSceneBtn');
var addClockBtn  = document.getElementById('addClockBtn');
var addCameraBtn = document.getElementById('addCameraBtn');
var addAgendaBtn = document.getElementById('addAgendaBtn');
var addHistoryChartBtn = document.getElementById('addHistoryChartBtn');
var addHGuideBtn = document.getElementById('addHGuideBtn');
var addVGuideBtn = document.getElementById('addVGuideBtn');
var clearGuidesBtn = document.getElementById('clearGuidesBtn');
var treeEl       = document.getElementById('tree');
var propsEl      = document.getElementById('props');
var statusEl     = document.getElementById('status');
var treeSearchEl = document.getElementById('treeSearch');
var showAllBtn   = document.getElementById('showAllBtn');
var hideAllBtn   = document.getElementById('hideAllBtn');
var unlockAllBtn = document.getElementById('unlockAllBtn');
var pagesBtn       = document.getElementById('pagesBtn');
var newDeviceBtn   = document.getElementById('newDeviceBtn');
var closeDeviceBtn  = document.getElementById('closeDeviceBtn');
var devicePropsBtn  = document.getElementById('devicePropsBtn');

// Confirm modal elements
var confirmModal      = document.getElementById('confirmModal');
var confirmTitle      = document.getElementById('confirmTitle');
var confirmMessage    = document.getElementById('confirmMessage');
var confirmOkBtn      = document.getElementById('confirmOkBtn');
var confirmCancelBtn  = document.getElementById('confirmCancelBtn');

// Device Properties modal elements
var devicePropsModal      = document.getElementById('devicePropsModal');
var devicePropsCloseBtn   = document.getElementById('devicePropsCloseBtn');
var devicePropsCancelBtn  = document.getElementById('devicePropsCancelBtn');
var devicePropsSaveBtn    = document.getElementById('devicePropsSaveBtn');
var dpFilename            = document.getElementById('dpFilename');
var dpFolder              = document.getElementById('dpFolder');
var dpName                = document.getElementById('dpName');
var dpPreset              = document.getElementById('dpPreset');
var dpCustomRow           = document.getElementById('dpCustomRow');
var dpW                   = document.getElementById('dpW');
var dpH                   = document.getElementById('dpH');
var dpDefaultPage         = document.getElementById('dpDefaultPage');
var dpReturnDefault       = document.getElementById('dpReturnDefault');
var dpShowConnIndicator   = document.getElementById('dpShowConnIndicator');
var dpPageNavShow         = document.getElementById('dpPageNavShow');
var dpPageNavSize         = document.getElementById('dpPageNavSize');
var dpPageNavBg           = document.getElementById('dpPageNavBg');
var dpPageNavPrimary      = document.getElementById('dpPageNavPrimary');
var dpPageNavSecondary    = document.getElementById('dpPageNavSecondary');
var dpSsTimeout           = document.getElementById('dpSsTimeout');
var dpSsOpacity           = document.getElementById('dpSsOpacity');
var dpSsText              = document.getElementById('dpSsText');
var dpHaToken             = document.getElementById('dpHaToken');
var dpHaUrl               = document.getElementById('dpHaUrl');
// Theme modal elements
var themeModal            = document.getElementById('themeModal');
var themeModalCloseBtn    = document.getElementById('themeModalCloseBtn');
var themeModalCancelBtn   = document.getElementById('themeModalCancelBtn');
var themeModalSaveBtn     = document.getElementById('themeModalSaveBtn');
var tmFontSize            = document.getElementById('tmFontSize');
var tmColorRows           = document.getElementById('tmColorRows');
var tmAddColorBtn         = document.getElementById('tmAddColorBtn');
// Entity search modal elements
var entitySearchModal      = document.getElementById('entitySearchModal');
var entitySearchCloseBtn   = document.getElementById('entitySearchCloseBtn');
var entitySearchRefreshBtn = document.getElementById('entitySearchRefreshBtn');
var entitySearchInput      = document.getElementById('entitySearchInput');
var entityDomainFilter     = document.getElementById('entityDomainFilter');
var entityClassFilter      = document.getElementById('entityClassFilter');
var entityFilterRow        = document.getElementById('entityFilterRow');
var entitySearchStatus     = document.getElementById('entitySearchStatus');
var entitySearchList       = document.getElementById('entitySearchList');
var welcomeEl     = document.getElementById('welcome');
var welcomeOpenBtn = document.getElementById('welcomeOpenBtn');
var welcomeNewBtn  = document.getElementById('welcomeNewBtn');

// New Device modal elements
var newDeviceModal      = document.getElementById('newDeviceModal');
var ndmName             = document.getElementById('ndmName');
var ndmPreset           = document.getElementById('ndmPreset');
var ndmCustomRow        = document.getElementById('ndmCustomRow');
var ndmW                = document.getElementById('ndmW');
var ndmH                = document.getElementById('ndmH');
var newDeviceCloseBtn   = document.getElementById('newDeviceCloseBtn');
var newDeviceCancelBtn  = document.getElementById('newDeviceCancelBtn');
var newDeviceCreateBtn  = document.getElementById('newDeviceCreateBtn');

// Pages modal elements
var pagesModal        = document.getElementById('pagesModal');
var pageModalList     = document.getElementById('pageModalList');
var pageModalProps    = document.getElementById('pageModalProps');
var addPageBtn        = document.getElementById('addPageBtn');
var pagesModalCloseBtn = document.getElementById('pagesModalCloseBtn');
var pagesModalDoneBtn  = document.getElementById('pagesModalDoneBtn');

var selectedModalPageId = null; // id of the page currently selected in the modal

var devicesDirHandle = null;
var imagesDirHandle  = null;
var currentDevice = '';
var previewActive = false;
var previewOverlay = null;
var previewIframe = null;
var guidesVisible = true;
var guides = [];

init();

function init() {
  var device = getDeviceFromQuery();
  var last = localStorage.getItem('haven_designer_last_device');
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
    hidden = {};
    loadLocked();
    renderPage();
  });
  gridSelect.addEventListener('change', function () {
    gridSize = parseInt(gridSelect.value, 10);
    drawGrid(gridLayer, gridSize, config.device.canvas.width, config.device.canvas.height);
  });
  toggleSnap.addEventListener('click', function () {
    snapEnabled = !snapEnabled;
    toggleSnap.classList.toggle('active', snapEnabled);
  });
  togglePan.addEventListener('click', function () {
    panEnabled = !panEnabled;
    togglePan.classList.toggle('active', panEnabled);
    stage.draggable(panEnabled);
  });

  undoBtn.addEventListener('click', function () { undo(); });
  redoBtn.addEventListener('click', function () { redo(); });
  copyBtn.addEventListener('click', function () { copySelectionToClipboard(); updateHistoryButtons(); });
  cutBtn.addEventListener('click', function () { cutSelectionToClipboard(); });
  pasteBtn.addEventListener('click', function () { pasteClipboardSelection(); });
  saveBtn.addEventListener('click', function () { saveConfig(); });
  previewBtn.addEventListener('click', function () { togglePreview(); });
  addLabelBtn.addEventListener('click', function () { addWidget('label'); });
  addRectBtn.addEventListener('click', function () { addWidget('rectangle'); });
  addButtonBtn.addEventListener('click', function () { addWidget('button'); });
  addImageBtn.addEventListener('click', function () { addWidget('image'); });
  addBarBtn.addEventListener('click', function () { addWidget('bar'); });
  addArcBtn.addEventListener('click', function () { addWidget('arc'); });
  addSliderBtn.addEventListener('click', function () { addWidget('slider'); });
  addSwitchBtn.addEventListener('click', function () { addWidget('switch'); });
  addSceneBtn.addEventListener('click', function () { addWidget('scene'); });
  addClockBtn.addEventListener('click', function () { addWidget('clock'); });
  addCameraBtn.addEventListener('click', function () { addWidget('camera'); });
  addAgendaBtn.addEventListener('click', function () { addWidget('agenda'); });
  addHistoryChartBtn.addEventListener('click', function () { addWidget('history_chart'); });
  addHGuideBtn.addEventListener('click', function () { addGuide('h'); });
  addVGuideBtn.addEventListener('click', function () { addGuide('v'); });
  clearGuidesBtn.addEventListener('click', function () { clearGuides(); });
  pagesBtn.addEventListener('click', function () { openPagesModal(); });
  newDeviceBtn.addEventListener('click', function () { openNewDeviceModal(); });
  closeDeviceBtn.addEventListener('click', function () { closeDevice(); });
  devicePropsBtn.addEventListener('click', function () { openDevicePropsModal(); });
  devicePropsCloseBtn.addEventListener('click', function () { closeDevicePropsModal(); });
  devicePropsCancelBtn.addEventListener('click', function () { closeDevicePropsModal(); });
  devicePropsSaveBtn.addEventListener('click', function () { saveDeviceProps(); });
  devicePropsModal.addEventListener('click', function (e) {
    if (e.target === devicePropsModal) closeDevicePropsModal();
  });
  dpPreset.addEventListener('change', function () {
    dpCustomRow.classList.toggle('visible', dpPreset.value === 'custom');
  });
  devicePropsModal.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); saveDeviceProps(); }
    if (e.key === 'Escape') closeDevicePropsModal();
  });
  themeModalCloseBtn.addEventListener('click', function () { closeThemeModal(); });
  themeModalCancelBtn.addEventListener('click', function () { closeThemeModal(); });
  themeModalSaveBtn.addEventListener('click', function () { saveTheme(); });
  themeModal.addEventListener('click', function (e) {
    if (e.target === themeModal) closeThemeModal();
  });
  themeModal.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeThemeModal();
  });
  entitySearchCloseBtn.addEventListener('click', closeEntitySearch);
  entitySearchRefreshBtn.addEventListener('click', function () {
    _entityCache = null;
    fetchEntities();
  });
  entitySearchModal.addEventListener('click', function (e) {
    if (e.target === entitySearchModal) closeEntitySearch();
  });
  entitySearchModal.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeEntitySearch();
  });
  entitySearchInput.addEventListener('input', function() {
    if (_attrMode) {
      renderAttributeList(_attrEntityId);
    } else {
      renderEntityList();
    }
  });
  entityDomainFilter.addEventListener('change', renderEntityList);
  entityClassFilter.addEventListener('change', renderEntityList);
  welcomeOpenBtn.addEventListener('click', function () { pickDeviceFile(); });
  welcomeNewBtn.addEventListener('click', function () { openNewDeviceModal(); });
  newDeviceCloseBtn.addEventListener('click', function () { closeNewDeviceModal(); });
  newDeviceCancelBtn.addEventListener('click', function () { closeNewDeviceModal(); });
  newDeviceCreateBtn.addEventListener('click', function () { createNewDevice(); });
  newDeviceModal.addEventListener('click', function (e) {
    if (e.target === newDeviceModal) closeNewDeviceModal();
  });
  ndmPreset.addEventListener('change', function () {
    ndmCustomRow.classList.toggle('visible', ndmPreset.value === 'custom');
  });
  // Allow Enter key to confirm creation
  newDeviceModal.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); createNewDevice(); }
    if (e.key === 'Escape') closeNewDeviceModal();
  });
  addPageBtn.addEventListener('click', function () { addPage(); });
  pagesModalCloseBtn.addEventListener('click', function () { closePagesModal(); });
  pagesModalDoneBtn.addEventListener('click', function () { closePagesModal(); });
  // Click outside modal to close
  pagesModal.addEventListener('click', function (e) {
    if (e.target === pagesModal) closePagesModal();
  });

  // Right panel resize handle
  initPanelResizer();

  // Tree search — filter widget list as the user types
  treeSearchEl.addEventListener('input', function () {
    treeFilter = treeSearchEl.value;
    renderTree(treeEl, getCurrentWidgets(), selectedIds, hidden, locked, treeFilter, onSelectTree, onToggleHide, onToggleLock, onReorder);
  });

  // Bulk visibility / lock controls
  showAllBtn.addEventListener('click', function () {
    getCurrentWidgets().forEach(function (w) { hidden[w.id] = false; });
    renderPage();
  });
  hideAllBtn.addEventListener('click', function () {
    getCurrentWidgets().forEach(function (w) { hidden[w.id] = true; });
    renderPage();
  });
  unlockAllBtn.addEventListener('click', function () {
    getCurrentWidgets().forEach(function (w) { locked[w.id] = false; });
    saveLocked();
    renderPage();
  });

  window.addEventListener('keydown', function (e) {
    var key = e.key || '';
    var isMac = navigator.platform.indexOf('Mac') === 0;
    var mod = isMac ? e.metaKey : e.ctrlKey;
    if (!mod) return;
    if (isEditableFocus()) return;
    var lk = key.toLowerCase();
    if (lk === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if (lk === 'z' && e.shiftKey) {
      e.preventDefault();
      redo();
    } else if (lk === 'c') {
      if (copySelectionToClipboard()) e.preventDefault();
    } else if (lk === 'x') {
      if (cutSelectionToClipboard()) e.preventDefault();
    } else if (lk === 'v') {
      if (pasteClipboardSelection()) e.preventDefault();
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

function initPanelResizer() {
  var layout = document.querySelector('.layout');
  var leftW  = 240;
  var rightW = 340;

  function applyColumns(left, right) {
    leftW  = left;
    rightW = right;
    layout.style.gridTemplateColumns = leftW + 'px 1fr ' + rightW + 'px';
    window.dispatchEvent(new Event('resize'));
  }

  function initHandle(resizerId, panelId, side, minW, maxW, storageKey) {
    var resizer = document.getElementById(resizerId);
    var panel   = document.getElementById(panelId);

    var saved = parseInt(localStorage.getItem(storageKey), 10);
    if (saved && saved >= minW && saved <= maxW) {
      if (side === 'right') applyColumns(saved, rightW);
      else                  applyColumns(leftW,  saved);
    }

    resizer.addEventListener('mousedown', function (e) {
      e.preventDefault();
      resizer.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      var startX     = e.clientX;
      var startWidth = panel.offsetWidth;

      function onMove(e) {
        var delta = side === 'right' ? e.clientX - startX : startX - e.clientX;
        var w = Math.min(maxW, Math.max(minW, startWidth + delta));
        if (side === 'right') applyColumns(w,    rightW);
        else                  applyColumns(leftW, w);
      }

      function onUp() {
        resizer.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        try { localStorage.setItem(storageKey, panel.offsetWidth); } catch(e) {}
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  initHandle('treePanelResizer',  'treePanel',  'right', 160, 500, 'haven_designer_tree_width');
  initHandle('propsPanelResizer', 'propsPanel', 'left',  200, 700, 'haven_designer_props_width');
}

function loadDevice(device) {
  currentDevice = device;
  fetchConfig(device).then(function (data) {
    config = data;
    currentPageId = config.device.default_page || 1;
    hidden = {};
    locked = {};
    loadLocked();
    resetHistory();
    setupStage();
    buildPageSelect();
    renderPage();
    hideWelcome();
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
    try { localStorage.setItem('haven_designer_last_device', name); } catch (e) {}

    config = data;
    currentPageId = config.device.default_page || 1;
    hidden = {};
    locked = {};
    loadLocked();
    resetHistory();
    setupStage();
    buildPageSelect();
    renderPage();
    hideWelcome();
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
    anchorStroke: '#0b1a05',
    boundBoxFunc: function (oldBox, newBox) {
      // boundBoxFunc operates in absolute stage coordinates (includes zoom/pan).
      if (!snapEnabled) return newBox;
      var sc = stage.scaleX();
      var ox = stage.x();
      var oy = stage.y();
      var s  = gridSize * sc;

      // Detect which edges moved. For left/top handles Konva moves x/y while
      // keeping the opposite edge fixed. Snapping x and width independently
      // shifts that fixed edge — instead snap the moving edge and derive the
      // size from the anchored opposite edge.
      var leftMoved = Math.abs(newBox.x - oldBox.x) > 0.5;
      var topMoved  = Math.abs(newBox.y - oldBox.y) > 0.5;
      var oldRight  = oldBox.x + oldBox.width;
      var oldBottom = oldBox.y + oldBox.height;

      var sx, sy, sw, sh;
      if (leftMoved) {
        sx = Math.round((newBox.x - ox) / s) * s + ox;
        sw = Math.max(s, oldRight - sx);
      } else {
        sx = oldBox.x;
        sw = Math.max(s, Math.round(newBox.width / s) * s);
      }
      if (topMoved) {
        sy = Math.round((newBox.y - oy) / s) * s + oy;
        sh = Math.max(s, oldBottom - sy);
      } else {
        sy = oldBox.y;
        sh = Math.max(s, Math.round(newBox.height / s) * s);
      }
      return { x: sx, y: sy, width: sw, height: sh, rotation: newBox.rotation };
    }
  });

  // Left/top anchors sit on the widget edge, so pointerdown can fire dragstart
  // on the group at the same time as transformstart. Guard against this by:
  // 1. Setting a flag so dragmove/dragend bail out immediately.
  // 2. Calling stopDrag() to cancel any drag that already started.
  transformer.on('transformstart', function () {
    transforming = true;
    transformer.nodes().forEach(function (n) { n.stopDrag(); n.draggable(false); });
  });
  transformer.on('transformend', function () {
    transforming = false;
    transformer.nodes().forEach(function (n) { n.draggable(true); });
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

  // Overlay (page 0) always first if it exists
  var page0 = config.pages.find(function (p) { return p.id === 0; });
  if (page0) {
    var opt0 = document.createElement('option');
    opt0.value = '0';
    opt0.textContent = 'Overlay';
    pageSelect.appendChild(opt0);
  }

  config.pages.forEach(function (p) {
    if (p.id === 0) return; // already added above
    var opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.label || ('Page ' + p.id);
    pageSelect.appendChild(opt);
  });

  pageSelect.value = String(currentPageId);
  if (pageSelect.value !== String(currentPageId) && pageSelect.options.length) {
    pageSelect.selectedIndex = 0;
    currentPageId = parseInt(pageSelect.value, 10);
  }
}

function renderPage() {
  pageLayer.destroyChildren();
  overlayLayer.destroyChildren();

  var page  = config.pages.find(function (p) { return p.id === currentPageId; });
  var page0 = config.pages.find(function (p) { return p.id === 0; });

  if (!page) return;

  // When editing the overlay page directly, render its widgets on pageLayer
  // so they are selectable/draggable. Suppress the overlayLayer so they
  // don't also appear there (which would double-render them).
  var editingOverlay = (currentPageId === 0);
  var widgets        = page.widgets || [];
  var overlayWidgets = (!editingOverlay && page0) ? (page0.widgets || []) : [];

  widgets.forEach(function (w) {
    var g = createWidgetGroup(w, config.theme);
    if (hidden[w.id])  { g.visible(false); }
    if (locked[w.id])  { g.draggable(false); g.listening(false); }
    if (!locked[w.id]) { wireDrag(g, w); }
    wireSelect(g, w);
    pageLayer.add(g);
  });

  overlayWidgets.forEach(function (w) {
    var g = createWidgetGroup(w, config.theme);
    if (hidden[w.id])  { g.visible(false); }
    if (locked[w.id])  { g.draggable(false); g.listening(false); }
    if (!locked[w.id]) { wireDrag(g, w); }
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
    if (locked[id]) return;  // locked widgets excluded from transformer
    var gsel = findGroupById(id);
    if (gsel) selNodes.push(gsel);
  });
  transformer.nodes(selNodes);
  uiLayer.draw();

  renderTree(treeEl, widgets, selectedIds, hidden, locked, treeFilter, onSelectTree, onToggleHide, onToggleLock, onReorder);
  updateProps(propsEl, getSelectedWidgets(), onPropChange, onDeleteSelected, onDuplicateSelected, onAlignSelected, config.theme, openThemeModal, openEntitySearch, openAttributeSearch);
  updateHistoryButtons();
  syncPreviewTransform();
  if (previewActive) refreshPreview();
}

function wireDrag(group, w) {
  if (previewActive) {
    group.draggable(false);
  }
  group.on('dragmove', function () {
    if (transforming) return;
    if (snapEnabled) {
      var x = Math.round(group.x() / gridSize) * gridSize;
      var y = Math.round(group.y() / gridSize) * gridSize;
      group.position({ x: x, y: y });
    }
    stage.batchDraw();
  });
  group.on('dragend', function () {
    if (transforming) return;
    pushHistory();
    w.x = Math.round(group.x());
    w.y = Math.round(group.y());
    updateProps(propsEl, [w], onPropChange, onDeleteSelected, onDuplicateSelected, undefined, config.theme, openThemeModal, openEntitySearch, openAttributeSearch);
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
    var newW = rect.width()  * scaleX;
    var newH = rect.height() * scaleY;

    // boundBoxFunc already snapped during drag; snap here too as a safety net
    // when snap is enabled (catches any floating-point residuals).
    if (snapEnabled) {
      newW = Math.max(gridSize, Math.round(newW / gridSize) * gridSize);
      newH = Math.max(gridSize, Math.round(newH / gridSize) * gridSize);
    }

    rect.width(newW);
    rect.height(newH);
    group.scale({ x: 1, y: 1 });

    if (group._label) {
      group._label.width(Math.max(0, newW - 12));
    }

    // Konva repositions the group for non-bottom-right anchors (e.g. top and
    // left handles move group.x / group.y to keep the opposite edge fixed).
    // Always sync position back to the widget config so renderPage() restores
    // the correct location.
    w.x = Math.round(group.x());
    w.y = Math.round(group.y());
    w.w = Math.round(newW);
    w.h = Math.round(newH);
    updateProps(propsEl, [w], onPropChange, onDeleteSelected, onDuplicateSelected, undefined, config.theme, openThemeModal, openEntitySearch, openAttributeSearch);
    renderPage();
  });
}

function onSelectTree(id, additive) {
  setSelection(id, !!additive);
  renderPage();
  scrollToWidget(id);
}

function onToggleHide(id, hiddenState) {
  hidden[id] = hiddenState;
  renderPage();
}

function onToggleLock(id, lockedState) {
  locked[id] = lockedState;
  // Deselect the widget when locking it so the transformer detaches cleanly
  if (lockedState) {
    var idx = selectedIds.indexOf(id);
    if (idx !== -1) selectedIds.splice(idx, 1);
  }
  saveLocked();
  renderPage();
}

function onReorder(fromId, toId, before) {
  var widgets = getCurrentWidgets();
  var fromIdx = widgets.findIndex(function (w) { return w.id === fromId; });
  var toIdx   = widgets.findIndex(function (w) { return w.id === toId; });
  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;

  // Remove the dragged widget from its current position
  var moved = widgets.splice(fromIdx, 1)[0];

  // Recalculate toIdx after removal
  toIdx = widgets.findIndex(function (w) { return w.id === toId; });

  // Insert before or after the target
  var insertAt = before ? toIdx : toIdx + 1;
  widgets.splice(insertAt, 0, moved);

  pushHistory();
  renderPage();
}

// ── Page management modal ────────────────────────────────────────────────────

function openPagesModal() {
  if (!config) return;
  // Default selection to current page
  selectedModalPageId = currentPageId;
  renderPageModal();
  pagesModal.classList.add('open');
}

function closePagesModal() {
  pagesModal.classList.remove('open');
  // If the user selected a different page in the modal, switch the canvas to it
  if (selectedModalPageId !== null && selectedModalPageId !== currentPageId) {
    switchToPage(selectedModalPageId);
  }
}

function switchToPage(id) {
  currentPageId = id;
  hidden = {};
  loadLocked();
  buildPageSelect();
  renderPage();
}

function renderPageModal() {
  renderPageModalList();
  renderPageModalProps();
}

function renderPageModalList() {
  pageModalList.innerHTML = '';
  var dragPageId = null;

  config.pages.forEach(function (page) {
    if (page.id === 0) return; // rendered separately below
    var item = document.createElement('div');
    var widgetCount = (page.widgets || []).length;
    item.className = 'page-item' + (page.id === selectedModalPageId ? ' active' : '');
    item.draggable = true;

    var idEl = document.createElement('span');
    idEl.className = 'page-item-id';
    idEl.textContent = '#' + page.id;

    var labelEl = document.createElement('span');
    labelEl.className = 'page-item-label';
    labelEl.textContent = page.label || ('Page ' + page.id);

    var countEl = document.createElement('span');
    countEl.className = 'page-item-count';
    countEl.textContent = widgetCount ? widgetCount + 'w' : '';
    countEl.title = widgetCount + ' widget' + (widgetCount !== 1 ? 's' : '');

    var delBtn = document.createElement('button');
    delBtn.className = 'tree-icon-btn';
    delBtn.textContent = '🗑';
    delBtn.title = 'Delete page';
    delBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      deletePage(page);
    });

    item.appendChild(idEl);
    item.appendChild(labelEl);
    item.appendChild(countEl);
    item.appendChild(delBtn);

    item.addEventListener('click', function () {
      selectedModalPageId = page.id;
      renderPageModal();
    });

    // Drag to reorder pages
    item.addEventListener('dragstart', function (e) {
      dragPageId = page.id;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(page.id));
    });
    item.addEventListener('dragend', function () {
      dragPageId = null;
      item.classList.remove('dragging');
      clearPageDropIndicators();
    });
    item.addEventListener('dragover', function (e) {
      if (!dragPageId || dragPageId === page.id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      clearPageDropIndicators();
      var rect = item.getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) {
        item.classList.add('drag-over-above');
      } else {
        item.classList.add('drag-over-below');
      }
    });
    item.addEventListener('dragleave', function (e) {
      if (!item.contains(e.relatedTarget)) {
        item.classList.remove('drag-over-above', 'drag-over-below');
      }
    });
    item.addEventListener('drop', function (e) {
      e.preventDefault();
      if (!dragPageId || dragPageId === page.id) { clearPageDropIndicators(); return; }
      var rect   = item.getBoundingClientRect();
      var before = e.clientY < (rect.top + rect.height / 2);
      clearPageDropIndicators();
      reorderPage(dragPageId, page.id, before);
    });

    pageModalList.appendChild(item);
  });

  function clearPageDropIndicators() {
    var items = pageModalList.querySelectorAll('.page-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.remove('drag-over-above', 'drag-over-below');
    }
  }

  // Overlay page (id 0) — shown at bottom, separate from draggable page list
  var divider = document.createElement('div');
  divider.style.cssText = 'border-top:1px solid var(--border);margin:6px 6px 4px;';
  pageModalList.appendChild(divider);

  var page0 = config.pages.find(function (p) { return p.id === 0; });
  if (page0) {
    var widgetCount = (page0.widgets || []).length;
    var overlayItem = document.createElement('div');
    overlayItem.className = 'page-item' + (selectedModalPageId === 0 ? ' active' : '');

    var idEl = document.createElement('span');
    idEl.className = 'page-item-id';
    idEl.textContent = '#0';

    var labelEl = document.createElement('span');
    labelEl.className = 'page-item-label';
    labelEl.textContent = 'Overlay';

    var countEl = document.createElement('span');
    countEl.className = 'page-item-count';
    countEl.textContent = widgetCount ? widgetCount + 'w' : '';
    countEl.title = widgetCount + ' widget' + (widgetCount !== 1 ? 's' : '');

    var delBtn = document.createElement('button');
    delBtn.className = 'tree-icon-btn';
    delBtn.textContent = '🗑';
    delBtn.title = 'Delete overlay page';
    delBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      deleteOverlayPage(page0);
    });

    overlayItem.appendChild(idEl);
    overlayItem.appendChild(labelEl);
    overlayItem.appendChild(countEl);
    overlayItem.appendChild(delBtn);
    overlayItem.addEventListener('click', function () {
      selectedModalPageId = 0;
      renderPageModal();
    });
    pageModalList.appendChild(overlayItem);
  } else {
    var addOverlayBtn = document.createElement('button');
    addOverlayBtn.textContent = '+ Add Overlay Page';
    addOverlayBtn.style.cssText = 'width:calc(100% - 12px);margin:0 6px;padding:6px 10px;background:var(--panel2);border:1px dashed var(--border);color:var(--muted);border-radius:5px;cursor:pointer;font-size:12px;text-align:left;';
    addOverlayBtn.addEventListener('click', addOverlayPage);
    pageModalList.appendChild(addOverlayBtn);
  }
}

function reorderPage(fromId, toId, before) {
  // Find non-zero pages only (id 0 stays in place)
  var pages     = config.pages;
  var fromIdx   = pages.findIndex(function (p) { return p.id === fromId; });
  var toIdx     = pages.findIndex(function (p) { return p.id === toId; });
  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
  var moved = pages.splice(fromIdx, 1)[0];
  toIdx = pages.findIndex(function (p) { return p.id === toId; });
  pages.splice(before ? toIdx : toIdx + 1, 0, moved);
  pushHistory();
  buildPageSelect();
  renderPageModal();
}

function renderPageModalProps() {
  pageModalProps.innerHTML = '';

  var page = config.pages.find(function (p) { return p.id === selectedModalPageId; });
  if (!page) {
    var empty = document.createElement('div');
    empty.className = 'modal-empty';
    empty.textContent = 'Select a page to edit its properties.';
    pageModalProps.appendChild(empty);
    return;
  }

  var h = document.createElement('h4');
  h.textContent = 'Page Properties';
  pageModalProps.appendChild(h);

  // Page ID (read-only)
  addModalPropReadonly(pageModalProps, 'Page ID', String(page.id));

  // Label
  addModalPropText(pageModalProps, 'Label', page.label || '', function (val) {
    page.label = val;
    pushHistory();
    buildPageSelect();
    renderPageModalList();
  });

  // Background image/opacity/fit — not applicable to the overlay page
  if (page.id !== 0) {
    addModalPropImageUpload(pageModalProps, page);

    addModalPropNumber(pageModalProps, 'Background Opacity (0–1)', page.background_image_opacity !== undefined ? page.background_image_opacity : 1, 0, 1, 0.05, function (val) {
      page.background_image_opacity = val;
      pushHistory();
    });

    addModalPropSelect(pageModalProps, 'Background Fit', page.background_image_fit || 'cover',
      ['cover', 'contain', 'fill', 'none'],
      function (val) {
        page.background_image_fit = val;
        pushHistory();
      }
    );
  } else {
    var note = document.createElement('div');
    note.style.cssText = 'font-size:12px;color:var(--muted);margin-top:8px;padding:8px 10px;background:var(--panel2);border-radius:4px;';
    note.textContent = 'The overlay page renders transparently on top of every other page. Background images are not supported.';
    pageModalProps.appendChild(note);
  }
}

function addModalPropReadonly(container, label, value) {
  var wrap = document.createElement('div');
  wrap.className = 'mprop';
  var lbl = document.createElement('label');
  lbl.textContent = label;
  var val = document.createElement('div');
  val.className = 'mprop-readonly';
  val.textContent = value;
  wrap.appendChild(lbl);
  wrap.appendChild(val);
  container.appendChild(wrap);
}

function addModalPropText(container, label, value, onChange) {
  var wrap = document.createElement('div');
  wrap.className = 'mprop';
  var lbl = document.createElement('label');
  lbl.textContent = label;
  var inp = document.createElement('input');
  inp.type = 'text';
  inp.value = value;
  inp.addEventListener('change', function () { onChange(inp.value.trim()); });
  wrap.appendChild(lbl);
  wrap.appendChild(inp);
  container.appendChild(wrap);
}

function addModalPropNumber(container, label, value, min, max, step, onChange) {
  var wrap = document.createElement('div');
  wrap.className = 'mprop';
  var lbl = document.createElement('label');
  lbl.textContent = label;
  var inp = document.createElement('input');
  inp.type = 'number';
  inp.min = min;
  inp.max = max;
  inp.step = step;
  inp.value = value;
  inp.addEventListener('change', function () {
    var v = parseFloat(inp.value);
    if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
  });
  wrap.appendChild(lbl);
  wrap.appendChild(inp);
  container.appendChild(wrap);
}

function addModalPropSelect(container, label, value, options, onChange) {
  var wrap = document.createElement('div');
  wrap.className = 'mprop';
  var lbl = document.createElement('label');
  lbl.textContent = label;
  var sel = document.createElement('select');
  options.forEach(function (opt) {
    var o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    if (opt === value) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener('change', function () { onChange(sel.value); });
  wrap.appendChild(lbl);
  wrap.appendChild(sel);
  container.appendChild(wrap);
}

function addModalPropImageUpload(container, page) {
  var wrap = document.createElement('div');
  wrap.className = 'mprop';

  var lbl = document.createElement('label');
  lbl.textContent = 'Background Image';
  wrap.appendChild(lbl);

  // Row: text path input + Browse button + Clear button
  var row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:6px;align-items:center;';

  var inp = document.createElement('input');
  inp.type        = 'text';
  inp.value       = page.background_image || '';
  inp.placeholder = 'images/background.jpg';
  inp.style.flex  = '1';
  inp.addEventListener('change', function () {
    var v = inp.value.trim();
    if (v) { page.background_image = v; } else { delete page.background_image; }
    pushHistory();
    updateThumb();
  });

  var browseBtn = document.createElement('button');
  browseBtn.textContent = 'Upload…';
  browseBtn.style.cssText = 'background:var(--panel2);border:1px solid var(--border);color:var(--text);padding:5px 8px;border-radius:4px;cursor:pointer;white-space:nowrap;font-size:12px;flex-shrink:0;';
  browseBtn.title = 'Copy an image file into your images/ folder and set the path';
  browseBtn.addEventListener('click', function () {
    pickBackgroundImage(page, inp, thumb);
  });

  var clearBtn = document.createElement('button');
  clearBtn.textContent = '✕';
  clearBtn.title = 'Clear background image';
  clearBtn.style.cssText = 'background:none;border:1px solid var(--border);color:var(--muted);padding:5px 7px;border-radius:4px;cursor:pointer;font-size:12px;flex-shrink:0;';
  clearBtn.addEventListener('click', function () {
    inp.value = '';
    delete page.background_image;
    pushHistory();
    updateThumb();
  });

  row.appendChild(inp);
  row.appendChild(browseBtn);
  row.appendChild(clearBtn);
  wrap.appendChild(row);

  // Thumbnail — only shown after an upload in this session (we can't resolve the path without FS access)
  var thumb = document.createElement('img');
  thumb.style.cssText = 'display:none;width:100%;max-height:90px;object-fit:cover;border-radius:4px;margin-top:8px;border:1px solid var(--border);';
  wrap.appendChild(thumb);

  // Hint
  var hint = document.createElement('div');
  hint.style.cssText = 'font-size:11px;color:var(--muted);margin-top:4px;';
  hint.textContent = 'Upload copies the file to your images/ folder next to devices/. You can also type a path directly.';
  wrap.appendChild(hint);

  container.appendChild(wrap);

  function updateThumb() {
    // Only hide — we can't load arbitrary local paths in the browser
    if (!page.background_image) thumb.style.display = 'none';
  }
}

async function pickBackgroundImage(page, inputEl, thumbEl) {
  if (!window.showOpenFilePicker) {
    setStatus('File picker not supported — enter the path manually', true);
    return;
  }
  try {
    var handles = await window.showOpenFilePicker({
      types: [{ description: 'Images', accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'] } }],
      multiple: false
    });
    if (!handles || !handles.length) return;
    var fileHandle = handles[0];
    var file = await fileHandle.getFile();

    // Get or prompt for the images/ directory
    if (!imagesDirHandle) {
      if (!window.showDirectoryPicker) {
        // No directory picker — just set the path and let the user copy the file manually
        page.background_image = 'images/' + file.name;
        inputEl.value = page.background_image;
        pushHistory();
        setStatus('Set to images/' + file.name + ' — copy the file to your images/ folder manually', true);
        return;
      }
      setStatus('Select your haven images/ folder…', false);
      try {
        imagesDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      } catch (err) {
        setStatus('', false);
        if (err.name !== 'AbortError') setStatus('Could not access images folder: ' + err.message, true);
        return;
      }
    }

    // Write the file into the images/ folder
    try {
      var destHandle = await imagesDirHandle.getFileHandle(file.name, { create: true });
      var writable   = await destHandle.createWritable();
      await writable.write(await file.arrayBuffer());
      await writable.close();
    } catch (err) {
      setStatus('Could not write image: ' + err.message, true);
      return;
    }

    // Update config + text input
    var path = 'images/' + file.name;
    page.background_image = path;
    inputEl.value = path;
    pushHistory();

    // Show thumbnail from in-memory file object
    var url = URL.createObjectURL(file);
    thumbEl.src = url;
    thumbEl.style.display = 'block';
    thumbEl.onload = function () { URL.revokeObjectURL(url); };

    setStatus('Copied to images/' + file.name, true);
  } catch (err) {
    if (err.name !== 'AbortError') setStatus('Upload failed: ' + err.message, true);
  }
}

function addOverlayPage() {
  if (!config) return;
  config.pages.push({ id: 0, label: 'Overlay', widgets: [] });
  selectedModalPageId = 0;
  pushHistory();
  buildPageSelect();
  renderPageModal();
}

async function deleteOverlayPage(page) {
  var widgetCount = (page.widgets || []).length;
  var msg = widgetCount > 0
    ? 'The overlay page contains ' + widgetCount + ' widget' + (widgetCount !== 1 ? 's' : '') + '. Delete it anyway? This cannot be undone.'
    : 'Delete the overlay page? This cannot be undone.';
  var confirmed = await showConfirm('Delete Overlay Page', msg, 'Delete', true);
  if (!confirmed) return;
  config.pages = config.pages.filter(function (p) { return p.id !== 0; });
  if (currentPageId === 0) {
    currentPageId = config.device.default_page || 1;
  }
  selectedModalPageId = currentPageId;
  pushHistory();
  buildPageSelect();
  renderPage();
  renderPageModal();
}

function addPage() {
  if (!config) return;
  // New ID = max existing id + 1 (min 1)
  var maxId = 0;
  config.pages.forEach(function (p) { if (p.id > maxId) maxId = p.id; });
  var newId = maxId + 1;
  var newPage = { id: newId, label: 'Page ' + newId, widgets: [] };
  config.pages.push(newPage);
  selectedModalPageId = newId;
  pushHistory();
  buildPageSelect();
  renderPageModal();
}

async function deletePage(page) {
  if (!config) return;
  var nonZeroPages = config.pages.filter(function (p) { return p.id !== 0; });
  if (nonZeroPages.length <= 1) {
    await showConfirm('Cannot Delete', 'You cannot delete the last page.', 'OK', false);
    return;
  }
  var widgetCount = (page.widgets || []).length;
  var pageLabel = page.label || ('Page ' + page.id);
  var msg = widgetCount > 0
    ? '"' + pageLabel + '" contains ' + widgetCount + ' widget' + (widgetCount !== 1 ? 's' : '') + '. This cannot be undone.'
    : 'Delete page "' + pageLabel + '"?';
  var ok = await showConfirm('Delete Page', msg, 'Delete', true);
  if (!ok) return;

  var idx = config.pages.indexOf(page);
  config.pages.splice(idx, 1);

  // Select an adjacent page after deletion
  var remaining = config.pages.filter(function (p) { return p.id !== 0; });
  selectedModalPageId = remaining.length ? remaining[Math.min(idx, remaining.length - 1)].id : null;

  pushHistory();
  buildPageSelect();
  renderPageModal();
}

// ── Welcome overlay ──────────────────────────────────────────────────────────

function hideWelcome() {
  welcomeEl.classList.add('hidden');
}

// Promise-based custom confirm — replaces browser confirm()
// okLabel optionally overrides the confirm button text.
// okDanger: true makes the confirm button red (destructive actions).
function showConfirm(titleText, messageText, okLabel, okDanger) {
  return new Promise(function (resolve) {
    confirmTitle.textContent   = titleText;
    confirmMessage.textContent = messageText;
    confirmOkBtn.textContent   = okLabel || 'Confirm';
    confirmOkBtn.className     = 'danger';
    if (!okDanger) {
      confirmOkBtn.className = 'primary';
    }
    confirmModal.classList.add('open');

    function cleanup() {
      confirmModal.classList.remove('open');
      confirmOkBtn.removeEventListener('click', onOk);
      confirmCancelBtn.removeEventListener('click', onCancel);
      confirmModal.removeEventListener('click', onBackdrop);
    }
    function onOk()      { cleanup(); resolve(true);  }
    function onCancel()  { cleanup(); resolve(false); }
    function onBackdrop(e) { if (e.target === confirmModal) { cleanup(); resolve(false); } }

    confirmOkBtn.addEventListener('click', onOk);
    confirmCancelBtn.addEventListener('click', onCancel);
    confirmModal.addEventListener('click', onBackdrop);
  });
}

async function closeDevice() {
  if (!config) {
    welcomeEl.classList.remove('hidden');
    return;
  }
  if (isDirty) {
    var ok = await showConfirm(
      'Unsaved Changes',
      'You have unsaved changes. Close without saving?',
      'Close without saving',
      true
    );
    if (!ok) return;
  }
  config = null;
  currentDevice = '';
  currentPageId = 1;
  selectedIds = [];
  hidden = {};
  locked = {};
  guides = [];
  devicesDirHandle = null;
  imagesDirHandle  = null;
  resetHistory();
  // Destroy the Konva stage if one exists
  if (stage) {
    stage.destroy();
    stage = null;
    gridLayer = null;
    pageLayer = null;
    overlayLayer = null;
    uiLayer = null;
    transformer = null;
    guideLayer = null;
  }
  // Clear the stage DOM
  var stageEl = document.getElementById('stage');
  if (stageEl) stageEl.innerHTML = '';
  // Clear the page select and panels
  pageSelect.innerHTML = '';
  treeEl.innerHTML = '';
  propsEl.innerHTML = '';
  // Turn off preview if active
  if (previewActive) {
    previewActive = false;
    previewBtn.classList.remove('active');
    if (previewOverlay && previewOverlay.parentNode) {
      previewOverlay.parentNode.removeChild(previewOverlay);
    }
    previewOverlay = null;
    previewIframe = null;
  }
  setStatus('', false);
  welcomeEl.classList.remove('hidden');
  updateHistoryButtons();
}

// ── Device Properties modal ──────────────────────────────────────────────────

// Presets shared between New Device and Device Properties modals
var CANVAS_PRESETS = [
  { value: '1024x768',  w: 1024, h: 768  },
  { value: '1280x800',  w: 1280, h: 800  },
  { value: '1920x1080', w: 1920, h: 1080 },
  { value: '1366x768',  w: 1366, h: 768  },
  { value: '800x480',   w: 800,  h: 480  },
  { value: '800x600',   w: 800,  h: 600  }
];

// Fixed theme color tokens — name is locked, only value is editable
var FIXED_THEME_TOKENS = [
  'background', 'surface', 'surface2',
  'primary', 'warning', 'danger',
  'text', 'text_dim', 'text_muted', 'icon_inactive'
];

function buildThemeColors(colors) {
  tmColorRows.innerHTML = '';
  var fixed = {};
  FIXED_THEME_TOKENS.forEach(function(token) { fixed[token] = true; });

  function makeColorRow(name, value, isFixed) {
    var row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:1fr 28px 90px auto;align-items:center;gap:6px;margin-bottom:5px;';
    row.dataset.token = name;

    var nameEl;
    if (isFixed) {
      nameEl = document.createElement('span');
      nameEl.textContent = name;
      nameEl.style.cssText = 'font-size:12px;color:var(--muted);font-family:monospace;align-self:center;';
    } else {
      nameEl = document.createElement('input');
      nameEl.type = 'text';
      nameEl.value = name;
      nameEl.placeholder = 'token_name';
      nameEl.className = 'tm-color-name';
    }

    var swatch = document.createElement('input');
    swatch.type = 'color';
    swatch.className = 'tm-color-swatch';
    if (value && /^#[0-9a-fA-F]{3,6}$/.test(value.trim())) {
      swatch.value = value.trim();
    }

    var textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.value = value || '';
    textInput.placeholder = '#rrggbb';
    textInput.className = 'tm-color-value';

    swatch.addEventListener('input', function() { textInput.value = swatch.value; });
    textInput.addEventListener('input', function() {
      if (/^#[0-9a-fA-F]{3,6}$/.test(textInput.value.trim())) {
        swatch.value = textInput.value.trim();
      }
    });

    row.appendChild(nameEl);
    row.appendChild(swatch);
    row.appendChild(textInput);

    if (!isFixed) {
      var delBtn = document.createElement('button');
      delBtn.textContent = '×';
      delBtn.title = 'Remove';
      delBtn.className = 'prop-icon-btn danger';
      delBtn.style.cssText = 'flex-shrink:0;';
      delBtn.addEventListener('click', function() { tmColorRows.removeChild(row); });
      row.appendChild(delBtn);
    } else {
      row.appendChild(document.createElement('div'));
    }

    return row;
  }

  FIXED_THEME_TOKENS.forEach(function(token) {
    tmColorRows.appendChild(makeColorRow(token, colors[token] || '', true));
  });

  Object.keys(colors).forEach(function(token) {
    if (!fixed[token]) {
      tmColorRows.appendChild(makeColorRow(token, colors[token] || '', false));
    }
  });

  tmAddColorBtn.onclick = function() {
    tmColorRows.appendChild(makeColorRow('', '', false));
    var inputs = tmColorRows.querySelectorAll('.tm-color-name');
    if (inputs.length) inputs[inputs.length - 1].focus();
  };
}

function readThemeColors() {
  var colors = {};
  var rows = tmColorRows.children;
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var nameEl = row.querySelector('.tm-color-name') || null;
    var token = nameEl ? nameEl.value.trim() : row.dataset.token;
    var value = row.querySelector('.tm-color-value').value.trim();
    if (token) colors[token] = value;
  }
  return colors;
}

function openThemeModal() {
  if (!config) return;
  var theme = config.theme || {};
  tmFontSize.value = theme.font_size !== undefined ? theme.font_size : 16;
  buildThemeColors(theme.colors || {});
  themeModal.classList.add('open');
  setTimeout(function() { tmFontSize.focus(); }, 50);
}

function closeThemeModal() {
  themeModal.classList.remove('open');
}

function saveTheme() {
  if (!config.theme) config.theme = {};
  var fontSize = parseInt(tmFontSize.value, 10);
  config.theme.font_size = (fontSize > 0) ? fontSize : 16;
  config.theme.colors = readThemeColors();
  pushHistory();
  closeThemeModal();
  renderPage();
}

// ── Entity Search ─────────────────────────────────────────────────────────────

var _entityCache    = null;   // array of HA state objects, fetched once
var _entityCallback = null;   // called with chosen entity_id
var _entityOptions  = null;   // optional filter hints from the calling field
var _attrMode       = false;  // true when modal is in attribute-browse mode
var _attrEntityId   = '';     // entity being browsed in attribute mode

function openEntitySearch(currentValue, onPick, options) {
  _entityCallback = onPick;
  _entityOptions  = options || null;

  entitySearchInput.value = currentValue || '';
  // Pre-set filters from options, otherwise reset to show everything
  entityDomainFilter.value = (_entityOptions && _entityOptions.domain) ? _entityOptions.domain : '';
  entityClassFilter.value  = '';
  entitySearchStatus.textContent = '';
  entitySearchList.innerHTML = '';
  entitySearchModal.classList.add('open');
  entitySearchInput.focus();
  entitySearchInput.select();

  if (_entityCache) {
    renderEntityList();
  } else {
    fetchEntities();
  }
}

function closeEntitySearch() {
  entitySearchModal.classList.remove('open');
  _entityCallback = null;
  _attrMode       = false;
  _attrEntityId   = '';
  entityFilterRow.style.display = '';
  entitySearchInput.placeholder = 'Type to filter by entity ID or name\u2026';
  // Restore modal title
  var titleEl = entitySearchModal.querySelector('.modal-header');
  if (titleEl) titleEl.childNodes[0].textContent = 'Search Entities';
}

// Open the search modal in attribute-browse mode.
// getEntity — zero-arg function that returns the entity_id to inspect (read at click time).
function openAttributeSearch(getEntity, currentValue, onPick) {
  var entityId = getEntity ? getEntity() : '';
  if (!entityId) {
    setStatus('Set an entity first before browsing attributes.', true);
    return;
  }

  _entityCallback = onPick;
  _entityOptions  = null;
  _attrMode     = true;
  _attrEntityId = entityId;

  entitySearchInput.value = '';
  entitySearchInput.placeholder = 'Filter attributes\u2026';
  entityDomainFilter.value = '';
  entityClassFilter.value  = '';
  entityFilterRow.style.display = 'none';
  entitySearchStatus.textContent = '';
  entitySearchList.innerHTML = '';

  // Switch modal title
  var titleEl = entitySearchModal.querySelector('.modal-header');
  if (titleEl) {
    titleEl.childNodes[0].textContent = 'Attributes \u2014 ' + entityId;
  }

  entitySearchModal.classList.add('open');
  entitySearchInput.focus();

  // If cache available use it; otherwise fetch first then render
  if (_entityCache) {
    renderAttributeList(entityId);
  } else {
    fetchEntities();
  }
}

function renderAttributeList(entityId) {
  entitySearchList.innerHTML = '';
  var state = _entityCache && _entityCache.find(function(s) { return s.entity_id === entityId; });

  entitySearchStatus.innerHTML = '';
  if (!state) {
    entitySearchStatus.textContent = 'Entity "' + entityId + '" not found in cache — try refreshing.';
    return;
  }

  var attrs = state.attributes || {};
  var keys  = Object.keys(attrs).sort();

  if (!keys.length) {
    entitySearchStatus.textContent = 'This entity has no attributes.';
    return;
  }

  var textFilter = entitySearchInput.value.trim().toLowerCase();
  var filtered   = keys.filter(function(k) { return !textFilter || k.indexOf(textFilter) !== -1; });

  var countSpan = document.createElement('span');
  countSpan.textContent = filtered.length + ' attribute' + (filtered.length === 1 ? '' : 's');
  entitySearchStatus.appendChild(countSpan);

  filtered.forEach(function(k) {
    var val = attrs[k];
    var valStr = (val === null || val === undefined) ? '' : (typeof val === 'object' ? JSON.stringify(val) : String(val));

    var item = document.createElement('div');
    item.className = 'entity-search-item';

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;';

    var nameEl = document.createElement('span');
    nameEl.className = 'esi-id';
    nameEl.textContent = k;

    var valEl = document.createElement('span');
    valEl.className = 'esi-state';
    valEl.textContent = valStr;
    valEl.style.maxWidth = '140px';
    valEl.style.overflow = 'hidden';
    valEl.style.textOverflow = 'ellipsis';
    valEl.style.whiteSpace = 'nowrap';
    valEl.title = valStr;

    row.appendChild(nameEl);
    row.appendChild(valEl);
    item.appendChild(row);

    item.addEventListener('click', function() {
      if (_entityCallback) _entityCallback(k);
      closeEntitySearch();
    });
    entitySearchList.appendChild(item);
  });
}

function fetchEntities() {
  var token = localStorage.getItem('haven_designer_token') || '';
  if (!token) {
    showTokenPrompt();
    return;
  }
  doFetchEntities(token);
}

function showTokenPrompt() {
  entitySearchStatus.innerHTML = '';
  entitySearchList.innerHTML = '';

  var wrap = document.createElement('div');
  wrap.style.cssText = 'padding:4px 2px 8px;';

  var msg = document.createElement('div');
  msg.style.cssText = 'font-size:12px;color:var(--muted);margin-bottom:8px;line-height:1.5;';
  msg.innerHTML = 'Enter a long-lived access token for Home Assistant.<br>' +
    'Create one in HA under <strong style="color:var(--text);">Profile \u2192 Long-lived access tokens</strong>.';
  wrap.appendChild(msg);

  var row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:6px;';

  var tokenInput = document.createElement('input');
  tokenInput.type = 'password';
  tokenInput.placeholder = 'Paste token here\u2026';
  tokenInput.style.cssText = 'flex:1;background:var(--panel2);color:var(--text);border:1px solid var(--border);' +
    'padding:6px 10px;border-radius:5px;font-size:12px;outline:none;';

  var saveBtn = document.createElement('button');
  saveBtn.textContent = 'Connect';
  saveBtn.style.cssText = 'background:var(--accent);color:#000;border-color:var(--accent);font-weight:600;padding:6px 12px;font-size:12px;';

  function tryConnect() {
    var t = tokenInput.value.trim();
    if (!t) return;
    try { localStorage.setItem('haven_designer_token', t); } catch(e) {}
    wrap.remove();
    doFetchEntities(t);
  }

  saveBtn.addEventListener('click', tryConnect);
  tokenInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') tryConnect(); });

  row.appendChild(tokenInput);
  row.appendChild(saveBtn);
  wrap.appendChild(row);
  entitySearchList.appendChild(wrap);
  tokenInput.focus();
}

function doFetchEntities(token) {
  entitySearchStatus.textContent = 'Connecting to Home Assistant\u2026';

  fetch(window.location.origin + '/api/states', {
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
  }).then(function (r) {
    if (r.status === 401) {
      localStorage.removeItem('haven_designer_token');
      throw new Error('Token rejected \u2014 please re-enter your token');
    }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(function (states) {
    _entityCache = states.sort(function (a, b) {
      return a.entity_id < b.entity_id ? -1 : 1;
    });
    if (_attrMode) {
      renderAttributeList(_attrEntityId);
    } else {
      renderEntityList();
    }
  }).catch(function (err) {
    entitySearchStatus.textContent = err.message;
    _entityCache = null;
    showTokenPrompt();
  });
}

function populateFilterDropdowns() {
  var domains  = {};
  var classes  = {};
  _entityCache.forEach(function (s) {
    var domain = s.entity_id.split('.')[0];
    domains[domain] = (domains[domain] || 0) + 1;
    var dc = s.attributes && s.attributes.device_class;
    if (dc) classes[dc] = (classes[dc] || 0) + 1;
  });

  var prevDomain = entityDomainFilter.value;
  var prevClass  = entityClassFilter.value;

  entityDomainFilter.innerHTML = '<option value="">All domains</option>';
  Object.keys(domains).sort().forEach(function (d) {
    var opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d + ' (' + domains[d] + ')';
    entityDomainFilter.appendChild(opt);
  });
  entityDomainFilter.value = prevDomain;

  entityClassFilter.innerHTML = '<option value="">All device classes</option>';
  Object.keys(classes).sort().forEach(function (c) {
    var opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c + ' (' + classes[c] + ')';
    entityClassFilter.appendChild(opt);
  });
  entityClassFilter.value = prevClass;
}

function renderEntityList() {
  entitySearchList.innerHTML = '';
  if (!_entityCache) return;

  populateFilterDropdowns();

  var textFilter   = entitySearchInput.value.trim().toLowerCase();
  var domainFilter = entityDomainFilter.value;
  var classFilter  = entityClassFilter.value;

  var requireStateClass = _entityOptions && _entityOptions.requireStateClass;

  var results = _entityCache.filter(function (s) {
    if (domainFilter && s.entity_id.split('.')[0] !== domainFilter) return false;
    var dc = s.attributes && s.attributes.device_class || '';
    if (classFilter && dc !== classFilter) return false;
    if (requireStateClass && !(s.attributes && s.attributes.state_class)) return false;
    if (!textFilter) return true;
    var name = (s.attributes && s.attributes.friendly_name || '').toLowerCase();
    return s.entity_id.indexOf(textFilter) !== -1 || name.indexOf(textFilter) !== -1;
  });

  entitySearchStatus.innerHTML = '';
  if (requireStateClass) {
    var hint = document.createElement('span');
    hint.style.cssText = 'display:inline-block;margin-bottom:4px;color:var(--accent);';
    hint.textContent = 'Showing sensors with long-term statistics (state_class) only';
    entitySearchStatus.appendChild(hint);
    entitySearchStatus.appendChild(document.createElement('br'));
  }
  var countSpan = document.createElement('span');
  countSpan.textContent = results.length + ' of ' + _entityCache.length + ' entities';
  var clearLink = document.createElement('a');
  clearLink.textContent = 'Change token';
  clearLink.href = '#';
  clearLink.style.cssText = 'margin-left:10px;color:var(--muted);font-size:11px;';
  clearLink.addEventListener('click', function(e) {
    e.preventDefault();
    localStorage.removeItem('haven_designer_token');
    _entityCache = null;
    showTokenPrompt();
  });
  entitySearchStatus.appendChild(countSpan);
  entitySearchStatus.appendChild(clearLink);

  results.slice(0, 200).forEach(function (s) {
    var item = document.createElement('div');
    item.className = 'entity-search-item';

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;';

    var idEl = document.createElement('span');
    idEl.className = 'esi-id';
    idEl.textContent = s.entity_id;

    var stateEl = document.createElement('span');
    stateEl.className = 'esi-state';
    stateEl.textContent = s.state;

    row.appendChild(idEl);
    row.appendChild(stateEl);
    item.appendChild(row);

    var name = s.attributes && s.attributes.friendly_name;
    if (name && name !== s.entity_id) {
      var nameEl = document.createElement('span');
      nameEl.className = 'esi-name';
      nameEl.textContent = name;
      item.appendChild(nameEl);
    }

    item.addEventListener('click', function () {
      if (_entityCallback) _entityCallback(s.entity_id);
      closeEntitySearch();
    });

    entitySearchList.appendChild(item);
  });
}

function openDevicePropsModal() {
  if (!config) return;
  var d = config.device;
  var pageNav = (d.page_navigation && typeof d.page_navigation === 'object')
    ? d.page_navigation
    : ((d.page_nav && typeof d.page_nav === 'object') ? d.page_nav : {});

  // File info
  dpFilename.textContent = currentDevice ? currentDevice + '.json' : '(not saved yet)';
  dpFolder.textContent   = devicesDirHandle ? devicesDirHandle.name : '(not saved yet — click Save to choose location)';

  // Device name
  dpName.value = d.name || '';

  // Canvas size — match to a preset, fallback to custom
  var cw = d.canvas.width, ch = d.canvas.height;
  var preset = CANVAS_PRESETS.find(function (p) { return p.w === cw && p.h === ch; });
  if (preset) {
    dpPreset.value = preset.value;
    dpCustomRow.classList.remove('visible');
  } else {
    dpPreset.value = 'custom';
    dpCustomRow.classList.add('visible');
    dpW.value = cw;
    dpH.value = ch;
  }

  // Default page — populate select with current pages
  dpDefaultPage.innerHTML = '';
  config.pages.forEach(function (p) {
    if (p.id === 0) return;
    var opt = document.createElement('option');
    opt.value       = p.id;
    opt.textContent = (p.label || ('Page ' + p.id)) + '  (#' + p.id + ')';
    dpDefaultPage.appendChild(opt);
  });
  dpDefaultPage.value = d.default_page !== undefined ? String(d.default_page) : '1';

  dpReturnDefault.value = d.return_to_default !== undefined ? d.return_to_default : 60;
  dpShowConnIndicator.checked = d.show_connection_indicator !== false;
  dpPageNavShow.checked = pageNav.show !== false;
  dpPageNavSize.value = pageNav.size !== undefined ? String(pageNav.size) : '';
  dpPageNavBg.value = pageNav.background_color !== undefined ? String(pageNav.background_color) : '';
  dpPageNavPrimary.value = pageNav.primary_color !== undefined ? String(pageNav.primary_color) : '';
  dpPageNavSecondary.value = pageNav.secondary_color !== undefined ? String(pageNav.secondary_color) : '';


  // Screensaver
  var ss = d.screensaver || {};
  dpSsTimeout.value = ss.timeout !== undefined ? ss.timeout : '';
  dpSsOpacity.value = ss.opacity !== undefined ? ss.opacity : '';
  dpSsText.value    = ss.hasOwnProperty('text') ? ss.text : '';

  // HA connection
  dpHaToken.value = d.ha_token || '';
  dpHaUrl.value   = d.ha_url   || '';

  devicePropsModal.classList.add('open');
  setTimeout(function () { dpName.focus(); dpName.select(); }, 50);
}

function closeDevicePropsModal() {
  devicePropsModal.classList.remove('open');
}

function saveDeviceProps() {
  if (!config) return;

  var name = dpName.value.trim();
  if (!name) {
    dpName.focus();
    dpName.style.borderColor = '#D9534F';
    setTimeout(function () { dpName.style.borderColor = ''; }, 1500);
    return;
  }

  var width, height;
  if (dpPreset.value === 'custom') {
    width  = parseInt(dpW.value, 10);
    height = parseInt(dpH.value, 10);
    if (!width || !height || width < 100 || height < 100) {
      setStatus('Invalid canvas dimensions', true);
      return;
    }
  } else {
    var parts = dpPreset.value.split('x');
    width  = parseInt(parts[0], 10);
    height = parseInt(parts[1], 10);
  }

  var defaultPage    = parseInt(dpDefaultPage.value, 10)   || 1;
  var returnDefault  = parseInt(dpReturnDefault.value, 10);
  if (isNaN(returnDefault) || returnDefault < 0) returnDefault = 0;
  var hadNavCfg = ((config.device.page_nav && typeof config.device.page_nav === 'object') ||
                   (config.device.page_navigation && typeof config.device.page_navigation === 'object'));
  var navShow = !!dpPageNavShow.checked;
  var navSize = (dpPageNavSize.value || '').trim();
  var navBg = (dpPageNavBg.value || '').trim();
  var navPrimary = (dpPageNavPrimary.value || '').trim();
  var navSecondary = (dpPageNavSecondary.value || '').trim();

  var canvasChanged = (config.device.canvas.width !== width || config.device.canvas.height !== height);

  config.device.name             = name;
  config.device.canvas.width     = width;
  config.device.canvas.height    = height;
  config.device.default_page     = defaultPage;
  config.device.return_to_default = returnDefault;
  if (dpShowConnIndicator.checked) {
    delete config.device.show_connection_indicator;
  } else {
    config.device.show_connection_indicator = false;
  }

  var navCfg = {};
  navCfg.show = navShow;
  if (navSize) navCfg.size = navSize;
  if (navBg) navCfg.background_color = navBg;
  if (navPrimary) navCfg.primary_color = navPrimary;
  if (navSecondary) navCfg.secondary_color = navSecondary;
  if (!navShow || navSize || navBg || navPrimary || navSecondary || hadNavCfg) {
    config.device.page_nav = navCfg;
  } else {
    delete config.device.page_nav;
  }
  // Keep a single source of truth in saved config.
  if (config.device.page_navigation !== undefined) delete config.device.page_navigation;

  // Screensaver
  var ssTimeout = parseInt(dpSsTimeout.value, 10);
  if (!isNaN(ssTimeout) && ssTimeout > 0) {
    var ssCfg = { timeout: ssTimeout };
    var ssOpacity = parseFloat(dpSsOpacity.value);
    if (!isNaN(ssOpacity)) ssCfg.opacity = ssOpacity;
    if (dpSsText.value !== '') ssCfg.text = dpSsText.value;
    config.device.screensaver = ssCfg;
  } else {
    delete config.device.screensaver;
  }

  // HA connection — store under device block, clear if empty
  var haToken = dpHaToken.value.trim();
  var haUrl   = dpHaUrl.value.trim().replace(/\/$/, '');
  if (haToken) { config.device.ha_token = haToken; } else { delete config.device.ha_token; }
  if (haUrl)   { config.device.ha_url   = haUrl;   } else { delete config.device.ha_url;   }

  // Also update currentDevice slug if name changed and no file was picked yet
  if (!devicesDirHandle && currentDevice) {
    currentDevice = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '') || currentDevice;
  }

  pushHistory();
  closeDevicePropsModal();

  if (canvasChanged) {
    // Rebuild the stage at the new canvas size
    setupStage();
    buildPageSelect();
    renderPage();
    setStatus('Canvas resized to ' + width + ' × ' + height, true);
  } else {
    setStatus('Device properties saved', true);
  }
}

// ── New Device modal ─────────────────────────────────────────────────────────

function openNewDeviceModal() {
  ndmName.value = '';
  ndmPreset.value = '1024x768';
  ndmCustomRow.classList.remove('visible');
  newDeviceModal.classList.add('open');
  // Focus name input after transition
  setTimeout(function () { ndmName.focus(); }, 50);
}

function closeNewDeviceModal() {
  newDeviceModal.classList.remove('open');
}

function createNewDevice() {
  var name = ndmName.value.trim();
  if (!name) {
    ndmName.focus();
    ndmName.style.borderColor = '#D9534F';
    setTimeout(function () { ndmName.style.borderColor = ''; }, 1500);
    return;
  }

  var width, height;
  if (ndmPreset.value === 'custom') {
    width  = parseInt(ndmW.value, 10);
    height = parseInt(ndmH.value, 10);
    if (!width || !height || width < 100 || height < 100) {
      setStatus('Invalid canvas dimensions', true);
      return;
    }
  } else {
    var parts = ndmPreset.value.split('x');
    width  = parseInt(parts[0], 10);
    height = parseInt(parts[1], 10);
  }

  // Slugify name for the filename
  var slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
  if (!slug) slug = 'device';

  config = {
    version: '1.0',
    device: {
      name: name,
      canvas: { width: width, height: height },
      default_page: 1,
      return_to_default: 60
    },
    theme: {
      colors: {
        background:    '#161C23',
        surface:       '#272E36',
        surface2:      '#363f4a',
        primary:       '#8ADF45',
        warning:       '#F0AD4E',
        danger:        '#D9534F',
        text:          '#FFFFFF',
        text_dim:      '#e6e6e6',
        text_muted:    '#9fa5ad',
        icon_inactive: '#464c53'
      },
      font_size: 16
    },
    pages: [
      { id: 1, label: 'Home', widgets: [] }
    ]
  };

  currentDevice = slug;
  currentPageId = 1;
  hidden = {};
  locked = {};
  resetHistory();
  setupStage();
  buildPageSelect();
  renderPage();
  hideWelcome();
  closeNewDeviceModal();
  setStatus('New device "' + name + '" created — click Save to write the file', true);
}

// Scroll/pan the stage the minimum amount needed to bring the widget into view.
// Strategy: adjust Y first (vertical scroll), then X only if also off-screen.
// If the widget is already fully visible, do nothing.
function scrollToWidget(id) {
  var w = getWidgetById(id);
  if (!w || !stage) return;

  var wx    = w.x  || 0;
  var wy    = w.y  || 0;
  var ww    = w.w  || 0;
  var wh    = w.h  || 0;
  var scale = stage.scaleX();
  var pad   = 20;  // canvas-pixel breathing room around revealed widget

  // Visible canvas bounds in canvas coordinates
  var vl = -stage.x() / scale;
  var vt = -stage.y() / scale;
  var vr = (stage.width()  - stage.x()) / scale;
  var vb = (stage.height() - stage.y()) / scale;

  // Widget fully on screen — nothing to do
  if (wx >= vl && wx + ww <= vr && wy >= vt && wy + wh <= vb) return;

  var newX = stage.x();
  var newY = stage.y();

  // Vertical: scroll up or down just enough to show the widget
  if (wy < vt) {
    newY = -(wy - pad) * scale;                       // widget above — scroll up
  } else if (wy + wh > vb) {
    newY = stage.height() - (wy + wh + pad) * scale; // widget below — scroll down
  }

  // Horizontal: only pan if widget is also off-screen left or right
  if (wx < vl) {
    newX = -(wx - pad) * scale;                       // widget left — pan left
  } else if (wx + ww > vr) {
    newX = stage.width() - (wx + ww + pad) * scale;  // widget right — pan right
  }

  stage.position({ x: newX, y: newY });
  stage.batchDraw();
  syncPreviewTransform();
}

// Returns the widgets array for the current page
function getCurrentWidgets() {
  if (!config) return [];
  var page = config.pages.find(function (p) { return p.id === currentPageId; });
  return page ? (page.widgets || []) : [];
}

function loadLocked() {
  locked = {};
  if (config && config.designer && config.designer.locked && config.designer.locked[currentPageId]) {
    var ids = config.designer.locked[currentPageId];
    ids.forEach(function (id) { locked[id] = true; });
  }
}

function saveLocked() {
  if (!config) return;
  config.designer = config.designer || {};
  config.designer.locked = config.designer.locked || {};
  // Store only the IDs that are actually locked (sparse list)
  var ids = [];
  Object.keys(locked).forEach(function (id) { if (locked[id]) ids.push(id); });
  config.designer.locked[currentPageId] = ids;
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
  isDirty = false;
  pushHistory(true);
}

function pushHistory(isInit) {
  if (!config) return;
  var snap = JSON.stringify(config);
  if (!isInit && undoStack.length && undoStack[undoStack.length - 1] === snap) return;
  undoStack.push(snap);
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  if (!isInit) { redoStack = []; isDirty = true; }
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
  copyBtn.disabled = !selectedIds.length;
  cutBtn.disabled = !selectedIds.length;
  pasteBtn.disabled = !(widgetClipboard && widgetClipboard.items && widgetClipboard.items.length);
}

async function saveConfig() {
  if (!config) return;
  if (!window.showDirectoryPicker) {
    setStatus('Save not supported in this browser', true);
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
    isDirty = false;
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
  isDirty = false;
}

function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}

function getIdleStatusText() {
  if (!currentDevice) return '';
  return currentDevice + '.json';
}

function setStatus(msg, clearOnNext) {
  statusEl.textContent = (msg !== undefined && msg !== null && msg !== '') ? msg : getIdleStatusText();
  if (!clearOnNext) return;
  var cleared = false;
  function clear() {
    if (cleared) return;
    cleared = true;
    statusEl.textContent = getIdleStatusText();
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
  previewBtn.classList.toggle('active', previewActive);

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
    '<title>HAven Preview</title>',
    '<script>window.HAVEN_PREVIEW = true;</script>',
    '<script>window.HAVEN_OVERRIDE_CONFIG = ' + payload + ';</script>',
    '<script>window.HAVEN_OVERRIDE_PAGE = ' + Number(currentPageId) + ';</script>',
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
  if (key && typeof key === 'object' && key.replace_widget) {
    var oldId = w.id;
    var next = key.value || {};
    for (var wk in w) {
      if (w.hasOwnProperty(wk)) delete w[wk];
    }
    for (var nk in next) {
      if (next.hasOwnProperty(nk)) w[nk] = next[nk];
    }

    if (!w.id && oldId) w.id = oldId;
    if (oldId && w.id !== oldId) {
      if (selectedIds[0] === oldId) selectedIds[0] = w.id;
      if (hidden.hasOwnProperty(oldId)) {
        hidden[w.id] = hidden[oldId];
        delete hidden[oldId];
      }
      if (locked.hasOwnProperty(oldId)) {
        locked[w.id] = locked[oldId];
        delete locked[oldId];
        saveLocked();
      }
    }
    renderPage();
    return;
  }
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

function isEditableFocus() {
  var el = document.activeElement;
  if (!el) return false;
  var tag = (el.tagName || '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || !!el.isContentEditable;
}

function copySelectionToClipboard() {
  if (!config || !selectedIds.length) return false;
  var items = [];
  selectedIds.forEach(function (id) {
    var entry = findWidgetEntry(id);
    if (!entry || !entry.widget || !entry.page) return;
    items.push({
      pageId: entry.page.id,
      widget: JSON.parse(JSON.stringify(entry.widget))
    });
  });
  if (!items.length) return false;
  widgetClipboard = { items: items, copiedAt: Date.now() };
  clipboardPasteCount = 0;
  setStatus('Copied ' + items.length + ' widget' + (items.length === 1 ? '' : 's'), true);
  updateHistoryButtons();
  return true;
}

function cutSelectionToClipboard() {
  if (!copySelectionToClipboard()) return false;
  pushHistory();
  selectedIds.forEach(function (id) { removeWidgetById(id); });
  selectedIds = [];
  renderPage();
  setStatus('Cut selection', true);
  return true;
}

function pasteClipboardSelection() {
  if (!config || !widgetClipboard || !widgetClipboard.items || !widgetClipboard.items.length) return false;
  var pageById = {};
  config.pages.forEach(function (p) { pageById[p.id] = p; });

  var offset = 16 * (clipboardPasteCount + 1);
  var newIds = [];
  pushHistory();

  widgetClipboard.items.forEach(function (item) {
    if (!item || !item.widget) return;
    var destPage;
    if (item.pageId === 0 && pageById[0]) {
      // Keep page-0 overlays in page 0.
      destPage = pageById[0];
    } else {
      destPage = pageById[currentPageId];
    }
    if (!destPage || !destPage.widgets) return;

    var copy = JSON.parse(JSON.stringify(item.widget));
    copy.id = generateId(copy.type || 'widget');
    copy.x = (copy.x || 0) + offset;
    copy.y = (copy.y || 0) + offset;
    destPage.widgets.push(copy);
    newIds.push(copy.id);
  });

  if (!newIds.length) return false;
  clipboardPasteCount++;
  selectedIds = newIds;
  renderPage();
  setStatus('Pasted ' + newIds.length + ' widget' + (newIds.length === 1 ? '' : 's'), true);
  return true;
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
  if (type === 'button') {
    w.w = 160;
    w.h = 120;
    w.label = 'Button';
    w.icon = '[mdi:gesture-tap-button]';
    w.background = 'surface';
    w.icon_color = 'text';
    w.label_color = 'text_muted';
    w.radius = 14;
  }
  if (type === 'image') {
    w.w = 220;
    w.h = 160;
    w.fit = 'cover';
    w.radius = 8;
  }
  if (type === 'bar') {
    w.w = 280;
    w.h = 20;
    w.max = 100;
    w.color = 'primary';
    w.background = 'surface2';
  }
  if (type === 'arc') {
    w.w = 180;
    w.h = 180;
    w.min = 0;
    w.max = 100;
    w.start_angle = 135;
    w.end_angle = 405;
    w.line_width = 12;
    w.background = 'surface2';
    w.color = 'primary';
    w.label = 'Value';
    w.label_color = 'text_muted';
    w.format = 'percent';
  }
  if (type === 'slider') {
    w.w = 280;
    w.h = 36;
    w.min = 0;
    w.max = 100;
    w.step = 1;
    w.orientation = 'horizontal';
    w.update_mode = 'release';
    w.background = 'surface2';
    w.color = 'primary';
    w.thumb_color = 'text';
    w.radius = 18;
    w.thumb_size = 24;
  }
  if (type === 'switch') {
    w.w = 180;
    w.h = 36;
    w.on_value = 'on';
    w.off_value = 'off';
    w.color = 'surface2';
    w.thumb_color = 'text';
    w.radius = 18;
    w.padding = 3;
    w.overrides = [
      { when: { logic: 'all', conditions: [{ type: 'equals', value: 'on' }] },
        set: { color: 'primary' } }
    ];
  }
  if (type === 'scene') {
    w.w = 320;
    w.h = 56;
    w.layout = 'buttons';
    w.options = ['off', 'on'];
    w.background = 'transparent';
    w.option_background = 'surface2';
    w.option_color = 'text';
    w.selected_background = 'primary';
    w.selected_color = 'background';
  }
  if (type === 'clock') {
    w.w = 150;
    w.h = 36;
    w.font_size = 26;
    w.align = 'left';
    w.color = 'text';
    w.background = 'surface';
  }
  if (type === 'camera') {
    w.w = 360;
    w.h = 220;
    w.label = 'Camera';
    w.preview = 'mjpeg';
    w.fit = 'cover';
    w.radius = 8;
    w.refresh_interval = 5;
  }
  if (type === 'agenda') {
    w.w = 520;
    w.h = 320;
    w.layout = 'list';
    w.background = 'surface';
    w.days_ahead = 7;
    w.refresh_interval = 120;
    w.show_month_headers = true;
    w.show_blank_days = false;
    w.today_indicator = true;
    w.time_format = '12h';
    w.calendars = [];
  }
  if (type === 'history_chart') {
    w.w = 520;
    w.h = 240;
    w.background = 'surface';
    w.color = 'primary';
    w.bars = 24;
    w.period = 'day';
    w.value_field = 'sum';
    w.aggregate = 'sum';
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
