export function createGridLayer(stage, gridSize, canvasWidth, canvasHeight) {
  var layer = new Konva.Layer({ listening: false });
  drawGrid(layer, gridSize, canvasWidth, canvasHeight);
  stage.add(layer);
  return layer;
}

export function drawGrid(layer, gridSize, canvasWidth, canvasHeight) {
  layer.destroyChildren();
  var w = canvasWidth;
  var h = canvasHeight;

  for (var x = 0; x <= w; x += gridSize) {
    var lineX = new Konva.Line({
      points: [x, 0, x, h],
      stroke: x % (gridSize * 4) === 0 ? '#1e2a35' : '#18222c',
      strokeWidth: 1
    });
    layer.add(lineX);
  }
  for (var y = 0; y <= h; y += gridSize) {
    var lineY = new Konva.Line({
      points: [0, y, w, y],
      stroke: y % (gridSize * 4) === 0 ? '#1e2a35' : '#18222c',
      strokeWidth: 1
    });
    layer.add(lineY);
  }
  layer.draw();
}
