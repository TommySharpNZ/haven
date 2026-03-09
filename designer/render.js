export function createWidgetGroup(w, theme) {
  var group = new Konva.Group({
    x: w.x || 0,
    y: w.y || 0,
    draggable: true,
    id: w.id || ''
  });

  var bg = new Konva.Rect({
    width: w.w || 10,
    height: w.h || 10,
    fill: resolveColor(w.background, theme) || '#2b3642',
    stroke: '#3b4755',
    strokeWidth: 1,
    cornerRadius: w.radius || 0,
    opacity: (w.opacity !== undefined ? w.opacity : 1)
  });

  var label = new Konva.Text({
    x: 6,
    y: 6,
    width: Math.max(0, (w.w || 10) - 12),
    text: (w.id || '') + ' (' + (w.type || 'unknown') + ')',
    fontSize: 12,
    fill: '#cfd6dd',
    wrap: 'none',
    ellipsis: true
  });

  // For label widgets, show their text preview
  if (w.type === 'label' && w.text) {
    label.text(String(w.text));
  }

  // bg is added first so subsequent shapes render on top
  group.add(bg);
  group.add(label);

  // For arc widgets, draw a visual track + value arc preview on top of bg
  if (w.type === 'arc') {
    label.visible(false);
    // Make bg transparent so the arc shows through cleanly
    bg.fill('transparent');
    var arcW = w.w || 10;
    var arcH = w.h || 10;
    var arcSize = Math.min(arcW, arcH);
    var arcLineWidth = w.line_width || 12;
    var arcR = (arcSize / 2) - (arcLineWidth / 2) - 2;
    var startAngle = w.start_angle !== undefined ? w.start_angle : 135;
    var endAngle = w.end_angle !== undefined ? w.end_angle : 405;
    var totalAngle = endAngle - startAngle;
    var arcCx = arcW / 2;
    var arcCy = arcH / 2;
    if (arcR > 4) {
      group.add(new Konva.Arc({
        x: arcCx, y: arcCy,
        innerRadius: Math.max(0, arcR - arcLineWidth / 2),
        outerRadius: arcR + arcLineWidth / 2,
        angle: totalAngle,
        rotation: startAngle - 90,
        fill: resolveColor(w.background, theme) || '#363f4a',
        listening: false
      }));
      group.add(new Konva.Arc({
        x: arcCx, y: arcCy,
        innerRadius: Math.max(0, arcR - arcLineWidth / 2),
        outerRadius: arcR + arcLineWidth / 2,
        angle: totalAngle * 0.65,
        rotation: startAngle - 90,
        fill: resolveColor(w.color, theme) || '#8ADF45',
        listening: false
      }));
      // ID label centred in the arc
      group.add(new Konva.Text({
        x: arcCx - 40,
        y: arcCy - 7,
        width: 80,
        text: w.id || '',
        fontSize: 11,
        fill: '#cfd6dd',
        align: 'center',
        listening: false
      }));
    }
  }

  // For sliders, draw track + fill + thumb preview.
  if (w.type === 'slider') {
    label.visible(false);
    var sw = w.w || 10;
    var sh = w.h || 10;
    var vertical = (w.orientation === 'vertical');
    var thickness = vertical ? sw : sh;
    var radius = (w.radius !== undefined) ? w.radius : Math.round(thickness / 2);
    var thumbSize = (w.thumb_size !== undefined) ? w.thumb_size : Math.max(14, Math.round(thickness * 0.9));
    var ratio = 0.55;

    bg.fill(resolveColor(w.background, theme) || '#363f4a');
    bg.cornerRadius(radius);

    var fill = new Konva.Rect({
      x: 0,
      y: 0,
      width: vertical ? sw : Math.round(sw * ratio),
      height: vertical ? Math.round(sh * ratio) : sh,
      fill: resolveColor(w.color, theme) || '#8ADF45',
      cornerRadius: radius,
      listening: false
    });
    if (vertical) {
      fill.y(sh - fill.height());
    }
    group.add(fill);

    var thumbX = vertical ? Math.round((sw - thumbSize) / 2) : Math.round(sw * ratio - thumbSize / 2);
    var thumbY = vertical ? Math.round((sh - sh * ratio) - thumbSize / 2) : Math.round((sh - thumbSize) / 2);
    if (thumbX < 0) thumbX = 0;
    if (thumbY < 0) thumbY = 0;
    group.add(new Konva.Circle({
      x: thumbX + thumbSize / 2,
      y: thumbY + thumbSize / 2,
      radius: Math.round(thumbSize / 2),
      fill: resolveColor(w.thumb_color, theme) || '#ffffff',
      opacity: 0.95,
      listening: false
    }));
  }
  // For switch widgets, draw track + thumb in the "on" position.
  if (w.type === 'switch') {
    label.visible(false);
    var sw = w.w || 10;
    var sh = w.h || 10;
    var pad = (w.padding !== undefined) ? parseFloat(w.padding) : 3;
    if (isNaN(pad) || pad < 0) pad = 3;
    var radius = (w.radius !== undefined) ? w.radius : Math.round(sh / 2);
    var thumbSize = Math.max(8, sh - pad * 2);
    var travel = Math.max(0, sw - pad * 2 - thumbSize);
    var thumbRadius = (w.thumb_radius !== undefined) ? parseFloat(w.thumb_radius) : Math.round(thumbSize / 2);
    if (isNaN(thumbRadius) || thumbRadius < 0) thumbRadius = Math.round(thumbSize / 2);

    bg.fill(resolveColor(w.color, theme) || '#363f4a');
    bg.cornerRadius(radius);

    group.add(new Konva.Rect({
      x: pad + travel,
      y: pad,
      width: thumbSize,
      height: thumbSize,
      fill: resolveColor(w.thumb_color, theme) || '#ffffff',
      cornerRadius: thumbRadius,
      listening: false
    }));
  }

  group._rect = bg;
  group._label = label;
  group._data = w;
  return group;
}

function resolveColor(token, theme) {
  if (!token) return null;
  if (token.charAt && (token.charAt(0) === '#' || token.indexOf('rgb') === 0)) return token;
  if (!theme || !theme.colors) return token;
  return theme.colors[token] || token;
}
