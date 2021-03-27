(function(){
  var parent = $('#globe').parent();
  var height, width;
  var canvg = d3.select('#globe');
  var context = canvg.node().getContext('2d');

  var projection = d3.geoOrthographic();
  var path = d3.geoPath(projection, context);

  var swoosh = d3.line()
    .curve(d3.curveNatural)
    .defined(function (d) { return projection.invert(d); })
    .context(context);

  var starProjection = d3.geoAzimuthalEquidistant();
  var starPath = d3.geoPath(starProjection, context).pointRadius(1);

  var sphere = { type: 'Sphere' };
  var graticule = d3.geoGraticule10();

  var nodes = MT2.getVisibleNodes(true);
  var links = MT2.getVisibleLinks(true);

  var autorotate = null, now, lastTime = d3.now();
  var userLayers = [];

  var k = 1;

  function init() {
    // if (!temp.mapData.land) {
    //   MT2.getMapData('land.json').then(init);
    //   return;
    // }
    if (!temp.mapData.stars) {
      MT2.getMapData('stars.json').then(init);
      return;
    }
    if (!temp.mapData.countries) {
      MT2.getMapData('countries.json').then(init);
      return;
    }
    resize();
    canvg
      .call(drag(projection).on('drag.render', redraw))
      .call(d3.zoom().on("zoom", zoomed))
      .call(redraw);
  }

  function resize() {
    height = parent.height();
    width = parent.width();
    let t = [width / 2, height / 2];
    canvg.attr('width', width).attr('height', height);
    projection = projection
      .fitExtent([[50, 50], [width - 50, height - 50]], sphere)
      .translate(t)
      .precision(0.1);
    starProjection = starProjection
      .fitExtent([[0, 0], [3 * width, 3 * height]], temp.mapData.stars)
      .translate(t);
  }

  function redraw() {
    if(!$('#globe').length) return;
    context.clearRect(0, 0, width, height);

    if (session.style.widgets['globe-stars-show']) {
      context.beginPath();
      starPath(temp.mapData.stars);
      context.fillStyle = "#fff";
      context.fill();
    }

    context.beginPath();
    path(sphere);
    context.fillStyle = '#005C99';
    context.fill();

    context.beginPath();
    
    path(temp.mapData.countries);

    // if (session.style.widgets['globe-countries-show']) {
    //   path(temp.mapData.countries);
    // } else {
    //   path(temp.mapData.land);
    // }
    
    context.fillStyle = "#6CCC00";
    context.fill();
    context.lineWidth = 1;
    context.strokeStyle = "#444444";
    if (session.style.widgets['globe-countries-show']) {
      context.stroke();
    }

    userLayers.forEach(layer => {
      context.beginPath();
      path(layer.data);
      context.strokeStyle = layer.color;
      context.lineWidth = 1;
      context.stroke();
    });

    if (session.style.widgets['globe-graticule-show']) {
      context.beginPath();
      path(graticule);
      context.strokeStyle = "#444";
      context.lineWidth = 1;
      context.stroke();
    }

    if (session.style.widgets['globe-link-show']) {
      context.beginPath();
      makeLinkArcs().forEach(swoosh);
      context.lineWidth = 2;
      context.strokeStyle = session.style.widgets['link-color'];
      context.stroke();
    }

    if (session.style.widgets['globe-node-show']) {
      context.beginPath();
      path({
        type: 'FeatureCollection',
        features: makeNodeFeatures()
      });
      context.fillStyle = session.style.widgets['node-color'];
      context.lineWidth = 4;
      context.fill();
    }
  }

  function drag(projection) {
    let x0, y0, center;

    function dragstarted(e) {
      center = projection.rotate();
      x0 = e.x;
      y0 = e.y;
    }

    function dragged(e) {
      let x1 = e.x;
      let y1 = e.y;
      starProjection = starProjection.rotate([(x0 - x1) / k - center[0], Math.max(-90, Math.min((y1 - y0) / k - center[1], 90)), 0]);
      projection = projection.rotate([(x1 - x0) / k + center[0], Math.max(-90, Math.min((y0 - y1) / k + center[1], 90)), 0]);
    }

    return d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged);
  }

  function zoomed(e) {
    k = e.transform.k;
    projection = projection.scale(k * 400);
    redraw();
  }

  function rotate(elapsed) {
    now = d3.now();
    diff = now - lastTime
    if (diff < elapsed) {
      rotation = projection.rotate();
      rotation[0] -= diff * 6 / 1000;
      projection.rotate(rotation);
      starProjection.rotate([-rotation[0], -rotation[1]]);
      redraw();
    }
    lastTime = now;
  }

  ['lat', 'lon', 'tract', 'zipcode', 'county', 'state', 'country'].forEach(v => {
    let name = 'globe-field-' + v, s = $('#' + name);
    s.on('change', function (e) {
      session.style.widgets[name] = e.target.value;
      matchCoordinates(redraw);
    });
    if (session.data.nodeFields.includes(v)) s.val(v);
  });

  function matchCoordinates(callback) {
    if (session.style.widgets['globe-field-country'] !== 'None') {
      if (!temp.mapData.countries) {
        MT2.getMapData('countries.json').then(() => matchCoordinates(callback));
        return;
      }
      let val = session.style.widgets['globe-field-country'];
      nodes.forEach(n => {
        let country = temp.mapData.countries.features.find(c => c.id == n[val] || c.properties.name == n[val]);
        if (country) {
          n._lat = country.properties._lat,
            n._lon = country.properties._lon
        }
      });
    }
    if (session.style.widgets['globe-field-state'] !== 'None') {
      if (!temp.mapData.states) {
        MT2.getMapData('states.json').then(() => matchCoordinates(callback));
        return;
      }
      let sval = session.style.widgets['globe-field-state'];
      nodes.forEach(n => {
        let state = temp.mapData.states.features.find(s => s.properties.usps == n[sval] || s.properties.name == n[sval]);
        if (state) {
          n._lat = state.properties._lat;
          n._lon = state.properties._lon;
        }
      });
    }
    if (session.style.widgets['globe-field-county'] !== 'None') {
      if (!temp.mapData.counties) {
        MT2.getMapData('counties.json').then(() => matchCoordinates(callback));
        return;
      }
      let sval = session.style.widgets['globe-field-state'];
      let cval = session.style.widgets['globe-field-county'];
      nodes.forEach(n => {
        let county;
        county = temp.mapData.counties.features.find(c => {
          return (c.properties.fips == n[cval] ||
            parseFloat(c.properties.fips) == parseFloat(n[cval]));
        });
        if (county) {
          n._lat = county.properties._lat;
          n._lon = county.properties._lon;
          return;
        }
        let state = temp.mapData.states.features.find(s => s.properties.usps == n[sval].toUpperCase() || s.properties.name.toLowerCase().includes(n[sval].toLowerCase()));
        county = temp.mapData.counties.features.find(c => {
          var small = n[cval].toLowerCase();
          return c.properties.state == state.properties.usps && (
            c.properties.name.includes(small) ||
            small.includes(c.properties.name)
          );
        });
        if (county) {
          n._lat = county.properties._lat;
          n._lon = county.properties._lon;
        }
      });
    }
    if (session.style.widgets['globe-field-zipcode'] !== 'None') {
      if (!temp.mapData.zipcodes) {
        MT2.getMapData('zipcodes.csv').then(() => matchCoordinates(callback));
        return;
      }
      let val = session.style.widgets['globe-field-zipcode'];
      nodes.forEach(n => {
        let zo = temp.mapData.zipcodes.find(z => z.zipcode == n[val]);
        if (zo) {
          n._lat = zo._lat;
          n._lon = zo._lon;
        }
      });
    }
    if (session.style.widgets['globe-field-tract'] !== 'None') {
      if (!temp.mapData.tracts) {
        MT2.getMapData('tracts.csv').then(() => matchCoordinates(callback));
        return;
      }
      let val = session.style.widgets['globe-field-tract'];
      nodes.forEach(n => {
        let tract = temp.mapData.tracts.find(t => t.tract == n[val]);
        if (tract) {
          n._lat = tract._lat;
          n._lon = tract._lon;
        }
      });
    }
    if (session.style.widgets['globe-field-lat'] !== 'None' && session.style.widgets['globe-field-lon'] !== 'None') {
      let lat = session.style.widgets['globe-field-lat'],
        lon = session.style.widgets['globe-field-lon'];
      nodes.forEach(n => {
        if (typeof n[lat] == 'string') {
          n._lat = (n[lat].includes('S') ? -1 : 1) * parseFloat(n[lat]);
        } else {
          n._lat = n[lat];
        }
        if (typeof n[lon] == 'string') {
          n._lon = (n[lon].includes('W') ? -1 : 1) * parseFloat(n[lon]);
        } else {
          n._lon = n[lon];
        }
      });
    }
    rerollNodes();
    if (callback) callback();
  }

  $('#toggle-globe-settings').on('click', function () {
    let pane = $('#globe-settings-pane');
    if ($(this).hasClass('active')) {
      pane.animate({ left: '-400px' }, function () { pane.hide(); });
    } else {
      pane.show(0, function () { pane.animate({ left: '0px' }); });
    }
  });

  $('#globe-node-show').parent().on('click', function () {
    session.style.widgets['globe-node-show'] = true;
    redraw();
  });
  $('#globe-node-hide').parent().on('click', function () {
    session.style.widgets['globe-node-show'] = false;
    redraw();
  });

  $('#globe-link-show').parent().on('click', function () {
    session.style.widgets['globe-link-show'] = true;
    redraw();
  });
  $('#globe-link-hide').parent().on('click', function () {
    session.style.widgets['globe-link-show'] = false;
    redraw();
  });

  $('#globe-stars-show').parent().on('click', function () {
    session.style.widgets['globe-stars-show'] = true;
    redraw();
  });
  $('#globe-stars-hide').parent().on('click', function () {
    session.style.widgets['globe-stars-show'] = false;
    redraw();
  });

  $('#globe-countries-show').parent().on('click', function () {
    session.style.widgets['globe-countries-show'] = true;
    redraw();
  });
  $('#globe-countries-hide').parent().on('click', function () {
    session.style.widgets['globe-countries-show'] = false;
    redraw();
  });

  $('#globe-graticule-show').parent().on('click', function () {
    session.style.widgets['globe-graticule-show'] = true;
    redraw();
  });
  $('#globe-graticule-hide').parent().on('click', function () {
    session.style.widgets['globe-graticule-show'] = false;
    redraw();
  });

  $('#globe-node-jitter').on('input', function (e) {
    var v = parseFloat(e.target.value);
    session.style.widgets['globe-node-jitter'] = v;
    jitter();
    redraw();
  });


  function jitter() {
    var v = session.style.widgets['globe-node-jitter'] == -2 ? 0 : Math.pow(2, session.style.widgets['globe-node-jitter']);
    var n = nodes.length;
    for (var i = 0; i < n; i++) {
      var node = nodes[i];
      node._jlon = parseFloat(node._lon) + v * node._j * Math.cos(node._theta);
      node._jlat = parseFloat(node._lat) + v * node._j * Math.sin(node._theta);
    }
  }

  $('#globe-node-jitter-reroll').on('click', function () {
    rerollNodes();
    redraw();
  });

  function rerollNodes() {
    nodes.forEach(function (node) {
      node._theta = MT2.r01() * Math.PI * 2;
      node._j = MT2.r01();
    });
    jitter();
  }

  $('#globe-file-input').on('change', event => {
    Array.from(event.target.files).forEach(file => {
      var name = file.name;
      if (name.endsWith("json")) {
        var reader = new FileReader();
        reader.onload = function (event) {
          var layerName = name.split('.').slice(0, -1).join('.').toLowerCase();
          let i = userLayers.length;
          userLayers.push({
            data: JSON.parse(event.target.result),
            color: '#990000'
          });
          let colorCell = $('<div class="col-3"></div>').append(
            $('<input type="color" class="w-100" value="#990000">').on('change', e => {
              userLayers[i].color = e.target.value;
              redraw();
            })
          );
          let nameCell = $(`<div class="col-9">${layerName}</div>`).prepend(
            $('<a href="#" class="oi oi-circle-x align-middle p-1" title="Remove this file"></a>').on('click', function () {
              nameCell.remove();
              colorCell.remove();
              delete temp.mapData[layerName];
            })
          );
          $('#globe-geojson-layers')
            .append(nameCell)
            .append(colorCell);
        };
        reader.readAsText(file);
      } else {
        alert("Only GeoJSON Files are currently Supported.");
      }
    });
  });

  function makeNodeFeatures() {
    let features = [];
    let jitter = session.style.widgets['globe-node-jitter'] > 0;
    nodes.forEach(function (d) {
      if (d._jlat && d._jlon) {
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [d._jlon, d._jlat]
          },
          properties: d
        });
      }
    });
    return features;
  }

  function makeLinkArcs() {
    let arcs = [];
    let origin = [-projection.rotate()[0], -projection.rotate()[1]];
    let n = links.length;
    let maxDist = Math.PI / 2;
    while (n-- > 0) {
      let d = links[n];
      if (!d.visible) continue;
      let source = nodes.find(node => node._id == d.source);
      let target = nodes.find(node => node._id == d.target);
      if (source && target) {
        if (source._jlat && source._jlon && target._jlat && target._jlon) {
          var s = [source._jlon, source._jlat];
          var t = [target._jlon, target._jlat];
          if (d3.geoDistance(s, origin) > maxDist) continue;
          if (d3.geoDistance(t, origin) > maxDist) continue;
          arcs.push([
            projection(s),
            projection(middle(s, t)),
            projection(t)
          ]);
        }
      }
    }
    return arcs;
  }

  function middle(start, end) {
    return d3.geoInterpolate(start, end)(0.5);
  }

  function makeLinkFeatures() {
    let features = [];
    let jitter = session.style.widgets['globe-node-jitter'] > 0;
    links.forEach(function (d) {
      if (!d.visible) return;
      let source = nodes.find(node => node._id == d.source);
      let target = nodes.find(node => node._id == d.target);
      if (source && target) {
        if (source._lat && source._lon && target._lat && target._lon) {
          features.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: jitter ? [
                [source._lon + source._jlon, source._lat + source._jlat],
                [target._lon + target._jlon, target._lat + target._jlat]
              ] : [
                  [source._lon, source._lat],
                  [target._lon, target._lat]
                ]
            },
            properties: d
          });
        }
      }
    });
    return features;
  }

  function makeGeoJSON() {
    return {
      type: 'FeatureCollection',
      features: makeNodeFeatures().concat(makeLinkFeatures())
    };
  }

  $('#globe-export').on('click', function () {
    let format = $('#globe-export-file-format').val();
    if (['png', 'jpeg', 'webp'].includes(format)) {
      canvg.node().toBlob(blob => {
        saveAs(blob, $('#globe-export-file-name').val() + '.' + format);
      }, 'image/' + format);
    } else if (format == 'geojson') {
      saveAs(
        new Blob([JSON.stringify(makeGeoJSON())], { type: 'application/json;charset=utf-8' }),
        $('#globe-export-file-name').val() + '.' + format
      );
    }
  });

  $('#toggle-globe-autorotate').on('click', function () {
    if (autorotate) {
      $(this).addClass('active');
      autorotate.stop();
      autorotate = null;
    } else {
      $(this).removeClass('active');
      autorotate = d3.timer(rotate);
    }
  });

  $window
    .on('node-color-change link-color-change', redraw)
    .on('node-visibilitiy-change', function () {
      nodes = MT2.getVisibleNodes(true);
      rerollNodes();
      redraw();
    });

  layout.on('stateChanged', function () {
    resize();
    redraw();
  });

  init();
})();