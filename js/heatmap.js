(function () {
  let labels, xLabels, yLabels, matrix, plot;

  async function redrawHeatmap() {
    if (!$('#heatmap').length) return;
    if (plot) Plotly.purge('heatmap');
    let labels = Object.keys(temp.matrix);
    let xLabels = labels.map(d => 'N' + d);
    let yLabels = xLabels.slice();
    const metric = session.style.widgets['link-sort-variable'];
    const n = xLabels.length;
    matrix = await MT2.getDM();

    if (session.style.widgets['heatmap-invertX']) {
      matrix.forEach(l => l.reverse());
      xLabels.reverse();
    }

    if (session.style.widgets['heatmap-invertY']) {
      matrix.reverse();
      yLabels.reverse();
    }

    let config = {
      autotick: false,
      showticklabels: session.style.widgets['heatmap-axislabels-show']
    };

    if (!config.showticklabels) {
      config.ticks = '';
    }

    plot = Plotly.newPlot('heatmap', [{
      x: xLabels,
      y: yLabels,
      z: matrix,
      type: 'heatmap',
      colorscale: [
        [0, session.style.widgets['heatmap-color-low']],
        [0.5, session.style.widgets['heatmap-color-medium']],
        [1, session.style.widgets['heatmap-color-high']]
      ]
    }], {
        xaxis: config,
        yaxis: config,
        width: $('#heatmap').parent().width(),
        height: $('#heatmap').parent().height()
      }, {
        displaylogo: false,
        displayModeBar: false
      });
    setBackground();
  }

  $('#heatmap-settings-toggle').click(function () {
    let pane = $('#heatmap-settings-pane');
    if ($(this).hasClass('active')) {
      pane.animate({ left: '-400px' }, () => pane.hide());
    } else {
      pane.show(0, () => pane.animate({ left: '0px' }));
    }
  });

  $('#heatmap-axislabels-show').on('change', function () {
    session.style.widgets['heatmap-axislabels-show'] = $(this).is(':checked');
    redrawHeatmap();
  });

  $('#heatmap-axislabels-hide').on('change', function () {
    session.style.widgets['heatmap-axislabels-show'] = !$(this).is(':checked');
    redrawHeatmap();
  });

  $('#heatmap-invertX').on('change', function () {
    session.style.widgets['heatmap-invertX'] = $(this).is(':checked');
    redrawHeatmap();
  });

  $('#heatmap-invertY').on('change', function () {
    session.style.widgets['heatmap-invertY'] = $(this).is(':checked');
    redrawHeatmap();
  });

  $('#heatmap-color-low').on('change', function () {
    session.style.widgets['heatmap-color-low'] = this.value;
    redrawHeatmap();
  });

  $('#heatmap-color-medium').on('change', function () {
    session.style.widgets['heatmap-color-medium'] = this.value;
    redrawHeatmap();
  });

  $('#heatmap-color-high').on('change', function () {
    session.style.widgets['heatmap-color-high'] = this.value;
    redrawHeatmap();
  });

  $('#heatmap-export-filetype').on('change', function () {
    if (this.value == 'svg') {
      $('#heatmap-export-advanced-button').slideUp();
      if ($('#heatmap-export-advanced').hasClass("show")) $('#heatmap-export-advanced-button').click();
    } else {
      $('#heatmap-export-advanced-button').slideDown();
    }
  });

  $('#heatmap-export-scale').on('input', function () {
    let scale = parseFloat(this.value);
    let wrapper = $('#heatmap').parent();
    $('#heatmap-export-dimensions').text(
      Math.round(wrapper.width() * scale) + 'x' +
      Math.round(wrapper.height() * scale) + 'px'
    );
  }).trigger('input');

  $('#heatmap-export').on('click', function () {
    let filename = $('#heatmap-export-filename').val(),
      filetype = $('#heatmap-export-filetype').val();
    if (filetype == 'csv' || filetype == 'xlsx') {
      let labels = Object.keys(temp.matrix);
      let data = [[''].concat(labels)].concat(matrix.map((l, i) => [labels[i]].concat(l)));
      if (filetype == 'csv') {
        let blob = new Blob([Papa.unparse(data)], { type: 'text/csv;charset=utf-8' });
        saveAs(blob, filename + '.' + filetype);
      } else if (filetype == 'xlsx') {
        let wb = XLSX.utils.book_new();
        let ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, name);
        XLSX.writeFile(wb, filename + '.' + filetype);
      }
      return;
    }
    let $heatmap = $('#heatmap .main-svg');
    let heatmap = $heatmap.get(0);
    $('#heatmap .main-svg .infolayer').appendTo(heatmap);
    let watermark = d3.select(heatmap).append('image')
      .attr('xlink:href', MT2.watermark)
      .attr('height', 128)
      .attr('width', 128)
      .attr('x', 10)
      .style('opacity', $('#heatmap-export-opacity').val());
    if (filetype == 'svg') {
      let content = MT2.unparseSVG(heatmap);
      let blob = new Blob([content], { type: 'image/svg+xml;charset=utf-8' });
      saveAs(blob, filename + '.' + filetype);
      watermark.remove();
    } else {
      saveSvgAsPng(heatmap, filename + '.' + filetype, {
        scale: parseFloat($('#heatmap-export-scale').val()),
        backgroundColor: session.style.widgets['background-color'],
        encoderType: 'image/' + filetype,
        encoderOptions: parseFloat($('#heatmap-export-quality').val())
      }).then(() => watermark.remove());
    }
  });

  function setBackground() {
    let col = session.style.widgets['background-color'];
    $('#heatmap svg.main-svg').first().css('background', col);
    $('#heatmap rect.bg').css('fill', col);

    let contrast = session.style.widgets['background-color-contrast'];
    $('#heatmap .xtitle, .ytitle').css('fill', contrast);
    $('#heatmap .xaxislayer-above text').css('fill', contrast);
    $('#heatmap .yaxislayer-above text').css('fill', contrast);
  }

  $window.on('background-color-change', setBackground);

  layout.on('stateChanged', redrawHeatmap);
})();