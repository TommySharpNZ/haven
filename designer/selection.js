export function updateProps(container, selection, onChange, onDelete, onDuplicate, onAlign, theme) {
  container.innerHTML = '';

  addThemePalette(container, theme);

  if (!selection || !selection.length) {
    var noSel = document.createElement('div');
    noSel.className = 'prop';
    noSel.textContent = 'No selection';
    container.appendChild(noSel);
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
  addRawJsonButton(container, w, onChange);

  var header = document.createElement('div');
  header.className = 'prop';
  header.innerHTML = '<strong>' + (w.id || '(no id)') + '</strong> <span class="meta">' + (w.type || 'unknown') + '</span>';
  container.appendChild(header);

  // Friendly display name — designer-only hint, stored as w.name in JSON.
  // Shown in the widget tree as the primary label instead of the bare ID.
  addText(container, 'name', w.name, onChange);

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
    addSectionHeader(container, 'Content');
    addText(container, 'text', w.text, onChange);
    addText(container, 'entity', w.entity, onChange);
    addText(container, 'entity_attribute', w.entity_attribute, onChange);
    addText(container, 'entity2', w.entity2, onChange);
    addSelect(container, 'format', w.format,
      ['', 'power', 'power_abs', 'power_prefix', 'kwh', 'percent',
       'time_24', 'time_12', 'date_iso', 'date_short', 'datetime_24', 'datetime_12'],
      onChange);
    addText(container, 'prefix', w.prefix, onChange);

    addSectionHeader(container, 'Typography');
    addPairRow(container,
      'font_size',   makeNumberInput(w.font_size,   function(v) { onChange('font_size', v); }),
      'font_weight', makeTextInput(w.font_weight,   function(v) { onChange('font_weight', v); })
    );
    addPairRow(container,
      'align',  makeSelectInput(w.align,  ['left', 'center', 'right'],  function(v) { onChange('align', v); }),
      'valign', makeSelectInput(w.valign, ['top', 'center', 'bottom'],  function(v) { onChange('valign', v); })
    );
    addNumber(container, 'letter_spacing', w.letter_spacing, onChange);

    addSectionHeader(container, 'Appearance');
    addPairRow(container,
      'color',      makeTextInput(w.color,      function(v) { onChange('color', v); }),
      'background', makeTextInput(w.background, function(v) { onChange('background', v); })
    );
    addNumber(container, 'opacity', w.opacity, onChange);

    addOverridesButton(container, w, onChange);
  }

  if (w.type === 'rectangle') {
    addSectionHeader(container, 'Content');
    addText(container, 'background', w.background, onChange);
    addNumber(container, 'radius', w.radius, onChange);
    addJsonObjectButton(container, 'Gradient', w, 'gradient', onChange);
    addSectionHeader(container, 'Action');
    addJsonObjectButton(container, 'Action', w, 'action', onChange);
    addOverridesButton(container, w, onChange);
  }

  if (w.type === 'button') {
    addSectionHeader(container, 'Content');
    addText(container, 'label', w.label, onChange);
    addText(container, 'icon', w.icon, onChange);
    addText(container, 'entity', w.entity, onChange);

    addSectionHeader(container, 'Appearance');
    addPairRow(container,
      'background', makeTextInput(w.background, function(v) { onChange('background', v); }),
      'radius',     makeNumberInput(w.radius,    function(v) { onChange('radius', v); })
    );
    addPairRow(container,
      'icon_color',  makeTextInput(w.icon_color,  function(v) { onChange('icon_color', v); }),
      'label_color', makeTextInput(w.label_color, function(v) { onChange('label_color', v); })
    );
    addPairRow(container,
      'icon_size',  makeNumberInput(w.icon_size,  function(v) { onChange('icon_size', v); }),
      'label_size', makeNumberInput(w.label_size, function(v) { onChange('label_size', v); })
    );
    addPairRow(container,
      'gap',     makeNumberInput(w.gap,     function(v) { onChange('gap', v); }),
      'padding', makeNumberInput(w.padding, function(v) { onChange('padding', v); })
    );
    addNumber(container, 'opacity', w.opacity, onChange);

    addSectionHeader(container, 'Action');
    addJsonObjectButton(container, 'Action', w, 'action', onChange);
    addOverridesButton(container, w, onChange);
  }

  if (w.type === 'image') {
    addSectionHeader(container, 'Source');
    addText(container, 'url', w.url, onChange);
    addText(container, 'entity', w.entity, onChange);
    addText(container, 'entity_attribute', w.entity_attribute, onChange);
    addSelect(container, 'fit', w.fit, ['cover', 'contain', 'stretch'], onChange);
    addCheckbox(container, 'fullscreen_on_tap', !!w.fullscreen_on_tap, function(checked) {
      onChange('fullscreen_on_tap', checked ? true : undefined);
    });

    addSectionHeader(container, 'Appearance');
    addNumber(container, 'radius', w.radius, onChange);
    addJsonObjectButton(container, 'Gradient', w, 'gradient', onChange);
    addNumber(container, 'opacity', w.opacity, onChange);
  }

  if (w.type === 'bar') {
    addSectionHeader(container, 'Data');
    addText(container, 'entity', w.entity, onChange);
    addNumber(container, 'max', w.max, onChange);

    addSectionHeader(container, 'Appearance');
    addPairRow(container,
      'color',      makeTextInput(w.color,      function(v) { onChange('color', v); }),
      'background', makeTextInput(w.background, function(v) { onChange('background', v); })
    );
    addNumber(container, 'radius', w.radius, onChange);

    addThresholdsButton(container, w, onChange);
  }

  if (w.type === 'arc') {
    addSectionHeader(container, 'Data');
    addText(container, 'entity', w.entity, onChange);
    addSelect(container, 'format', w.format,
      ['', 'power', 'power_abs', 'power_prefix', 'kwh', 'percent',
       'time_24', 'time_12', 'date_iso', 'date_short', 'datetime_24', 'datetime_12'],
      onChange);
    addPairRow(container,
      'min', makeNumberInput(w.min, function(v) { onChange('min', v); }),
      'max', makeNumberInput(w.max, function(v) { onChange('max', v); })
    );

    addSectionHeader(container, 'Geometry');
    addPairRow(container,
      'start_angle', makeNumberInput(w.start_angle, function(v) { onChange('start_angle', v); }),
      'end_angle',   makeNumberInput(w.end_angle,   function(v) { onChange('end_angle', v); })
    );
    addNumber(container, 'line_width', w.line_width, onChange);

    addSectionHeader(container, 'Appearance');
    addPairRow(container,
      'color',      makeTextInput(w.color,      function(v) { onChange('color', v); }),
      'background', makeTextInput(w.background, function(v) { onChange('background', v); })
    );
    addPairRow(container,
      'label',       makeTextInput(w.label,       function(v) { onChange('label', v); }),
      'label_color', makeTextInput(w.label_color, function(v) { onChange('label_color', v); })
    );

    addThresholdsButton(container, w, onChange);
    addOverridesButton(container, w, onChange);
  }

  if (w.type === 'slider') {
    addSectionHeader(container, 'Data');
    addText(container, 'entity', w.entity, onChange);
    addText(container, 'value_attribute', w.value_attribute, onChange);
    addPairRow(container,
      'min', makeNumberInput(w.min, function(v) { onChange('min', v); }),
      'max', makeNumberInput(w.max, function(v) { onChange('max', v); })
    );
    addPairRow(container,
      'step', makeNumberInput(w.step, function(v) { onChange('step', v); }),
      'orientation', makeSelectInput(w.orientation, ['horizontal', 'vertical'], function(v) { onChange('orientation', v); })
    );
    addSelect(container, 'update_mode', w.update_mode, ['release', 'drag'], onChange);

    addSectionHeader(container, 'Appearance');
    addPairRow(container,
      'color', makeTextInput(w.color, function(v) { onChange('color', v); }),
      'background', makeTextInput(w.background, function(v) { onChange('background', v); })
    );
    addPairRow(container,
      'thumb_color', makeTextInput(w.thumb_color, function(v) { onChange('thumb_color', v); }),
      'thumb_size', makeNumberInput(w.thumb_size, function(v) { onChange('thumb_size', v); })
    );
    addNumber(container, 'radius', w.radius, onChange);
    addNumber(container, 'opacity', w.opacity, onChange);

    addJsonObjectButton(container, 'Action', w, 'action', onChange);
    addOverridesButton(container, w, onChange);
  }

  if (w.type === 'scene') {
    addSectionHeader(container, 'Data');
    addText(container, 'entity', w.entity, onChange);
    addText(container, 'value_attribute', w.value_attribute, onChange);
    addSelect(container, 'layout', w.layout, ['buttons', 'dropdown', 'picker'], onChange);
    addJsonArrayButton(container, 'Options', w, 'options', onChange);

    addSectionHeader(container, 'Appearance');
    addPairRow(container,
      'background', makeTextInput(w.background, function(v) { onChange('background', v); }),
      'option_background', makeTextInput(w.option_background, function(v) { onChange('option_background', v); })
    );
    addPairRow(container,
      'option_color', makeTextInput(w.option_color, function(v) { onChange('option_color', v); }),
      'selected_background', makeTextInput(w.selected_background, function(v) { onChange('selected_background', v); })
    );
    addPairRow(container,
      'selected_color', makeTextInput(w.selected_color, function(v) { onChange('selected_color', v); }),
      'option_radius', makeNumberInput(w.option_radius, function(v) { onChange('option_radius', v); })
    );
    addPairRow(container,
      'option_size', makeNumberInput(w.option_size, function(v) { onChange('option_size', v); }),
      'option_gap', makeNumberInput(w.option_gap, function(v) { onChange('option_gap', v); })
    );
    addPairRow(container,
      'padding', makeNumberInput(w.padding, function(v) { onChange('padding', v); }),
      'placeholder', makeTextInput(w.placeholder, function(v) { onChange('placeholder', v); })
    );
    addNumber(container, 'opacity', w.opacity, onChange);

    addSectionHeader(container, 'Action');
    addJsonObjectButton(container, 'Action', w, 'action', onChange);
    addOverridesButton(container, w, onChange);
  }
}

// ---- Theme palette -------------------------------------------------------

function addThemePalette(container, theme) {
  if (!theme || !theme.colors) return;
  var tokens = Object.keys(theme.colors);
  if (!tokens.length) return;

  var header = document.createElement('div');
  header.className = 'prop';
  header.innerHTML = '<strong>Theme Colors</strong> <span class="meta">click to copy token</span>';
  container.appendChild(header);

  var grid = document.createElement('div');
  grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;padding:4px 8px 8px;';
  container.appendChild(grid);

  tokens.forEach(function(token) {
    var color = theme.colors[token];
    var chip = document.createElement('div');
    chip.title = token + ': ' + color;
    chip.style.cssText = 'cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;width:52px;';

    var swatch = document.createElement('div');
    swatch.style.cssText = 'width:36px;height:18px;border-radius:3px;border:1px solid rgba(255,255,255,0.15);transition:outline 0.1s;';
    swatch.style.background = color;

    var lbl = document.createElement('div');
    lbl.textContent = token;
    lbl.style.cssText = 'font-size:9px;color:#9fa5ad;text-align:center;line-height:1.2;word-break:break-all;';

    chip.appendChild(swatch);
    chip.appendChild(lbl);

    chip.addEventListener('click', function() {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(token).catch(function() {});
      }
      swatch.style.outline = '2px solid #8ADF45';
      setTimeout(function() { swatch.style.outline = ''; }, 600);
    });

    grid.appendChild(chip);
  });
}

// ---- Layout helpers -------------------------------------------------------

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

function addPairRow(container, label1, input1, label2, input2) {
  var row = document.createElement('div');
  row.className = 'prop';

  var inner = document.createElement('div');
  inner.style.cssText = 'display:flex;gap:8px;width:100%;';

  function makeCell(lbl, inp) {
    var cell = document.createElement('div');
    cell.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:2px;min-width:0;';
    var lab = document.createElement('div');
    lab.textContent = lbl;
    lab.style.cssText = 'font-size:11px;color:#9fa5ad;';
    inp.style.width = '100%';
    cell.appendChild(lab);
    cell.appendChild(inp);
    return cell;
  }

  inner.appendChild(makeCell(label1, input1));
  inner.appendChild(makeCell(label2, input2));
  row.appendChild(inner);
  container.appendChild(row);
}

function addSectionHeader(container, label) {
  var div = document.createElement('div');
  div.className = 'prop';
  div.innerHTML = '<strong>' + label + '</strong>';
  container.appendChild(div);
}

// ---- Input factories ------------------------------------------------------

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

function makeTextInput(value, onChange) {
  var input = document.createElement('input');
  input.type = 'text';
  input.value = (value !== undefined && value !== null) ? String(value) : '';
  input.addEventListener('change', function() {
    var v = input.value === '' ? undefined : input.value;
    onChange(v);
  });
  return input;
}

function makeSelectInput(value, options, onChange) {
  var select = document.createElement('select');
  options.forEach(function(optVal) {
    var opt = document.createElement('option');
    opt.value = optVal;
    opt.textContent = optVal || '(none)';
    select.appendChild(opt);
  });
  select.value = value !== undefined ? value : (options[0] || '');
  select.addEventListener('change', function() {
    var v = select.value === '' ? undefined : select.value;
    onChange(v);
  });
  return select;
}

// ---- Compound field helpers -----------------------------------------------

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

function addNumber(container, key, value, onChange) {
  var input = makeNumberInput(value, function (v) { onChange(key, v); });
  addRow(container, key, input);
}

function addText(container, key, value, onChange) {
  var input = makeTextInput(value, function(v) { onChange(key, v); });
  addRow(container, key, input);
}

function addSelect(container, key, value, options, onChange) {
  var select = makeSelectInput(value, options, function(v) { onChange(key, v); });
  addRow(container, key, select);
}

function addCheckbox(container, label, checked, onChange) {
  var row = document.createElement('div');
  row.className = 'prop';
  var lab = document.createElement('div');
  lab.textContent = label;
  var input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = !!checked;
  input.addEventListener('change', function () { onChange(input.checked); });
  row.appendChild(lab);
  row.appendChild(input);
  container.appendChild(row);
}

function addOverridesButton(container, w, onChange) {
  addSectionHeader(container, 'Conditional Overrides');
  var count = (w.overrides && w.overrides.length) ? w.overrides.length : 0;
  var row = document.createElement('div');
  row.className = 'prop';
  var btn = document.createElement('button');
  btn.textContent = count ? 'Edit Overrides (' + count + ' rules)' : 'Add Overrides';
  btn.style.width = '100%';
  btn.addEventListener('click', function() {
    openJsonArrayModal('Conditional Overrides', w, 'overrides', onChange);
  });
  row.appendChild(btn);
  container.appendChild(row);
}

function addThresholdsButton(container, w, onChange) {
  addSectionHeader(container, 'Thresholds');
  var count = (w.thresholds && w.thresholds.length) ? w.thresholds.length : 0;
  var row = document.createElement('div');
  row.className = 'prop';
  var btn = document.createElement('button');
  btn.textContent = count ? 'Edit Thresholds (' + count + ' rules)' : 'Add Thresholds';
  btn.style.width = '100%';
  btn.addEventListener('click', function() {
    openJsonArrayModal('Thresholds', w, 'thresholds', onChange);
  });
  row.appendChild(btn);
  container.appendChild(row);
}

function addJsonObjectButton(container, label, w, key, onChange) {
  var row = document.createElement('div');
  row.className = 'prop';
  var btn = document.createElement('button');
  btn.textContent = w[key] ? ('Edit ' + label) : ('Add ' + label);
  btn.style.width = '100%';
  btn.addEventListener('click', function() {
    openJsonObjectModal(label, w, key, onChange);
  });
  row.appendChild(btn);
  container.appendChild(row);
}

function addJsonArrayButton(container, label, w, key, onChange) {
  var row = document.createElement('div');
  row.className = 'prop';
  var count = (w[key] && w[key].length) ? w[key].length : 0;
  var btn = document.createElement('button');
  btn.textContent = count ? ('Edit ' + label + ' (' + count + ')') : ('Add ' + label);
  btn.style.width = '100%';
  btn.addEventListener('click', function() {
    openJsonArrayModal(label, w, key, onChange);
  });
  row.appendChild(btn);
  container.appendChild(row);
}

function addRawJsonButton(container, w, onChange) {
  var row = document.createElement('div');
  row.className = 'prop';
  row.style.display = 'flex';
  row.style.justifyContent = 'flex-end';

  var btn = document.createElement('button');
  btn.innerHTML = '<span class="fa-icon">&#xf121;</span>&nbsp;Raw JSON';
  btn.style.display = 'inline-flex';
  btn.style.alignItems = 'center';
  btn.style.gap = '6px';
  btn.addEventListener('click', function() {
    openRawWidgetJsonModal(w, onChange);
  });

  row.appendChild(btn);
  container.appendChild(row);
}

function openJsonArrayModal(heading, w, key, onChange) {
  var backdrop = document.createElement('div');
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;';

  var modal = document.createElement('div');
  modal.style.cssText = 'background:#1e2730;border:1px solid #2d3641;border-radius:8px;width:720px;max-width:92vw;height:72vh;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,0.6);';

  // Header
  var hdr = document.createElement('div');
  hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #2d3641;flex-shrink:0;';
  var title = document.createElement('div');
  title.innerHTML = '<strong>' + heading + '</strong> <span style="color:#9fa5ad;font-size:12px;margin-left:8px;">' + (w.id || 'widget') + '</span>';
  var closeBtn = document.createElement('button');
  closeBtn.innerHTML = '<span class="fa-icon">&#xf00d;</span>';
  closeBtn.style.cssText = 'background:none;border:none;color:#9fa5ad;font-size:22px;cursor:pointer;padding:0 4px;line-height:1;';
  hdr.appendChild(title);
  hdr.appendChild(closeBtn);

  // Textarea
  var textarea = document.createElement('textarea');
  textarea.style.cssText = 'flex:1;margin:12px 16px;background:#141a21;color:#e6e6e6;border:1px solid #2d3641;border-radius:4px;padding:10px 12px;font-family:monospace;font-size:13px;line-height:1.6;resize:none;outline:none;';
  textarea.value = JSON.stringify(w[key] || [], null, 2);
  textarea.spellcheck = false;

  // Footer
  var ftr = document.createElement('div');
  ftr.style.cssText = 'display:flex;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid #2d3641;flex-shrink:0;';
  var errMsg = document.createElement('span');
  errMsg.style.cssText = 'flex:1;color:#cc4444;font-size:12px;';
  var cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  var applyBtn = document.createElement('button');
  applyBtn.textContent = 'Apply';
  applyBtn.style.cssText = 'background:#8ADF45;color:#000;border-color:#8ADF45;font-weight:600;';
  ftr.appendChild(errMsg);
  ftr.appendChild(cancelBtn);
  ftr.appendChild(applyBtn);

  modal.appendChild(hdr);
  modal.appendChild(textarea);
  modal.appendChild(ftr);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  textarea.focus();

  function close() {
    document.body.removeChild(backdrop);
    document.removeEventListener('keydown', onKeyDown);
  }

  function apply() {
    try {
      var val = JSON.parse(textarea.value);
      if (!Array.isArray(val)) throw new Error('must be an array [ ... ]');
      onChange({ path: [key], value: val });
      close();
    } catch(e) {
      errMsg.textContent = 'Invalid JSON - ' + e.message;
      textarea.style.borderColor = '#cc4444';
    }
  }

  textarea.addEventListener('input', function() {
    errMsg.textContent = '';
    textarea.style.borderColor = '#2d3641';
  });

  textarea.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      apply();
    }
  });

  applyBtn.addEventListener('click', apply);
  cancelBtn.addEventListener('click', close);
  closeBtn.addEventListener('click', close);

  function onKeyDown(e) {
    if (e.key === 'Escape') close();
  }
  document.addEventListener('keydown', onKeyDown);

  backdrop.addEventListener('click', function(e) {
    if (e.target === backdrop) close();
  });
}

function openJsonObjectModal(heading, w, key, onChange) {
  var backdrop = document.createElement('div');
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;';

  var modal = document.createElement('div');
  modal.style.cssText = 'background:#1e2730;border:1px solid #2d3641;border-radius:8px;width:720px;max-width:92vw;height:72vh;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,0.6);';

  var hdr = document.createElement('div');
  hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #2d3641;flex-shrink:0;';
  var title = document.createElement('div');
  title.innerHTML = '<strong>' + heading + '</strong> <span style="color:#9fa5ad;font-size:12px;margin-left:8px;">' + (w.id || 'widget') + '</span>';
  var closeBtn = document.createElement('button');
  closeBtn.innerHTML = '<span class="fa-icon">&#xf00d;</span>';
  closeBtn.style.cssText = 'background:none;border:none;color:#9fa5ad;font-size:22px;cursor:pointer;padding:0 4px;line-height:1;';
  hdr.appendChild(title);
  hdr.appendChild(closeBtn);

  var textarea = document.createElement('textarea');
  textarea.style.cssText = 'flex:1;margin:12px 16px;background:#141a21;color:#e6e6e6;border:1px solid #2d3641;border-radius:4px;padding:10px 12px;font-family:monospace;font-size:13px;line-height:1.6;resize:none;outline:none;';
  textarea.value = JSON.stringify(w[key] || {}, null, 2);
  textarea.spellcheck = false;

  var ftr = document.createElement('div');
  ftr.style.cssText = 'display:flex;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid #2d3641;flex-shrink:0;';
  var errMsg = document.createElement('span');
  errMsg.style.cssText = 'flex:1;color:#cc4444;font-size:12px;';
  var cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  var applyBtn = document.createElement('button');
  applyBtn.textContent = 'Apply';
  applyBtn.style.cssText = 'background:#8ADF45;color:#000;border-color:#8ADF45;font-weight:600;';
  ftr.appendChild(errMsg);
  ftr.appendChild(cancelBtn);
  ftr.appendChild(applyBtn);

  modal.appendChild(hdr);
  modal.appendChild(textarea);
  modal.appendChild(ftr);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  textarea.focus();

  function close() {
    document.body.removeChild(backdrop);
    document.removeEventListener('keydown', onKeyDown);
  }

  function apply() {
    try {
      var val = JSON.parse(textarea.value || '{}');
      if (!val || typeof val !== 'object' || Object.prototype.toString.call(val) === '[object Array]') {
        throw new Error('must be an object { ... }');
      }
      onChange({ path: [key], value: val });
      close();
    } catch(e) {
      errMsg.textContent = 'Invalid JSON - ' + e.message;
      textarea.style.borderColor = '#cc4444';
    }
  }

  textarea.addEventListener('input', function() {
    errMsg.textContent = '';
    textarea.style.borderColor = '#2d3641';
  });

  textarea.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      apply();
    }
  });

  applyBtn.addEventListener('click', apply);
  cancelBtn.addEventListener('click', close);
  closeBtn.addEventListener('click', close);

  function onKeyDown(e) {
    if (e.key === 'Escape') close();
  }
  document.addEventListener('keydown', onKeyDown);

  backdrop.addEventListener('click', function(e) {
    if (e.target === backdrop) close();
  });
}

function openRawWidgetJsonModal(w, onChange) {
  var backdrop = document.createElement('div');
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;';

  var modal = document.createElement('div');
  modal.style.cssText = 'background:#1e2730;border:1px solid #2d3641;border-radius:8px;width:760px;max-width:92vw;height:76vh;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,0.6);';

  var hdr = document.createElement('div');
  hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #2d3641;flex-shrink:0;';
  var title = document.createElement('div');
  title.innerHTML = '<strong>Raw Widget JSON</strong> <span style="color:#9fa5ad;font-size:12px;margin-left:8px;">' + (w.id || 'widget') + '</span>';
  var closeBtn = document.createElement('button');
  closeBtn.innerHTML = '<span class="fa-icon">&#xf00d;</span>';
  closeBtn.style.cssText = 'background:none;border:none;color:#9fa5ad;font-size:22px;cursor:pointer;padding:0 4px;line-height:1;';
  hdr.appendChild(title);
  hdr.appendChild(closeBtn);

  var textarea = document.createElement('textarea');
  textarea.style.cssText = 'flex:1;margin:12px 16px;background:#141a21;color:#e6e6e6;border:1px solid #2d3641;border-radius:4px;padding:10px 12px;font-family:monospace;font-size:13px;line-height:1.6;resize:none;outline:none;';
  textarea.value = JSON.stringify(w || {}, null, 2);
  textarea.spellcheck = false;

  var ftr = document.createElement('div');
  ftr.style.cssText = 'display:flex;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid #2d3641;flex-shrink:0;';
  var errMsg = document.createElement('span');
  errMsg.style.cssText = 'flex:1;color:#cc4444;font-size:12px;';
  var cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  var applyBtn = document.createElement('button');
  applyBtn.textContent = 'Apply';
  applyBtn.style.cssText = 'background:#8ADF45;color:#000;border-color:#8ADF45;font-weight:600;';
  ftr.appendChild(errMsg);
  ftr.appendChild(cancelBtn);
  ftr.appendChild(applyBtn);

  modal.appendChild(hdr);
  modal.appendChild(textarea);
  modal.appendChild(ftr);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  textarea.focus();

  function close() {
    document.body.removeChild(backdrop);
    document.removeEventListener('keydown', onKeyDown);
  }

  function apply() {
    try {
      var val = JSON.parse(textarea.value || '{}');
      if (!val || typeof val !== 'object' || Object.prototype.toString.call(val) === '[object Array]') {
        throw new Error('must be an object { ... }');
      }
      onChange({ replace_widget: true, value: val });
      close();
    } catch(e) {
      errMsg.textContent = 'Invalid JSON - ' + e.message;
      textarea.style.borderColor = '#cc4444';
    }
  }

  textarea.addEventListener('input', function() {
    errMsg.textContent = '';
    textarea.style.borderColor = '#2d3641';
  });

  textarea.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      apply();
    }
  });

  applyBtn.addEventListener('click', apply);
  cancelBtn.addEventListener('click', close);
  closeBtn.addEventListener('click', close);

  function onKeyDown(e) {
    if (e.key === 'Escape') close();
  }
  document.addEventListener('keydown', onKeyDown);

  backdrop.addEventListener('click', function(e) {
    if (e.target === backdrop) close();
  });
}
