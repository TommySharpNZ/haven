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
    text: (w.id || '') + ' (' + (w.type || 'unknown') + ')',
    fontSize: 12,
    fill: '#cfd6dd'
  });

  // For label widgets, show their text preview
  if (w.type === 'label' && w.text) {
    label.text(String(w.text));
  }

  group.add(bg);
  group.add(label);
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
