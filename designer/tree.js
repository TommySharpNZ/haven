export function renderTree(container, widgets, selectedIds, hiddenMap, onSelect, onToggle) {
  container.innerHTML = '';
  var sel = selectedIds || [];
  widgets.forEach(function (w, idx) {
    var item = document.createElement('div');
    item.className = 'tree-item' + (sel.indexOf(w.id) !== -1 ? ' active' : '');

    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !hiddenMap[w.id];
    cb.addEventListener('click', function (e) {
      e.stopPropagation();
      onToggle(w.id, !cb.checked);
    });

    var text = document.createElement('div');
    text.innerHTML = '<strong>' + (w.id || '(no id)') + '</strong> <span class="meta">' + (w.type || 'unknown') + '</span>';

    var order = document.createElement('div');
    order.className = 'meta';
    order.textContent = '#' + idx;

    item.appendChild(cb);
    item.appendChild(text);
    item.appendChild(order);

    item.addEventListener('click', function (e) {
      onSelect(w.id, e.shiftKey);
    });

    container.appendChild(item);
  });
}
