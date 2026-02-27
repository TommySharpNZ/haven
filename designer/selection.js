export function updateProps(container, selection, onChange, onDelete, onDuplicate, onAlign) {
  container.innerHTML = '';
  if (!selection || !selection.length) {
    container.innerHTML = '<div class="prop">No selection</div>';
    return;
  }

  var reorderTitle = document.createElement('div');
  reorderTitle.className = 'prop';
  reorderTitle.innerHTML = '<strong>Reorder</strong>';
  container.appendChild(reorderTitle);

  var reorderRow = document.createElement('div');
  reorderRow.className = 'prop';
  reorderRow.appendChild(makeAlignButton('Bring To Front', function () { onAlign('front'); }));
  reorderRow.appendChild(makeAlignButton('Send To Back', function () { onAlign('back'); }));
  container.appendChild(reorderRow);

  var reorderRow2 = document.createElement('div');
  reorderRow2.className = 'prop';
  reorderRow2.appendChild(makeAlignButton('Move Up', function () { onAlign('up'); }));
  reorderRow2.appendChild(makeAlignButton('Move Down', function () { onAlign('down'); }));
  container.appendChild(reorderRow2);

  if (selection.length > 1) {
    var headerMulti = document.createElement('div');
    headerMulti.className = 'prop';
    headerMulti.innerHTML = '<strong>Multiple selection</strong> <span class="meta">' + selection.length + ' items</span>';
    container.appendChild(headerMulti);

    var actionsMulti = document.createElement('div');
    actionsMulti.className = 'prop';
    var delBtnM = document.createElement('button');
    delBtnM.textContent = 'Delete Selected';
    delBtnM.addEventListener('click', function () { onDelete(); });
    var dupBtnM = document.createElement('button');
    dupBtnM.textContent = 'Duplicate Selected';
    dupBtnM.style.marginLeft = '6px';
    dupBtnM.addEventListener('click', function () { onDuplicate(); });
    actionsMulti.appendChild(delBtnM);
    actionsMulti.appendChild(dupBtnM);
    container.appendChild(actionsMulti);

    var alignTitle = document.createElement('div');
    alignTitle.className = 'prop';
    alignTitle.innerHTML = '<strong>Align To First Selected</strong>';
    container.appendChild(alignTitle);

    var row = document.createElement('div');
    row.className = 'prop';
    row.appendChild(makeAlignButton('Left', function () { onAlign('left'); }));
    row.appendChild(makeAlignButton('Center', function () { onAlign('center'); }));
    row.appendChild(makeAlignButton('Right', function () { onAlign('right'); }));
    container.appendChild(row);

    var row2 = document.createElement('div');
    row2.className = 'prop';
    row2.appendChild(makeAlignButton('Top', function () { onAlign('top'); }));
    row2.appendChild(makeAlignButton('Middle', function () { onAlign('middle'); }));
    row2.appendChild(makeAlignButton('Bottom', function () { onAlign('bottom'); }));
    container.appendChild(row2);
    return;
  }

  var w = selection[0];
  var header = document.createElement('div');
  header.className = 'prop';
  header.innerHTML = '<strong>' + (w.id || '(no id)') + '</strong> <span class="meta">' + (w.type || 'unknown') + '</span>';
  container.appendChild(header);

  var actions = document.createElement('div');
  actions.className = 'prop';
  var delBtn = document.createElement('button');
  delBtn.textContent = 'Delete';
  delBtn.addEventListener('click', function () { onDelete(); });
  var dupBtn = document.createElement('button');
  dupBtn.textContent = 'Duplicate';
  dupBtn.style.marginLeft = '6px';
  dupBtn.addEventListener('click', function () { onDuplicate(); });
  actions.appendChild(delBtn);
  actions.appendChild(dupBtn);
  container.appendChild(actions);

  addXYWHRow(container, w, onChange);

  if (w.type === 'label') {
    addText(container, 'text', w.text, onChange);
    addNumber(container, 'font_size', w.font_size, onChange);
    addSelect(container, 'align', w.align, ['left', 'center', 'right'], onChange);
    addSelect(container, 'valign', w.valign, ['top', 'center', 'bottom'], onChange);
    addText(container, 'color', w.color, onChange);
    addText(container, 'background', w.background, onChange);

    addOverridesEditor(container, w, onChange);
  }

  if (w.type === 'rectangle' || w.type === 'button') {
    addText(container, 'background', w.background, onChange);
    addNumber(container, 'radius', w.radius, onChange);
  }
}

function makeAlignButton(label, onClick) {
  var btn = document.createElement('button');
  btn.textContent = label;
  btn.style.marginRight = '6px';
  btn.addEventListener('click', function () { onClick(); });
  return btn;
}

function addRow(container, label, input) {
  var row = document.createElement('div');
  row.className = 'prop';
  var lab = document.createElement('div');
  lab.textContent = label;
  row.appendChild(lab);
  row.appendChild(input);
  container.appendChild(row);
}

function addXYWHRow(container, w, onChange) {
  var row = document.createElement('div');
  row.className = 'prop';
  var labels = document.createElement('div');
  labels.className = 'prop-labels';
  labels.innerHTML = '<div>x</div><div>y</div><div>w</div><div>h</div>';
  row.appendChild(labels);

  var inputRow = document.createElement('div');
  inputRow.className = 'prop-row';
  inputRow.appendChild(makeNumberInput(w.x, function (v) { onChange('x', v); }));
  inputRow.appendChild(makeNumberInput(w.y, function (v) { onChange('y', v); }));
  inputRow.appendChild(makeNumberInput(w.w, function (v) { onChange('w', v); }));
  inputRow.appendChild(makeNumberInput(w.h, function (v) { onChange('h', v); }));
  row.appendChild(inputRow);
  container.appendChild(row);
}

function makeNumberInput(value, onChange) {
  var input = document.createElement('input');
  input.type = 'number';
  input.value = (value !== undefined && value !== null) ? value : '';
  input.addEventListener('change', function () {
    var v = input.value === '' ? undefined : parseFloat(input.value);
    onChange(v);
  });
  return input;
}

function addNumber(container, key, value, onChange) {
  var input = makeNumberInput(value, function (v) { onChange(key, v); });
  addRow(container, key, input);
}

function addText(container, key, value, onChange) {
  var input = document.createElement('input');
  input.type = 'text';
  input.value = (value !== undefined && value !== null) ? String(value) : '';
  input.addEventListener('change', function () {
    var v = input.value === '' ? undefined : input.value;
    onChange(key, v);
  });
  addRow(container, key, input);
}

function addSelect(container, key, value, options, onChange) {
  var select = document.createElement('select');
  options.forEach(function (optVal) {
    var opt = document.createElement('option');
    opt.value = optVal;
    opt.textContent = optVal;
    select.appendChild(opt);
  });
  select.value = value || options[0];
  select.addEventListener('change', function () {
    onChange(key, select.value);
  });
  addRow(container, key, select);
}

function addOverridesEditor(container, w, onChange) {
  var title = document.createElement('div');
  title.className = 'prop';
  title.innerHTML = '<strong>Conditional Overrides</strong>';
  container.appendChild(title);

  var textarea = document.createElement('textarea');
  textarea.style.width = '100%';
  textarea.style.minHeight = '160px';
  textarea.style.background = '#222b35';
  textarea.style.color = '#e6e6e6';
  textarea.style.border = '1px solid #2d3641';
  textarea.style.padding = '6px';
  textarea.value = JSON.stringify(w.overrides || [], null, 2);
  textarea.addEventListener('change', function () {
    try {
      var val = JSON.parse(textarea.value);
      onChange({ path: ['overrides'], value: val });
      textarea.style.borderColor = '#2d3641';
    } catch (e) {
      textarea.style.borderColor = '#cc0000';
    }
  });
  container.appendChild(textarea);
}
