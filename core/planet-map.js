// Orthographic survey globe. Drawn only while the dialog is open.
const CelPlanetMap = (() => {
  const dialog = document.querySelector("#planet-map");
  const closeButton = document.querySelector("#map-close");
  const svg = document.querySelector("#planet-svg");
  const graticule = document.querySelector("#planet-graticule");
  const walk = document.querySelector("#planet-walk");
  const walker = document.querySelector("#planet-walker");
  const poiLayer = document.querySelector("#planet-pois");
  const legend = document.querySelector("#map-legend");
  const title = document.querySelector("#map-title");

  const SVG_NS = "http://www.w3.org/2000/svg";
  const CX = 200;
  const CY = 200;
  const R = 170;
  const TILT = 20 * Math.PI / 180;
  const RAD = Math.PI / 180;
  const WALK_INCLINATION = 32 * RAD;

  let lon0 = -30;
  let walkPhase = 0;
  let frame = null;
  let lastTime = 0;
  let drag = null;

  function project(lat, lon) {
    const phi = lat * RAD;
    const lambda = (lon - lon0) * RAD;
    const cosPhi = Math.cos(phi);
    return {
      x: CX + R * cosPhi * Math.sin(lambda),
      y: CY - R * (Math.cos(TILT) * Math.sin(phi) - Math.sin(TILT) * cosPhi * Math.cos(lambda)),
      visible: Math.sin(TILT) * Math.sin(phi) + Math.cos(TILT) * cosPhi * Math.cos(lambda) > 0
    };
  }

  function polyline(points) {
    let d = "";
    let pen = false;
    points.forEach(([lat, lon]) => {
      const p = project(lat, lon);
      if (!p.visible) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      pen = true;
    });
    return d;
  }

  // Great circle tilted against the equator: the "keep walking and you come back" line.
  function walkPoint(t) {
    const lat = Math.asin(Math.sin(WALK_INCLINATION) * Math.sin(t)) / RAD;
    const lon = Math.atan2(Math.cos(WALK_INCLINATION) * Math.sin(t), Math.cos(t)) / RAD - 38;
    return [lat, lon];
  }

  function draw() {
    let d = "";
    for (let lon = -180; lon < 180; lon += 30) {
      const points = [];
      for (let lat = -90; lat <= 90; lat += 5) points.push([lat, lon]);
      d += polyline(points);
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const points = [];
      for (let lon = -180; lon <= 180; lon += 5) points.push([lat, lon]);
      d += polyline(points);
    }
    graticule.setAttribute("d", d);

    const walkPoints = [];
    for (let step = 0; step <= 72; step += 1) walkPoints.push(walkPoint(step * Math.PI / 36));
    walk.setAttribute("d", polyline(walkPoints));

    const walkerPos = project(...walkPoint(walkPhase));
    walker.setAttribute("cx", walkerPos.x.toFixed(1));
    walker.setAttribute("cy", walkerPos.y.toFixed(1));
    walker.style.opacity = walkerPos.visible ? "1" : "0";

    poiLayer.querySelectorAll("[data-poi]").forEach((group) => {
      const p = project(Number(group.dataset.lat), Number(group.dataset.lon));
      group.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
      group.style.opacity = p.visible ? "1" : "0";
    });
  }

  function buildPois() {
    poiLayer.innerHTML = "";
    legend.innerHTML = "";

    CelContent.getPois().forEach((poi) => {
      const item = document.createElement("article");
      item.className = poi.known ? "legend-known" : "legend-locked";
      const name = document.createElement("strong");
      const detail = document.createElement("span");

      if (poi.known) {
        name.textContent = poi.label.toUpperCase();
        detail.textContent = `${Math.abs(poi.lat)}°${poi.lat >= 0 ? "N" : "S"} ${Math.abs(poi.lon)}°${poi.lon >= 0 ? "E" : "W"}${poi.approx ? " // bearing only" : ""}`;

        const group = document.createElementNS(SVG_NS, "g");
        group.dataset.poi = poi.id;
        group.dataset.lat = poi.lat;
        group.dataset.lon = poi.lon;
        group.setAttribute("class", `poi${poi.approx ? " poi-approx" : ""}${poi.flicker ? " poi-flicker" : ""}`);

        if (poi.approx) {
          const ring = document.createElementNS(SVG_NS, "circle");
          ring.setAttribute("r", "16");
          ring.setAttribute("class", "poi-ring");
          group.appendChild(ring);
        }

        const dot = document.createElementNS(SVG_NS, "circle");
        dot.setAttribute("r", "4");
        dot.setAttribute("class", "poi-dot");
        const label = document.createElementNS(SVG_NS, "text");
        label.setAttribute("x", "8");
        label.setAttribute("y", "-7");
        label.textContent = poi.label.toUpperCase();
        group.append(dot, label);
        poiLayer.appendChild(group);
      } else {
        name.textContent = "▒▒▒▒ ▒▒▒▒▒▒▒";
        detail.textContent = "UNLOCATED // signal absent";
      }

      item.append(name, detail);
      legend.appendChild(item);
    });
  }

  function tick(time) {
    const dt = lastTime ? Math.min(0.05, (time - lastTime) / 1000) : 0;
    lastTime = time;
    if (!drag) lon0 += dt * 6;
    walkPhase = (walkPhase + dt * 0.35) % (Math.PI * 2);
    draw();
    frame = window.requestAnimationFrame(tick);
  }

  function open() {
    title.textContent = CelConfig.PLANET_NAME;
    buildPois();
    dialog.hidden = false;
    lastTime = 0;
    if (!frame) frame = window.requestAnimationFrame(tick);
    closeButton.focus();
  }

  function close() {
    if (dialog.hidden) return;
    dialog.hidden = true;
    if (frame) window.cancelAnimationFrame(frame);
    frame = null;
    const input = document.querySelector("#console-input");
    if (!document.querySelector("#console-screen").hidden) input.focus();
  }

  svg.addEventListener("pointerdown", (event) => {
    drag = { x: event.clientX, lon: lon0 };
    svg.setPointerCapture(event.pointerId);
  });
  svg.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const scale = 360 / svg.getBoundingClientRect().width;
    lon0 = drag.lon - (event.clientX - drag.x) * scale * 0.5;
  });
  ["pointerup", "pointercancel"].forEach((type) => svg.addEventListener(type, () => {
    drag = null;
  }));

  closeButton.addEventListener("click", close);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });

  return { close, isOpen: () => !dialog.hidden, open };
})();
