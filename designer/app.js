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

var pickDeviceBtn = document.getElementById('pickDeviceBtn');
var pageSelect = document.getElementById('pageSelect');
var gridSelect = document.getElementById('gridSelect');
var toggleSnap = document.getElementById('toggleSnap');
var togglePan = document.getElementById('togglePan');
var undoBtn = document.getElementById('undoBtn');
var redoBtn = document.getElementById('redoBtn');
var saveBtn = document.getElementById('saveBtn');
var previewBtn = document.getElementById('previewBtn');
var addLabelBtn  = document.getElementById('addLabelBtn');
var addRectBtn   = document.getElementById('addRectBtn');
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
  saveBtn.addEventListener('click', function () { saveConfig(); });
  previewBtn.addEventListener('click', function () { togglePreview(); });
  addLabelBtn.addEventListener('click', function () { addWidget('label'); });
  addRectBtn.addEventListener('click', function () { addWidget('rectangle'); });
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
    try { localStorage.setItem('webhasp_designer_last_device', name); } catch (e) {}

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
      // Convert to canvas coords, snap to grid, convert back.
      if (!snapEnabled) return newBox;
      var sc = stage.scaleX();
      var ox = stage.x();
      var oy = stage.y();
      var s  = gridSize * sc;
      return {
        x:        Math.round((newBox.x - ox) / s) * s + ox,
        y:        Math.round((newBox.y - oy) / s) * s + oy,
        width:    Math.max(s, Math.round(newBox.width  / s) * s),
        height:   Math.max(s, Math.round(newBox.height / s) * s),
        rotation: newBox.rotation
      };
    }
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
  updateProps(propsEl, getSelectedWidgets(), onPropChange, onDeleteSelected, onDuplicateSelected, onAlignSelected, config.theme);
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
    updateProps(propsEl, w, onPropChange, onDeleteSelected, onDuplicateSelected, undefined, config.theme);
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
    updateProps(propsEl, w, onPropChange, onDeleteSelected, onDuplicateSelected, undefined, config.theme);
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
    if (page.id === 0) return; // skip overlay page
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

  // Background image — text path + upload button + thumbnail
  addModalPropImageUpload(pageModalProps, page);

  // Background opacity
  addModalPropNumber(pageModalProps, 'Background Opacity (0–1)', page.background_image_opacity !== undefined ? page.background_image_opacity : 1, 0, 1, 0.05, function (val) {
    page.background_image_opacity = val;
    pushHistory();
  });

  // Background fit
  addModalPropSelect(pageModalProps, 'Background Fit', page.background_image_fit || 'cover',
    ['cover', 'contain', 'fill', 'none'],
    function (val) {
      page.background_image_fit = val;
      pushHistory();
    }
  );
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
      setStatus('Select your webhasp images/ folder…', false);
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

function openDevicePropsModal() {
  if (!config) return;
  var d = config.device;

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

  var canvasChanged = (config.device.canvas.width !== width || config.device.canvas.height !== height);

  config.device.name             = name;
  config.device.canvas.width     = width;
  config.device.canvas.height    = height;
  config.device.default_page     = defaultPage;
  config.device.return_to_default = returnDefault;

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
