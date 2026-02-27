export function loadDeviceList() {
  // Minimal list for PoC: known test devices + option from query
  var list = ['test-designer', 'test-button', 'test-label', 'test-rect', 'test-cameras', 'showcase', 'example', 'ipad-air'];
  var url = new URL(window.location.href);
  var qp = url.searchParams.get('device');
  if (qp && list.indexOf(qp) === -1) list.unshift(qp);
  return list;
}

export function getDeviceFromQuery() {
  var url = new URL(window.location.href);
  return url.searchParams.get('device') || 'test-designer';
}

export function fetchConfig(device) {
  var base = window.location.pathname.replace(/\/[^\/]*$/, '/');
  var url = base + 'devices/' + device + '.json?v=' + Date.now();
  return fetch(url).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  });
}
