// Type badges: short letter + colour per widget type
var BADGES = {
  label:         { char: 'L', color: '#3a9' },
  rectangle:     { char: 'R', color: '#568' },
  button:        { char: 'B', color: '#86a' },
  bar:           { char: 'b', color: '#a74' },
  arc:           { char: 'A', color: '#a49' },
  clock:         { char: 'C', color: '#559' },
  image:         { char: 'I', color: '#779' },
  camera:        { char: '⌾', color: '#477' },
  history_chart: { char: 'H', color: '#4a8' }
};

// renderTree — builds the widget list in the left sidebar.
//
// Parameters:
//   container    - DOM element to render into
//   widgets      - array of widget config objects for the current page
//   selectedIds  - array of currently selected widget IDs
//   hiddenMap    - { id: bool } — true = hidden on canvas
//   lockedMap    - { id: bool } — true = locked (can't drag/select on canvas)
//   filterText   - string — filters rows by id, name, or type (empty = show all)
//   onSelect     - fn(id, additive) — called when row is clicked
//   onToggleHide - fn(id, newHiddenState)
//   onToggleLock - fn(id, newLockedState)
//   onReorder    - fn(fromId, toId, before) — called when drag-drop reorder completes
export function renderTree(container, widgets, selectedIds, hiddenMap, lockedMap, filterText, onSelect, onToggleHide, onToggleLock, onReorder) {
  container.innerHTML = '';
  var sel    = selectedIds || [];
  var filter = (filterText || '').toLowerCase().trim();

  // Track drag state in closure so all event handlers share it
  var dragId = null;

  widgets.forEach(function (w, idx) {
    // Search filter — match against name, id, and type
    if (filter) {
      var haystack = ((w.name || '') + ' ' + (w.id || '') + ' ' + (w.type || '')).toLowerCase();
      if (haystack.indexOf(filter) === -1) return;
    }

    var isHidden = !!hiddenMap[w.id];
    var isLocked = !!lockedMap[w.id];
    var isActive = sel.indexOf(w.id) !== -1;

    var item = document.createElement('div');
    item.className = 'tree-item' + (isActive ? ' active' : '') + (isLocked ? ' locked' : '');
    item.dataset.id = w.id;
    item.draggable = true;

    // --- Eye button (visible / hidden toggle) ---
    var eyeBtn = document.createElement('button');
    eyeBtn.className = 'tree-icon-btn';
    eyeBtn.title     = isHidden ? 'Show' : 'Hide';
    eyeBtn.textContent = isHidden ? '○' : '●';
    eyeBtn.style.color = isHidden ? '#555' : '#8ADF45';
    eyeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      onToggleHide(w.id, !isHidden);
    });

    // --- Lock button ---
    var lockBtn = document.createElement('button');
    lockBtn.className = 'tree-icon-btn';
    lockBtn.title     = isLocked ? 'Unlock' : 'Lock';
    lockBtn.textContent = '🔒';
    lockBtn.style.opacity = isLocked ? '1' : '0.2';
    lockBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      onToggleLock(w.id, !isLocked);
    });

    // --- Type badge ---
    var badge   = BADGES[w.type] || { char: '?', color: '#555' };
    var badgeEl = document.createElement('span');
    badgeEl.className        = 'tree-badge';
    badgeEl.textContent      = badge.char;
    badgeEl.style.background = badge.color;

    // --- Name / ID label ---
    // If the widget has a .name set, show it bold with the ID smaller beneath.
    // Otherwise show the ID bold with the type as meta.
    var text = document.createElement('div');
    text.className = 'tree-main';
    if (w.name) {
      text.innerHTML = '<strong>' + escHtml(w.name) + '</strong>'
        + ' <span class="meta">' + escHtml(w.id || '') + '</span>';
    } else {
      text.innerHTML = '<strong>' + escHtml(w.id || '(no id)') + '</strong>'
        + ' <span class="meta">' + escHtml(w.type || 'unknown') + '</span>';
    }

    // --- Z-order index ---
    var order = document.createElement('div');
    order.className   = 'meta';
    order.textContent = '#' + idx;
    order.style.flexShrink = '0';

    item.appendChild(eyeBtn);
    item.appendChild(lockBtn);
    item.appendChild(badgeEl);
    item.appendChild(text);
    item.appendChild(order);

    // Clicking a locked item does nothing — unlock it first via the padlock button
    item.addEventListener('click', function (e) {
      if (isLocked) return;
      onSelect(w.id, !!e.shiftKey);
    });

    // --- Drag-to-reorder events ---
    item.addEventListener('dragstart', function (e) {
      dragId = w.id;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', w.id);
    });

    item.addEventListener('dragend', function () {
      dragId = null;
      item.classList.remove('dragging');
      clearDropIndicators();
    });

    item.addEventListener('dragover', function (e) {
      if (!dragId || dragId === w.id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      clearDropIndicators();
      var rect = item.getBoundingClientRect();
      var mid  = rect.top + rect.height / 2;
      if (e.clientY < mid) {
        item.classList.add('drag-over-above');
      } else {
        item.classList.add('drag-over-below');
      }
    });

    item.addEventListener('dragleave', function (e) {
      // Only clear when leaving this element entirely (not a child)
      if (!item.contains(e.relatedTarget)) {
        item.classList.remove('drag-over-above');
        item.classList.remove('drag-over-below');
      }
    });

    item.addEventListener('drop', function (e) {
      e.preventDefault();
      if (!dragId || dragId === w.id) { clearDropIndicators(); return; }
      var rect   = item.getBoundingClientRect();
      var before = e.clientY < (rect.top + rect.height / 2);
      clearDropIndicators();
      if (onReorder) onReorder(dragId, w.id, before);
    });

    container.appendChild(item);
  });

  function clearDropIndicators() {
    var items = container.querySelectorAll('.tree-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.remove('drag-over-above', 'drag-over-below');
    }
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
