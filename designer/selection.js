export function updateProps(container, selection, onChange, onDelete, onDuplicate, onAlign, theme, onEditTheme, onEntitySearch, onAttributeSearch) {
  _onEntitySearch    = onEntitySearch    || null;
  _onAttributeSearch = onAttributeSearch || null;
  container.innerHTML = '';

  // Update panel header title and clear action buttons
  var headerTitle   = document.getElementById('propsHeaderTitle');
  var headerActions = document.getElementById('propsHeaderActions');
  if (headerActions) headerActions.innerHTML = '';

  if (!selection || !selection.length) {
    if (headerTitle) headerTitle.innerHTML = 'Selection';
    addThemePalette(container, theme, onEditTheme);
    var noSel = document.createElement('div');
    noSel.className = 'prop';
    noSel.textContent = 'No selection';
    container.appendChild(noSel);
    return;
  }

  if (selection.length > 1) {
    if (headerTitle) headerTitle.innerHTML = '<span class="prop-header-id">' + selection.length + ' widgets selected</span>';
  } else {
    var hw = selection[0];
    if (headerTitle) {
      headerTitle.innerHTML =
        '<span class="prop-type-badge">' + (hw.type || 'widget') + '</span>' +
        '<span class="prop-header-id">' + (hw.id || '') + '</span>';
    }
  }

  addThemePalette(container, theme, onEditTheme);

  // Reorder — compact icon button row
  var reorderRow = document.createElement('div');
  reorderRow.style.cssText = 'display:flex;gap:4px;margin:4px 0 6px;';
  function makeReorderBtn(icon, tip, action) {
    var b = document.createElement('button');
    b.className = 'prop-icon-btn';
    b.title = tip;
    b.innerHTML = '<span class="fa-icon">' + icon + '</span>';
    b.addEventListener('click', function() { onAlign(action); });
    return b;
  }
  reorderRow.appendChild(makeReorderBtn('&#xf102;', 'Bring to Front', 'front'));
  reorderRow.appendChild(makeReorderBtn('&#xf103;', 'Send to Back',   'back'));
  reorderRow.appendChild(makeReorderBtn('&#xf106;', 'Move Up',        'up'));
  reorderRow.appendChild(makeReorderBtn('&#xf107;', 'Move Down',      'down'));
  var reorderSpacer = document.createElement('div');
  reorderSpacer.style.flex = '1';
  reorderRow.appendChild(reorderSpacer);
  var dupBtnR = document.createElement('button');
  dupBtnR.className = 'prop-icon-btn';
  dupBtnR.title = 'Duplicate';
  dupBtnR.innerHTML = '<span class="fa-icon">&#xf0c5;</span>';
  dupBtnR.addEventListener('click', function() { onDuplicate(); });
  reorderRow.appendChild(dupBtnR);
  var delBtnR = document.createElement('button');
  delBtnR.className = 'prop-icon-btn danger';
  delBtnR.title = 'Delete';
  delBtnR.innerHTML = '<span class="fa-icon">&#xf1f8;</span>';
  delBtnR.addEventListener('click', function() { onDelete(); });
  reorderRow.appendChild(delBtnR);
  container.appendChild(reorderRow);

  if (selection.length > 1) {
    var headerMulti = document.createElement('div');
    headerMulti.className = 'prop';
    headerMulti.innerHTML = '<strong>Multiple selection</strong> <span class="meta">' + selection.length + ' items</span>';
    container.appendChild(headerMulti);


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

  // Raw JSON button — inject into panel header
  if (headerActions) {
    var rawBtn = document.createElement('button');
    rawBtn.className = 'prop-icon-btn';
    rawBtn.title = 'Edit Raw JSON';
    rawBtn.innerHTML = '<span class="fa-icon">&#xf121;</span>';
    rawBtn.addEventListener('click', function() { openRawWidgetJsonModal(w, onChange); });
    headerActions.appendChild(rawBtn);
  }

  addSectionHeader(container, 'Widget Settings');

  // Name field + delete/duplicate icons on same row
  var nameLbl = document.createElement('div');
  nameLbl.style.cssText = 'font-size:11px;color:var(--muted);margin:4px 0 2px;';
  nameLbl.textContent = 'name';
  container.appendChild(nameLbl);

  var nameRow = document.createElement('div');
  nameRow.className = 'prop-name-row';
  var nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'name (designer label)';
  nameInput.value = w.name !== undefined ? String(w.name) : '';
  nameInput.addEventListener('change', function() {
    var v = nameInput.value === '' ? undefined : nameInput.value;
    onChange('name', v);
  });
  nameRow.appendChild(nameInput);
  container.appendChild(nameRow);

  addXYWHRow(container, w, onChange);

  if (w.type === 'label') {
    addSectionHeader(container, 'Content');
    addText(container, 'text', w.text, onChange);
    addText(container, 'entity', w.entity, onChange);
    addText(container, 'entity_attribute', w.entity_attribute, onChange, { getEntity: function() { return w.entity; } });
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

    addSectionHeader(container, 'Border');
    addPairRow(container,
      'border_width', makeNumberInput(w.border_width, function(v) { onChange('border_width', v); }),
      'border_color', makeTextInput(w.border_color,   function(v) { onChange('border_color', v); })
    );

    addOverridesButton(container, w, onChange);
  }

  if (w.type === 'rectangle') {
    addSectionHeader(container, 'Entity');
    addText(container, 'entity', w.entity, onChange);
    addText(container, 'entity2', w.entity2, onChange);

    addSectionHeader(container, 'Appearance');
    addPairRow(container,
      'background', makeTextInput(w.background, function(v) { onChange('background', v); }),
      'radius',     makeNumberInput(w.radius,    function(v) { onChange('radius', v); })
    );
    addNumber(container, 'opacity', w.opacity, onChange);
    addJsonObjectButton(container, 'Gradient', w, 'gradient', onChange);

    addSectionHeader(container, 'Border');
    addPairRow(container,
      'border_width', makeNumberInput(w.border_width, function(v) { onChange('border_width', v); }),
      'border_color', makeTextInput(w.border_color,   function(v) { onChange('border_color', v); })
    );

    addSectionHeader(container, 'Action');
    addJsonObjectButton(container, 'Action', w, 'action', onChange);
    addOverridesButton(container, w, onChange);
  }

  if (w.type === 'button') {
    addSectionHeader(container, 'Content');
    addText(container, 'label', w.label, onChange);
    addText(container, 'icon', w.icon, onChange);
    addText(container, 'entity', w.entity, onChange);
    addText(container, 'entity2', w.entity2, onChange);

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

    addSectionHeader(container, 'Border');
    addPairRow(container,
      'border_width', makeNumberInput(w.border_width, function(v) { onChange('border_width', v); }),
      'border_color', makeTextInput(w.border_color,   function(v) { onChange('border_color', v); })
    );

    addSectionHeader(container, 'Action');
    addJsonObjectButton(container, 'Action', w, 'action', onChange);
    addOverridesButton(container, w, onChange);
  }

  if (w.type === 'image') {
    addSectionHeader(container, 'Source');
    addText(container, 'url', w.url, onChange);
    addText(container, 'entity', w.entity, onChange);
    addText(container, 'entity_attribute', w.entity_attribute, onChange, { getEntity: function() { return w.entity; } });
    addSelect(container, 'fit', w.fit, ['cover', 'contain', 'stretch'], onChange);
    addCheckbox(container, 'fullscreen_on_tap', !!w.fullscreen_on_tap, function(checked) {
      onChange('fullscreen_on_tap', checked ? true : undefined);
    });

    addSectionHeader(container, 'Appearance');
    addNumber(container, 'radius', w.radius, onChange);
    addJsonObjectButton(container, 'Gradient', w, 'gradient', onChange);
    addNumber(container, 'opacity', w.opacity, onChange);

    addSectionHeader(container, 'Border');
    addPairRow(container,
      'border_width', makeNumberInput(w.border_width, function(v) { onChange('border_width', v); }),
      'border_color', makeTextInput(w.border_color,   function(v) { onChange('border_color', v); })
    );

    addOverridesButton(container, w, onChange);
  }

  if (w.type === 'bar') {
    addSectionHeader(container, 'Data');
    addText(container, 'entity', w.entity, onChange);
    addText(container, 'entity2', w.entity2, onChange);
    addText(container, 'value_attribute', w.value_attribute, onChange);
    addPairRow(container,
      'min', makeNumberInput(w.min, function(v) { onChange('min', v); }),
      'max', makeNumberInput(w.max, function(v) { onChange('max', v); })
    );

    addSectionHeader(container, 'Appearance');
    addPairRow(container,
      'color',       makeTextInput(w.color,       function(v) { onChange('color', v); }),
      'track_color', makeTextInput(w.track_color, function(v) { onChange('track_color', v); })
    );
    addText(container, 'background', w.background, onChange);
    addNumber(container, 'radius', w.radius, onChange);
    addNumber(container, 'opacity', w.opacity, onChange);

    addThresholdsButton(container, w, onChange);
    addOverridesButton(container, w, onChange);
  }

  if (w.type === 'arc') {
    addSectionHeader(container, 'Data');
    addText(container, 'entity', w.entity, onChange);
    addText(container, 'entity2', w.entity2, onChange);
    addText(container, 'value_attribute', w.value_attribute, onChange);
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
    addNumber(container, 'opacity', w.opacity, onChange);

    addSectionHeader(container, 'Marker');
    addText(container, 'marker_value_attribute', w.marker_value_attribute, onChange);
    addPairRow(container,
      'marker_color', makeTextInput(w.marker_color,   function(v) { onChange('marker_color', v); }),
      'marker_style', makeSelectInput(w.marker_style, ['dot', 'tick'], function(v) { onChange('marker_style', v); })
    );
    addNumber(container, 'marker_size', w.marker_size, onChange);

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

  if (w.type === 'switch') {
    addSectionHeader(container, 'Required');
    addPairRow(container,
      'on_value',  makeTextInput(w.on_value,  function(v) { onChange('on_value', v); }),
      'off_value', makeTextInput(w.off_value, function(v) { onChange('off_value', v); })
    );

    addSectionHeader(container, 'Entity');
    addText(container, 'entity', w.entity, onChange);
    addText(container, 'value_attribute', w.value_attribute, onChange);

    addSectionHeader(container, 'Track');
    addText(container, 'color', w.color, onChange);
    addPairRow(container,
      'radius',  makeNumberInput(w.radius,  function(v) { onChange('radius', v); }),
      'padding', makeNumberInput(w.padding, function(v) { onChange('padding', v); })
    );

    addSectionHeader(container, 'Thumb');
    addPairRow(container,
      'thumb_color',  makeTextInput(w.thumb_color,  function(v) { onChange('thumb_color', v); }),
      'thumb_radius', makeNumberInput(w.thumb_radius, function(v) { onChange('thumb_radius', v); })
    );

    addSectionHeader(container, 'Icon');
    addPairRow(container,
      'icon',       makeTextInput(w.icon,       function(v) { onChange('icon', v); }),
      'icon_color', makeTextInput(w.icon_color, function(v) { onChange('icon_color', v); })
    );
    addNumber(container, 'icon_scale', w.icon_scale, onChange);

    addSectionHeader(container, 'Label');
    addPairRow(container,
      'label',       makeTextInput(w.label,       function(v) { onChange('label', v); }),
      'label_color', makeTextInput(w.label_color, function(v) { onChange('label_color', v); })
    );
    addNumber(container, 'label_size', w.label_size, onChange);

    addSectionHeader(container, 'Behaviour');
    addCheckbox(container, 'locked', !!w.locked, function(c) {
      onChange('locked', c || undefined);
    });
    addCheckbox(container, 'optimistic (off = wait for HA)', w.optimistic !== false, function(c) {
      onChange('optimistic', c ? undefined : false);
    });
    addNumber(container, 'opacity', w.opacity, onChange);

    addSectionHeader(container, 'Action');
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

  if (w.type === 'clock') {
    addSectionHeader(container, 'Appearance');
    addPairRow(container,
      'color',      makeTextInput(w.color,      function(v) { onChange('color', v); }),
      'background', makeTextInput(w.background, function(v) { onChange('background', v); })
    );
    addNumber(container, 'font_size', w.font_size, onChange);
    addNumber(container, 'opacity', w.opacity, onChange);
  }

  if (w.type === 'camera') {
    addSectionHeader(container, 'Source');
    addText(container, 'entity', w.entity, onChange);
    addText(container, 'snapshot_entity', w.snapshot_entity, onChange);
    addText(container, 'stream_entity', w.stream_entity, onChange);
    addText(container, 'url', w.url, onChange);
    addSelect(container, 'preview', w.preview,
      ['mjpeg', 'snapshot', 'poster', 'url'],
      onChange);

    addSectionHeader(container, 'Behaviour');
    addText(container, 'label', w.label, onChange);
    addSelect(container, 'fit', w.fit, ['cover', 'contain', 'stretch'], onChange);
    addNumber(container, 'refresh_interval', w.refresh_interval, onChange);
    addCheckbox(container, 'fullscreen_on_tap', w.fullscreen_on_tap !== false, function(checked) {
      onChange('fullscreen_on_tap', checked ? undefined : false);
    });

    addSectionHeader(container, 'Appearance');
    addNumber(container, 'radius', w.radius, onChange);
    addNumber(container, 'opacity', w.opacity, onChange);
  }

  if (w.type === 'history_chart') {
    addSectionHeader(container, 'Data');
    addText(container, 'entity', w.entity, onChange, { domain: 'sensor', requireStateClass: true });
    addSelect(container, 'period', w.period, ['hour', 'day', 'month', 'year'], onChange);
    addPairRow(container,
      'count',    makeNumberInput(w.count,    function(v) { onChange('count', v); }),
      'stat_type', makeSelectInput(w.stat_type, ['mean', 'change'], function(v) { onChange('stat_type', v); })
    );
    addNumber(container, 'max', w.max, onChange);
    addNumber(container, 'refresh_interval', w.refresh_interval, onChange);

    addSectionHeader(container, 'Appearance');
    addPairRow(container,
      'color',       makeTextInput(w.color,       function(v) { onChange('color', v); }),
      'today_color', makeTextInput(w.today_color, function(v) { onChange('today_color', v); })
    );
    addPairRow(container,
      'track_color', makeTextInput(w.track_color, function(v) { onChange('track_color', v); }),
      'background',  makeTextInput(w.background,  function(v) { onChange('background', v); })
    );
    addNumber(container, 'radius', w.radius, onChange);
    addCheckbox(container, 'show_values', !!w.show_values, function(c) {
      onChange('show_values', c ? true : undefined);
    });
    addCheckbox(container, 'show_labels', !!w.show_labels, function(c) {
      onChange('show_labels', c ? true : undefined);
    });

    addSectionHeader(container, 'Fullscreen');
    addCheckbox(container, 'fullscreen_on_tap', !!w.fullscreen_on_tap, function(checked) {
      onChange('fullscreen_on_tap', checked ? true : undefined);
    });
    addJsonArrayButton(container, 'Fullscreen Views', w, 'fullscreen_views', onChange);
  }

  if (w.type === 'agenda') {
    addSectionHeader(container, 'Calendars');
    addJsonArrayButton(container, 'Calendars', w, 'calendars', onChange);

    addSectionHeader(container, 'Data');
    addPairRow(container,
      'days_ahead',       makeNumberInput(w.days_ahead,       function(v) { onChange('days_ahead', v); }),
      'refresh_interval', makeNumberInput(w.refresh_interval, function(v) { onChange('refresh_interval', v); })
    );
    addPairRow(container,
      'time_format', makeSelectInput(w.time_format, ['12h', '24h'],          function(v) { onChange('time_format', v); }),
      'layout',      makeSelectInput(w.layout,      ['list', 'columns'],      function(v) { onChange('layout', v); })
    );

    addSectionHeader(container, 'Appearance');
    addPairRow(container,
      'background',  makeTextInput(w.background,  function(v) { onChange('background', v); }),
      'muted_color', makeTextInput(w.muted_color, function(v) { onChange('muted_color', v); })
    );
    addPairRow(container,
      'radius',       makeNumberInput(w.radius,       function(v) { onChange('radius', v); }),
      'padding',      makeNumberInput(w.padding,      function(v) { onChange('padding', v); })
    );
    addPairRow(container,
      'font_size',    makeNumberInput(w.font_size,    function(v) { onChange('font_size', v); }),
      'agenda_scale', makeNumberInput(w.agenda_scale, function(v) { onChange('agenda_scale', v); })
    );
    addNumber(container, 'opacity', w.opacity, onChange);

    addSectionHeader(container, 'Options');
    addCheckbox(container, 'today_indicator', !!w.today_indicator, function(c) {
      onChange('today_indicator', c ? true : undefined);
    });
    addCheckbox(container, 'show_blank_days', !!w.show_blank_days, function(c) {
      onChange('show_blank_days', c ? true : undefined);
    });
    addCheckbox(container, 'show_month_headers', w.show_month_headers !== false, function(c) {
      onChange('show_month_headers', c ? undefined : false);
    });
    addCheckbox(container, 'legend', !!w.legend, function(c) {
      onChange('legend', c ? true : undefined);
    });
  }
}

// ---- Theme palette -------------------------------------------------------

function addThemePalette(container, theme, onEditTheme) {
  if (!theme || !theme.colors) return;
  var tokens = Object.keys(theme.colors);
  if (!tokens.length) return;

  var header = document.createElement('div');
  header.className = 'prop';
  header.style.cssText = 'display:flex;align-items:center;';
  header.innerHTML = '<strong>Theme Colors</strong> <span class="meta" style="flex:1;margin-left:4px;">click to copy token</span>';
  if (onEditTheme) {
    var editBtn = document.createElement('button');
    editBtn.textContent = 'Edit Theme';
    editBtn.className = 'btn-small';
    editBtn.addEventListener('click', onEditTheme);
    header.appendChild(editBtn);
  }
  container.appendChild(header);

  var grid = document.createElement('div');
  grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;padding:4px 8px 8px;';
  container.appendChild(grid);

  tokens.forEach(function(token) {
    var color = theme.colors[token];
    var swatch = document.createElement('div');
    swatch.title = token + ': ' + color;
    swatch.style.cssText = 'cursor:pointer;width:28px;height:16px;border-radius:3px;' +
      'border:1px solid rgba(255,255,255,0.15);transition:outline 0.1s;flex-shrink:0;';
    swatch.style.background = color;

    swatch.addEventListener('click', function() {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(token).catch(function() {});
      }
      swatch.style.outline = '2px solid #8ADF45';
      setTimeout(function() { swatch.style.outline = ''; }, 600);
    });

    grid.appendChild(swatch);
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

var _onEntitySearch    = null;
var _onAttributeSearch = null;

function addText(container, key, value, onChange, searchOptions) {
  var input = makeTextInput(value, function(v) { onChange(key, v); });

  var showEntitySearch = (key === 'entity' || key === 'entity2') && _onEntitySearch;
  var showAttrSearch   = key === 'entity_attribute' && _onAttributeSearch && searchOptions && searchOptions.getEntity;

  if (showEntitySearch || showAttrSearch) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:4px;width:100%;';
    input.style.flex = '1';
    var searchBtn = document.createElement('button');
    searchBtn.className = 'prop-icon-btn';
    searchBtn.innerHTML = '<span class="fa-icon">&#xf002;</span>';

    if (showEntitySearch) {
      searchBtn.title = 'Search HA entities';
      searchBtn.addEventListener('click', function() {
        _onEntitySearch(input.value, function(entityId) {
          input.value = entityId;
          input.dispatchEvent(new Event('change'));
        }, searchOptions || null);
      });
    } else {
      searchBtn.title = 'Browse entity attributes';
      searchBtn.addEventListener('click', function() {
        _onAttributeSearch(searchOptions.getEntity, input.value, function(attrName) {
          input.value = attrName;
          input.dispatchEvent(new Event('change'));
        });
      });
    }

    wrap.appendChild(input);
    wrap.appendChild(searchBtn);
    addRow(container, key, wrap);
  } else {
    addRow(container, key, input);
  }
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

function makeModalBtn(icon, label, count, onClick) {
  var btn = document.createElement('button');
  btn.className = 'prop-modal-btn';
  btn.innerHTML = '<span class="fa-icon">' + icon + '</span>' + label;
  if (count) {
    var badge = document.createElement('span');
    badge.className = 'prop-modal-btn-count';
    badge.textContent = count;
    btn.appendChild(badge);
  }
  btn.addEventListener('click', onClick);
  return btn;
}

function addOverridesButton(container, w, onChange) {
  addSectionHeader(container, 'Conditional Overrides');
  var count = (w.overrides && w.overrides.length) ? w.overrides.length : 0;
  var row = document.createElement('div');
  row.className = 'prop';
  row.appendChild(makeModalBtn('&#xf0b0;', count ? 'Edit Overrides' : 'Add Overrides', count, function() {
    openJsonArrayModal('Conditional Overrides', w, 'overrides', onChange);
  }));
  container.appendChild(row);
}

function addThresholdsButton(container, w, onChange) {
  addSectionHeader(container, 'Thresholds');
  var count = (w.thresholds && w.thresholds.length) ? w.thresholds.length : 0;
  var row = document.createElement('div');
  row.className = 'prop';
  row.appendChild(makeModalBtn('&#xf160;', count ? 'Edit Thresholds' : 'Add Thresholds', count, function() {
    openJsonArrayModal('Thresholds', w, 'thresholds', onChange);
  }));
  container.appendChild(row);
}

function addJsonObjectButton(container, label, w, key, onChange) {
  var icons = { 'Action': '&#xf0e7;', 'Gradient': '&#xf1fc;' };
  var icon = icons[label] || '&#xf013;';
  var row = document.createElement('div');
  row.className = 'prop';
  row.appendChild(makeModalBtn(icon, w[key] ? 'Edit ' + label : 'Add ' + label, 0, function() {
    openJsonObjectModal(label, w, key, onChange);
  }));
  container.appendChild(row);
}

function addJsonArrayButton(container, label, w, key, onChange) {
  var icons = { 'Options': '&#xf03a;' };
  var icon = icons[label] || '&#xf03a;';
  var count = (w[key] && w[key].length) ? w[key].length : 0;
  var row = document.createElement('div');
  row.className = 'prop';
  row.appendChild(makeModalBtn(icon, count ? 'Edit ' + label : 'Add ' + label, count, function() {
    openJsonArrayModal(label, w, key, onChange);
  }));
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
  var exampleBtn = document.createElement('button');
  exampleBtn.textContent = 'Insert Example';
  exampleBtn.style.cssText = 'font-size:12px;';
  ftr.appendChild(errMsg);
  ftr.appendChild(exampleBtn);
  ftr.appendChild(cancelBtn);
  ftr.appendChild(applyBtn);

  var ARRAY_EXAMPLES = {
    overrides: [{ when: { logic: 'all', conditions: [{ type: 'equals', value: 'on' }] }, set: { color: 'primary' } }],
    thresholds: [
      { value: 0,  color: 'danger' },
      { value: 30, color: 'warning' },
      { value: 60, color: 'primary' }
    ],
    calendars: [{ entity: 'calendar.home', color: 'primary', label: 'Home' }],
    options: [
      { label: 'Option 1', service: 'scene.turn_on', entity_id: 'scene.option_1' },
      { label: 'Option 2', service: 'scene.turn_on', entity_id: 'scene.option_2' }
    ],
    fullscreen_views: [
      { label: '7d',  period: 'day',   count: 7,  stat_type: 'change' },
      { label: '30d', period: 'day',   count: 30, stat_type: 'change' }
    ]
  };

  exampleBtn.addEventListener('click', function() {
    var example = ARRAY_EXAMPLES[key];
    if (!example) return;
    var current = [];
    try { current = JSON.parse(textarea.value); if (!Array.isArray(current)) current = []; } catch(e) { current = []; }
    if (current.length === 0) {
      textarea.value = JSON.stringify(example, null, 2);
    } else {
      current.push(example[0]);
      textarea.value = JSON.stringify(current, null, 2);
    }
    errMsg.textContent = '';
    textarea.style.borderColor = '#2d3641';
  });

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
  var exampleBtn = document.createElement('button');
  exampleBtn.textContent = 'Insert Example';
  exampleBtn.style.cssText = 'font-size:12px;';
  ftr.appendChild(errMsg);
  ftr.appendChild(exampleBtn);
  ftr.appendChild(cancelBtn);
  ftr.appendChild(applyBtn);

  var OBJECT_EXAMPLES = {
    action:   { type: 'service', service: 'light.toggle', entity_id: 'light.living_room' },
    gradient: { type: 'linear', angle: 180, stops: [{ color: 'surface', pos: 0 }, { color: 'primary', pos: 1 }] }
  };

  exampleBtn.addEventListener('click', function() {
    var example = OBJECT_EXAMPLES[key];
    if (!example) return;
    var current = {};
    try { current = JSON.parse(textarea.value); } catch(e) { current = {}; }
    var isEmpty = Object.keys(current).length === 0;
    if (isEmpty) {
      textarea.value = JSON.stringify(example, null, 2);
      errMsg.textContent = '';
      textarea.style.borderColor = '#2d3641';
    }
  });

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
