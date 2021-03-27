(function () {
  let plot;

  function redrawHistogram() {
    let panel = $('#histogram');
    if (!panel.length) return;
    if (plot) Plotly.purge('histogram');
    let varSource, varName, axis = 'x', nonAxis = 'y';
    [varSource, ...varName] = session.style.widgets['histogram-variable'].split('-');
    varName = varName.join('-');
    if (!session.style.widgets['histogram-axis-x']) {
      axis = 'y', nonAxis = 'x';
    }
    let traces = [];
    let layout = {
      width: panel.width(),
      height: panel.parent().height()
    };
    if (varSource == 'nodes' && session.style.widgets['node-color-variable'] !== 'None') {
      let values = [];
      let field = session.style.widgets['node-color-variable'];
      session.data.nodes.forEach(d => {
        if (!values.includes(d[field])) values.push(d[field]);
      });
      let vnodes = MT2.getVisibleNodes();
      values.forEach((v, i) => {
        let trace = {
          type: 'histogram',
          marker: {
            color: temp.style.nodeColorMap(v),
          },
          showlegend: false,
          hoverinfo: 'skip'
        };
        trace[axis] = vnodes.filter(d => d[field] == v).map(d => d[varName]);
        traces.push(trace);
      });
      layout.barmode = 'stack';
    } else if (varSource == 'links' && !['None', 'origin'].includes(session.style.widgets['link-color-variable'])) {
      let values = [];
      let field = session.style.widgets['link-color-variable'];
      session.data.links.forEach(d => {
        if (!(d[field] in values)) values.push(d[field]);
      });
      let vlinks = MT2.getVisibleLinks();
      values.forEach((v, i) => {
        let trace = {
          type: 'histogram',
          marker: {
            color: temp.style.linkColorMap(v),
          },
          showlegend: false,
          hoverinfo: 'skip'
        };
        trace[axis] = vlinks.filter(d => d[field] == v).map(d => d[varName]);
        traces.push(trace);
      });
      layout.barmode = 'stack';
    } else {
      let trace = {
        type: 'histogram',
        marker: {
          color: varSource == 'nodes' ? session.style.widgets['node-color'] : session.style.widgets['link-color'],
        },
        showlegend: false,
        hoverinfo: 'skip'
      };
      trace[axis] = (varSource == 'nodes' ? MT2.getVisibleNodes() : MT2.getVisibleLinks()).map(l => l[varName]);
      traces = [trace];
    }
    layout[axis + 'axis'] = {
      title: MT2.titleize(varName)
    }
    layout[nonAxis + 'axis'] = {
      title: 'Number of ' + MT2.titleize(varSource),
      type: session.style.widgets['histogram-scale-log'] ? 'log' : ''
    };
    traces.sort(function(a, b) { //#242
      return a.x.length - b.x.length;
    });
    plot = Plotly.newPlot('histogram', traces, layout, {
      displaylogo: false,
      displayModeBar: false,
      scrollZoom: true
    });
    setBackground();
  }

  function setBackground() {
    let col = session.style.widgets['background-color'];
    $('#histogram svg.main-svg').first().css('background', col);
    $('#histogram rect.bg').css('fill', col);

    let contrast = session.style.widgets['background-color-contrast'];
    $('#histogram .xtitle, .ytitle').css('fill', contrast);
    $('#histogram .xaxislayer-above text').css('fill', contrast);
    $('#histogram .yaxislayer-above text').css('fill', contrast);
  }

  $('#toggle-histogram-settings').on('click', function () {
    let pane = $('#histogram-settings-pane');
    if ($(this).hasClass('active')) {
      pane.animate({ left: '-400px' }, function () { pane.hide(); });
    } else {
      pane.show(0, function () { pane.animate({ left: '0px' }); });
    }
  });

  $('#histogram-variable').on('change', function (e) {
    session.style.widgets['histogram-variable'] = e.target.value;
    redrawHistogram();
  });

  $('#histogram-scale-log').parent().on('click', function () {
    session.style.widgets['histogram-scale-log'] = true;
    redrawHistogram();
  });

  $('#histogram-scale-linear').parent().on('click', function () {
    session.style.widgets['histogram-scale-log'] = false;
    redrawHistogram();
  });

  $('#histogram-axis-x').parent().on('click', function () {
    session.style.widgets['histogram-axis-x'] = true;
    redrawHistogram();
  });

  $('#histogram-axis-y').parent().on('click', function () {
    session.style.widgets['histogram-axis-x'] = false;
    redrawHistogram();
  });

  $('#histogram-export-filetype').on('change', function (e) {
    if (e.target.value == 'svg') {
      $('#histogram-export-advanced-button').slideUp();
      if ($('#histogram-export-advanced').hasClass("show")) $('#histogram-export-advanced-button').click();
    } else {
      $('#histogram-export-advanced-button').slideDown();
    }
  });

  $('#histogram-export-scale').on('input', function (e) {
    let scale = parseFloat(e.target.value);
    let wrapper = $('#histogram').parent();
    $('#histogram-export-dimensions').text(
      Math.round(wrapper.width() * scale) + 'x' +
      Math.round(wrapper.height() * scale) + 'px'
    );
  }).trigger('input');

  $('#histogram-export').on('click', function () {
    let $histogram = $('#histogram .main-svg');
    let histogram = $histogram.get(0);
    $('#histogram .main-svg .infolayer').appendTo(histogram);
    let watermark = d3.select(histogram).append('image')
      .attr('xlink:href', MT2.watermark)
      .attr('height', 128)
      .attr('width', 128)
      .attr('x', 10)
      .style('opacity', $('#histogram-export-opacity').val());
    let filename = $('#histogram-export-filename').val(),
      filetype = $('#histogram-export-filetype').val();
    if (filetype == 'svg') {
      let content = MT2.unparseSVG(histogram);
      let blob = new Blob([content], { type: 'image/svg+xml;charset=utf-8' });
      saveAs(blob, filename + '.' + filetype);
      watermark.remove();
    } else {
      saveSvgAsPng(histogram, filename + '.' + filetype, {
        scale: parseFloat($('#histogram-export-scale').val()),
        backgroundColor: session.style.widgets['background-color'],
        encoderType: 'image/' + filetype,
        encoderOptions: parseFloat($('#histogram-export-quality').val())
      }).then(() => watermark.remove());
    }
  });

  $window
    .on('node-color-change link-color-change', redrawHistogram)
    .on('background-color-change', setBackground);

  layout.on('stateChanged', redrawHistogram);
  setTimeout(redrawHistogram, 80);
})();