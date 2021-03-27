(function () {
  let plot;

  function drawFlowDiagram() {
    if (!$('#flow').length) return;
    if (plot) Plotly.purge('flow');
    let width = $('#flow').parent().width() - 40,
      height = $('#flow').parent().height() - 60;

    let data;
    if (session.style.widgets['flow-showNodes']) {
      data = MT2.getVisibleNodes();
    } else {
      data = MT2.getVisibleLinks();
    }

    let order = [];
    $($('#flow-variables').find('select')).each(function (i) { order.push(this.value); });
    let variables = order.length;

    let values = [], source_values = [], target_values = [], all_values = [], labels = [], vars = [];
    for (let i = 0; i < variables; i++) {
      variable = order[i];
      let n = data.length;
      for (let j = 0; j < n; j++) {
        let value = data[j][variable] + '';
        if (!values.includes(value)) values.push(value);
      }
      n = values.length;
      for (let j = 0; j < n; j++) {
        labels.push(MT2.titleize(values[j]));
        vars.push(MT2.titleize(variable));
        let value = variable + '-' + values[j] + '-' + i;
        if (i < variables - 1) source_values.push(value);
        if (i > 0) target_values.push(value);
        all_values.push(value);
      }
    }

    let link_matrix = {}, target_list = {};
    target_values.forEach(target => target_list[target] = 0);
    source_values.forEach(source => link_matrix[source] = Object.assign({}, target_list));

    let m = order.length - 1, n = data.length;
    for (let i = 0; i < m; i++) {
      let source_variable = order[i];
      let target_variable = order[i + 1];
      for (let j = 0; j < n; j++) {
        let point = data[j];
        link_matrix[source_variable + '-' + point[source_variable] + '-' + i][target_variable + '-' + point[target_variable] + '-' + (i + 1)]++;
      }
    }

    let source = [], target = [], value = [];

    m = source_values.length, n = target_values.length;
    for (let i = 0; i < m; i++) {
      let s = source_values[i];
      let index = all_values.indexOf(s);
      for (let j = 0; j < n; j++) {
        let t = target_values[j];
        if (link_matrix[s][t] > 0) {
          source.push(index);
          target.push(all_values.indexOf(t));
          value.push(link_matrix[s][t]);
        }
      }
    }

    Plotly.react('flow', [{
      type: 'sankey',
      showLegend: false,
      orientation: 'h',
      arrangement: 'snap',
      node: {
        pad: 15,
        thickness: 30,
        line: {
          color: 'black',
          width: 0.5
        },
        label: labels.map(MT2.titleize),
        color: session.style.widgets['flow-showNodes'] ? session.style.widgets['node-color'] : session.style.widgets['link-color'],
        customdata: vars.map(MT2.titleize),
        hovertemplate: "<b> %{customdata}:  %{label} </b><br>Incoming flow count: %{targetLinks.length} <br>Outgoing flow count: %{sourceLinks.length}"+ "<extra>%{value}</extra>"
      },
      link: { source, target, value }
    }], {
        width: width,
        height: height
      }, {
        displaylogo: false,
        displayModeBar: false
      });

    if (session.style.widgets['background-color']) $('#flow').parent().css('background-color', session.style.widgets['background-color']);
  }

  $('#toggle-flow-settings').click(function () {
    let pane = $('#flow-settings-pane');
    if ($(this).hasClass('active')) {
      pane.animate({ left: '-400px' }, function () { pane.hide(); });
    } else {
      pane.show(0, function () { pane.animate({ left: '0px' }); });
    }
  });

  $('#flow-showNodes').parent().on('click', function () {
    session.style.widgets['flow-showNodes'] = true;
    $('.flow-selector').html(session.data.nodeFields.map(v => '<option value="' + v + '">' + MT2.titleize(v) + '</option>').join(''));
  });

  $('#flow-showLinks').parent().on('click', function () {
    session.style.widgets['flow-showNodes'] = false;
    $('.flow-selector').html(session.data.linkFields.map(v => '<option value="' + v + '">' + MT2.titleize(v) + '</option>').join(''));
  });

  $('#flow-add-variable').on('click', function () {
    let fields = session.style.widgets['flow-showNodes'] ? session.data.nodeFields : session.data.linkFields;
    $('#flow-variables').append(`<li class='flow-items'>
      <span class="oi oi-x flow-remove"></span>
      <select class='form-control form-control-sm flow-selector'>
        ${fields.map(v => `<option value="${v}" ${v == 'cluster' ? 'selected' : ''}>${MT2.titleize(v)}</option>`).join('\n')}
      </select>
      <span class="oi oi-elevator"></span>
    </li>`);

    sortable('#flow-variables')[0].addEventListener('sortupdate', drawFlowDiagram);

    $('.flow-selector').on('change', drawFlowDiagram);

    $('.flow-remove').on('click', function () {
      $(this).parent().slideUp().remove();
      drawFlowDiagram();
    });
  }).trigger('click').trigger('click');

  $('#flow-export-filetype').on('change', function (e) {
    if (e.target.value == 'svg') {
      $('#flow-export-advanced-button').slideUp();
      if ($('#flow-export-advanced').hasClass("show")) $('#flow-export-advanced-button').click();
    } else {
      $('#flow-export-advanced-button').slideDown();
    }
  });

  $('#flow-export-scale').on('input', function (e) {
    let scale = parseFloat(e.target.value);
    let wrapper = $('#flow').parent();
    $('#flow-export-dimensions').text(
      Math.round(wrapper.width() * scale) + 'x' +
      Math.round(wrapper.height() * scale) + 'px'
    );
  }).trigger('input');

  $('#flow-export').on('click', function () {
    let $flow = $('#flow .main-svg');
    let flow = $flow.get(0);
    let watermark = d3.select(flow).append('image')
      .attr('xlink:href', MT2.watermark)
      .attr('height', 128)
      .attr('width', 128)
      .attr('x', 10)
      .style('opacity', $('#flow-export-opacity').val());
    let filename = $('#flow-export-filename').val(),
      filetype = $('#flow-export-filetype').val();
    if (filetype == 'svg') {
      let content = MT2.unparseSVG(flow);
      let blob = new Blob([content], { type: 'image/svg+xml;charset=utf-8' });
      saveAs(blob, filename + '.' + filetype);
      watermark.remove();
    } else {
      saveSvgAsPng(flow, filename + '.' + filetype, {
        scale: parseFloat($('#flow-export-scale').val()),
        backgroundColor: session.style.widgets['background-color'],
        encoderType: 'image/' + filetype,
        encoderOptions: parseFloat($('#flow-export-quality').val())
      }).then(() => watermark.remove());
    }
  });

  layout.on('stateChanged', drawFlowDiagram);

  $window
    .on('node-selected', drawFlowDiagram)
    .on('link-visibility', drawFlowDiagram)
    .on('node-visibility', drawFlowDiagram)
    .on('background-color-change', function () {
      $('#flow-diagram').parent().css('background-color', session.style.widgets['background-color']);
    });
})();