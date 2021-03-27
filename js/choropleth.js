(function () {
  if (navigator.onLine) {
    $('#choropleth').parent().find('.if-online').css('display', 'flex');
  }

  var layers = {
    basemap: L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/light-v9/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoiYWFib3lsZXMiLCJhIjoiY2o4b3QxNmtjMDhwNjMzcno4dDd1NnVraSJ9.BkjEa6NM7o7KeTaTHOaIGg'),
    satellite: L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v9/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoiYWFib3lsZXMiLCJhIjoiY2o4b3QxNmtjMDhwNjMzcno4dDd1NnVraSJ9.BkjEa6NM7o7KeTaTHOaIGg'),
    aggregates: { remove: function () { }, bringToFront: function () { } }
  };

  var nodes = MT2.getVisibleNodes();

  var choropleth = L.map('choropleth', {
    center: [39.8, -98.5],
    zoom: 5,
    zoomControl: false,
    maxZoom: 20,
    preferCanvas: true
  });

  var legend = L.control({ position: 'bottomleft' });

  var zoomer = L.control.zoom({ position: 'bottomleft' }).addTo(choropleth);

  function aggregate(refresh, callback) {
    if (refresh) nodes = MT2.getVisibleNodes();
    var unit = session.style.widgets['choropleth-aggregate-as'];
    if (unit == 'countries') {
      if (!temp.mapData.countries) {
        MT2.getMapData('countries.json').then(() => aggregate(false, callback));
        return;
      }
      var val = session.style.widgets['choropleth-aggregate-on'];
      temp.mapData.countries.features.forEach(c => c.properties.density = 0);
      nodes.forEach(n => {
        if (n[val] === undefined) return;
        var country = temp.mapData.countries.features.find(c => c.id == n[val] || c.properties.name == n[val]);
        if (country) country.properties.density++;
      });
    } else if (unit == 'states') {
      if (!temp.mapData.states) {
        MT2.getMapData('states.json').then(() => aggregate(false, callback));
        return;
      }
      var val = session.style.widgets['choropleth-aggregate-on'];
      temp.mapData.states.features.forEach(c => c.properties.density = 0);
      nodes.forEach(n => {
        var state = temp.mapData.states.features.find(s => s.properties.usps == n[val] || s.properties.name == n[val]);
        if (state) state.properties.density++;
      });
    } else { //unit == 'counties'
      if (!temp.mapData.counties) {
        MT2.getMapData('counties.json').then(() => aggregate(false, callback));
        return;
      }
      var val = session.style.widgets['choropleth-aggregate-on'];
      temp.mapData.counties.features.forEach(c => c.properties.density = 0);
      nodes.forEach(n => {
        var county = temp.mapData.counties.features.find(c => {
          return (c.properties.fips == n[val] ||
            parseFloat(c.properties.fips) == parseFloat(n[val]));
        });
        if (county) return county.properties.density++;
      });
    }
    if (callback) callback();
  }

  var ramp = d3.scaleLinear().domain([0, 0.5, 1]).range([
    session.style.widgets['choropleth-color-low'],
    session.style.widgets['choropleth-color-medium'],
    session.style.widgets['choropleth-color-high']
  ]);

  function render() {
    if(!$('#choropleth').length) return;
    layers.aggregates.remove();
    var maxD = 0, minD = Infinity;
    var data = temp.mapData[session.style.widgets['choropleth-aggregate-as']];
    var n = data.features.length;
    for (var i = 0; i < n; i++) {
      var thing = data.features[i];
      if (thing.properties.density < minD) minD = thing.properties.density;
      if (thing.properties.density > maxD) maxD = thing.properties.density;
    }
    var range = maxD - minD;
    var opacity = 1 - session.style.widgets['choropleth-transparency'];
    layers.aggregates = L.geoJson(data, {
      style: function (a) {
        return {
          fillColor: ramp((a.properties.density - minD) / range),
          weight: 2,
          opacity: 1,
          color: '#dadde0',
          fillOpacity: opacity
        }
      },
      onEachFeature: function (feature, layer) {
        layer
          .on('mouseover', function (e) {
            $('#tooltip')
              .html('<b>' + e.target.feature.properties.name + '</b>&nbsp;' + e.target.feature.properties.density)
              .css({
                'opacity': 1,
                'z-index': 10000,
                top: e.containerPoint.y,
                left: e.containerPoint.x
              });
          })
          .on('mouseout', function () {
            $('#tooltip')
              .css({
                opacity: 0,
                'z-index': -1
              });
          })
      }
    });
    layers.aggregates.addTo(choropleth).bringToFront();
    legend.remove();
    legend = L.control({ position: 'bottomleft' });
    legend.onAdd = function () {
      var div = L.DomUtil.create('div', 'legend');
      var canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 25;
      var context = canvas.getContext("2d");
      context.color = '#dadde0';
      for (var i = 0; i < 256; ++i) {
        context.fillStyle = d3.rgb(ramp(i / 255)).hex();
        context.fillRect(i, 0, 1, 25);
      }
      context.font = "bold 20px sans";
      context.fillStyle = "black";
      context.fillText(minD + '', 5, 20);
      context.fillStyle = "white";
      context.textAlign = "right";
      context.fillText(maxD + '', 251, 20);
      $(div).append(canvas);
      return div;
    };
    zoomer.remove();
    legend.addTo(choropleth);
    zoomer.addTo(choropleth);
  }

  function showNodeTooltip(e) {
    var d = e.layer.options.data;
    var v = session.style.widgets['choropleth-tooltip-variable'];
    if (v !== 'None' && d[v]) {
      d3.select('#tooltip')
        .html(d[v])
        .style('left', (e.originalEvent.pageX + 8) + 'px')
        .style('top', (e.originalEvent.pageY + 18) + 'px')
        .style('z-index', 1001)
        .transition().duration(100)
        .style('opacity', 1);
    }
  }

  function hideTooltip() {
    var tooltip = d3.select('#tooltip');
    tooltip
      .transition().duration(100)
      .style('opacity', 0)
      .on('end', () => tooltip.style('z-index', -1));
  }

  function clickHandler(e) {
    var node = e.sourceTarget.feature.properties;
    var d = session.data.nodes.find(d => d.id == node._id);
    if (!e.originalEvent.ctrlKey) {
      session.data.nodes
        .filter(node => node._id !== d.id)
        .forEach(node => node.selected = false);
    }
    d.selected = !d.selected;
    $window.trigger('node-selected');
  }

  $('#toggle-choropleth-settings').on('click', function () {
    var pane = $('#choropleth-settings-pane');
    if ($(this).hasClass('active')) {
      pane.animate({ left: '-400px' }, function () { pane.hide(); });
    } else {
      pane.show(0, function () { pane.animate({ left: '0px' }); });
    }
  });

  $('#choropleth-aggregate-as').on('change', function () {
    session.style.widgets['choropleth-aggregate-as'] = this.value;
    aggregate(false, render);
  });

  $('#choropleth-aggregate-on').on('change', function () {
    session.style.widgets['choropleth-aggregate-on'] = this.value;
    aggregate(false, render);
  });

  function updateRamp() {
    ramp = d3.scaleLinear().domain([0, 0.5, 1]).range([
      session.style.widgets['choropleth-color-low'],
      session.style.widgets['choropleth-color-medium'],
      session.style.widgets['choropleth-color-high']
    ]);
  }

  $("#choropleth-color-low").on('change', function () {
    session.style.widgets["choropleth-color-low"] = this.value;
    updateRamp();
    render();
  });

  $("#choropleth-color-medium").on('change', function () {
    session.style.widgets["choropleth-color-medium"] = this.value;
    updateRamp();
    render();
  });

  $("#choropleth-color-high").on('change', function () {
    session.style.widgets["choropleth-color-high"] = this.value;
    updateRamp();
    render();
  });

  $('#choropleth-transparency').on('input', function () {
    var v = parseFloat(this.value);
    session.style.widgets['choropleth-transparency'] = v;
    $('.legend canvas').css('opacity', 1 - v);
    layers.aggregates.setStyle({ 'fillOpacity': 1 - v });
  });

  $('#choropleth-basemap-show').parent().on('click', function () {
    session.style.widgets['choropleth-basemap-show'] = true;
    layers.basemap.addTo(choropleth);
    $('#choropleth-satellite-hide').trigger('click');
    layers.countries.remove();
  });
  $('#choropleth-basemap-hide').parent().on('click', function () {
    session.style.widgets['choropleth-basemap-show'] = false;
    layers.basemap.remove();
    layers.countries.addTo(choropleth);
  });

  $('#choropleth-satellite-show').parent().on('click', function () {
    session.style.widgets['choropleth-satellite-show'] = true;
    layers.satellite.addTo(choropleth);
    $('#choropleth-basemap-hide').trigger('click');
    layers.countries.remove();
  });
  $('#choropleth-satellite-hide').parent().on('click', function () {
    session.style.widgets['choropleth-satellite-show'] = false;
    layers.satellite.remove();
    layers.countries.addTo(choropleth);
  });

  $('#choropleth-file-input').on('change', event => {
    Array.from(event.target.files).forEach(file => {
      const { name } = file;
      if (name.endsWith("json")) {
        const layerName = name.split('.').slice(0, -1).join('.').toLowerCase();
        const reader = new FileReader();
        reader.onload = function (event2) {
          temp.mapData[layerName] = JSON.parse(event2.target.result);
          layers[layerName] = L.geoJSON(temp.mapData[layerName], {
            color: '#000',
            weight: .75,
            fillColor: '#fafaf8',
            fillOpacity: .5
          });
          layers[layerName].addTo(choropleth);
          var colorCell = $('<div class="col-3"></div>').append(
            $('<input type="color" class="w-100">').on('change', function (e) {
              layers[layerName].setStyle(f => ({ color: e.target.value }));
            })
          );
          var nameCell = $(`<div class="col-9">${layerName}</div>`).prepend(
            $('<a href="#" class="oi oi-circle-x align-middle p-1" title="Remove this file"></a>').on('click', function () {
              nameCell.remove();
              colorCell.remove();
              layers[layerName].remove();
            })
          );
          $('#choropleth-geojson-layers')
            .append(nameCell)
            .append(colorCell);
        };
        reader.readAsText(file);
      } else {
        alert("Only GeoJSON Files are currently Supported.");
      }
    });
  });

  $('#choropleth-export').on('click', function () {
    var format = $('#choropleth-export-file-format').val();
    if (['png', 'jpeg', 'webp'].includes(format)) {
      leafletImage(choropleth, function (err, canvas) {
        var ctx = canvas.getContext('2d');
        ctx.globalAlpha = 1 - session.style.widgets['choropleth-transparency'];
        ctx.drawImage($('.legend canvas')[0], 10, canvas.height - 40);
        canvas.toBlob(blob => {
          saveAs(blob, $('#choropleth-export-file-name').val() + '.' + format);
        }, 'image/' + format);
      });
    } else { //geojson
      saveAs(
        new Blob(
          [JSON.stringify(temp.mapData[session.style.widgets['choropleth-aggregate-as']])],
          { type: 'application/json;charset=utf-8' }),
        $('#choropleth-export-file-name').val() + '.' + format
      );
    }
  });

  $('#choropleth-fit').on('click', function () {
    choropleth.flyToBounds(layers.aggregates.getBounds());
  });

  $window
    .on('node-visibility', function () {
      aggregate(true, render);
    });

  layout.on('stateChanged', function () {
    setTimeout(function () {
      choropleth.invalidateSize();
    }, 80);
  });

  MT2.getMapData('countries.json').then(() => {
    layers.countries = L.geoJSON(temp.mapData.countries, {
      color: '#dadde0',
      weight: 1,
      fillColor: '#fafaf8',
      fillOpacity: 1
    });
    layers.countries.addTo(choropleth);
  });
}) ();
