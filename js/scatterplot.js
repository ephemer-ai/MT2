(function () {
  let plot;

  function redrawScatterplot() {
    if (!$('#scatterplot').length) return;
    if (plot) Plotly.purge('scatterplot');
    let dataset = session.style.widgets['scatterplot-showNodes'] ? 'node' : 'link';
    let xVar = session.style.widgets['scatterplot-xVar'];
    let yVar = session.style.widgets['scatterplot-yVar'];
    let subset = session.data[dataset + 's'].filter(l => l.visible);
    plot = Plotly.newPlot('scatterplot', [{
      x: subset.map(l => l[xVar]),
      y: subset.map(l => l[yVar]),
      type: 'scatter',
      mode: 'markers',
      marker: {
        color: session.style.widgets[dataset + '-color'],
      }
    }], {
        yaxis: {
          title: MT2.titleize(yVar),
          type: session.style.widgets['scatterplot-logScale']
        },
        xaxis: {
          title: MT2.titleize(xVar)
        },
        width: $('#scatterplot').parent().width(),
        height: $('#scatterplot').parent().height()
      }, {
        displaylogo: false,
        displayModeBar: false
      });
    setBackground();
  }

  $('#toggle-scatterplot-settings').on('click', function () {
    let pane = $('#scatterplot-settings-pane');
    if ($(this).hasClass('active')) {
      pane.animate({ left: '-400px' }, function () { pane.hide(); });
    } else {
      pane.show(0, function () { pane.animate({ left: '0px' }); });
    }
  });

  $('#scatterplot-showNodes').parent().on('click', function (e) {
    session.style.widgets['scatterplot-showNodes'] = true;
    $('#scatterplot').parent().find('#scatterplot-xVar, #scatterplot-yVar').html(
      session.data.nodeFields.map(function (field) { return '<option value="' + field + '">' + MT2.titleize(field) + '</option>'; }).join('\n')
    );
    //redrawScatterplot();
  });

  $('#scatterplot-showLinks').parent().on('click', function (e) {
    session.style.widgets['scatterplot-showNodes'] = false;
    $('#scatterplot').parent().find('#scatterplot-xVar, #scatterplot-yVar').html(
      session.data.linkFields.map(function (field) { return '<option value="' + field + '">' + MT2.titleize(field) + '</option>'; }).join('\n')
    );
    //redrawScatterplot();
  });

  $('#scatterplot-xVar').on('change', function (e) {
    session.style.widgets['scatterplot-xVar'] = e.target.value;
    redrawScatterplot();
  });

  $('#scatterplot-yVar').on('change', function (e) {
    session.style.widgets['scatterplot-yVar'] = e.target.value;
    redrawScatterplot();
  });

  $('#scatterplot-logScale').on('change', function () {
    session.style.widgets['scatterplot-logScale'] = true;
    redrawScatterplot();
  });

  $('#scatterplot-linearScale').on('change', function () {
    session.style.widgets['scatterplot-logScale'] = false;
    redrawScatterplot();
  });

  function setBackground() {
    let col = session.style.widgets['background-color'];
    $('#scatterplot svg.main-svg').first().css('background', col);
    $('#scatterplot rect.bg').css('fill', col);

    let contrast = session.style.widgets['background-color-contrast'];
    $('#scatterplot .xtitle, .ytitle').css('fill', contrast);
    $('#scatterplot .xaxislayer-above text').css('fill', contrast);
    $('#scatterplot .yaxislayer-above text').css('fill', contrast);
    $('#scatterplot .zl.crisp, .xgrid.crisp, .ygrid.crisp').css('stroke', contrast);
  }

  $('#scatterplot-export-filetype').on('change', function (e) {
    if (e.target.value == 'svg') {
      $('#scatterplot-export-advanced-button').parent().parent().slideUp();
      if ($('#scatterplot-export-advanced').hasClass("show")) $('#scatterplot-export-advanced-button').click();
    } else {
      $('#scatterplot-export-advanced-button').parent().parent().slideDown();
    }
  });

  $('#scatterplot-export-scale').on('input', function (e) {
    let scale = parseFloat(e.target.value);
    let wrapper = $('#scatterplot').parent();
    $('#scatterplot-export-dimensions').text(
      Math.round(wrapper.width() * scale) + 'x' +
      Math.round(wrapper.height() * scale) + 'px'
    );
  }).trigger('input');

  $('#scatterplot-export').on('click', function () {
    let $scatterplot = $('#scatterplot .main-svg');
    let scatterplot = $scatterplot[0];
    $scatterplot.find('.infolayer').appendTo(scatterplot);
    let watermark = d3.select(scatterplot).append('image')
      .attr('xlink:href', MT2.watermark)
      .attr('height', 128)
      .attr('width', 128)
      .attr('x', 10)
      .style('opacity', $('#scatterplot-export-opacity').val());
    let filename = $('#scatterplot-export-filename').val(),
      filetype = $('#scatterplot-export-filetype').val();
    if (filetype == 'svg') {
      let content = MT2.unparseSVG(scatterplot);
      let blob = new Blob([content], { type: 'image/svg+xml;charset=utf-8' });
      saveAs(blob, filename + '.' + filetype);
      watermark.remove();
    } else {
      saveSvgAsPng(scatterplot, filename + '.' + filetype, {
        scale: parseFloat($('#scatterplot-export-scale').val()),
        backgroundColor: session.style.widgets['background-color'],
        encoderType: 'image/' + filetype,
        encoderOptions: parseFloat($('#scatterplot-export-quality').val())
      }).then(() => watermark.remove());
    }
  });

  layout.on('stateChanged', redrawScatterplot);

  $window
    .on('background-color-change', setBackground)
    .on('link-color-change', redrawScatterplot);

})();