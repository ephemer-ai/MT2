(function () {
  let width, height, center, simulation, vnodes,
    svg = d3.select('#bubbles');

  function updateVNodes() {
    let newnodes = MT2.getVisibleNodes(true);
    if (!vnodes) vnodes = newnodes;
    newnodes.forEach(newNode => {
      let old = vnodes.find(oldNode => oldNode._id == newNode._id);
      if (old) {
        newNode.x = old.x;
        newNode.y = old.y;
      } else {
        newNode.x = center.x;
        newNode.y = center.y;
      };
    });
    vnodes = newnodes;
  }

  function reset() {
    let bv = $('#bubbles');
    if (!bv.length) return;
    bv.css('background-color', session.style.widgets['background-color']);
    width = bv.parent().width();
    height = bv.parent().height();
    center = { x: width / 2, y: height / 2 };

    svg.attr('width', width).attr('height', height);

    svg
      .select('#bubble-xAxisLabel').attr('x', center.x);
    svg
      .select('#bubble-yAxisLabel').attr('y', center.y)
      .attr('transform', 'rotate(270, 10,' + (center.y - 10) + ')');

    updateVNodes();

    let radius = $('#bubble-size').val();
    let bubble = svg.selectAll('circle').data(vnodes);
    bubble.exit().remove();
    bubble.enter().append('circle')
      .attr('r', radius)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2)
      .on('click', function (d) {
        let c = session.data.nodes.find(node => d._id == node._id);
        c.selected = !c.selected;
        $window.trigger('node-selected');
      });

    updateNodeColors();

    var charge = -session.style.widgets['bubble-charge'];
    simulation = d3.forceSimulation().nodes(vnodes)
      .velocityDecay(0.2)
      .force('x', d3.forceX().strength(0.03).x(center.x))
      .force('y', d3.forceY().strength(0.03).y(center.y))
      .force('charge', d3.forceManyBody().strength(d => charge))
      .on('tick', function () {
        svg.selectAll('circle')
          .attr('cx', function (d) { return d.x })
          .attr('cy', function (d) { return d.y });
      });

    groupBubblesX();
    groupBubblesY();
  }

  $('#bubble-x').on('change', function () {
    session.style.widgets['bubble-x'] = this.value;
    groupBubblesX();
  });

  let isNumber = a => typeof a == "number";

  function groupBubblesX() {
    let field = session.style.widgets['bubble-x'];
    if (field == 'None') {
      svg.select('#bubble-xAxisLabel').text('');
      svg.selectAll('.xtitle').remove();
      simulation.force('x', d3.forceX().strength(0.03).x(center.x));
      simulation.alpha(1).restart();
      return;
    }
    svg.select('#bubble-xAxisLabel').text(MT2.titleize(field));
    let values = [];
    vnodes.forEach(function (d) {
      if (values.indexOf(d[field]) == -1) values.push(d[field]);
    });
    if (isNumber(values[0])) {
      values.sort((a, b) => a - b);
    } else {
      values.sort();
    }
    let ratio = width / (values.length + 1);
    let titles = svg.selectAll('.xtitle').data(values);
    titles.exit().remove();
    titles.enter().append('text')
      .attr('class', 'xtitle')
      .attr('y', 50)
      .attr('text-anchor', 'middle')
      .merge(titles)
      .transition()
      .text(function (d) { return d })
      .attr('x', function (d) { return ratio * values.indexOf(d) + ratio });
    simulation.force('x', d3.forceX().strength(0.03).x(function (d) {
      return ratio * values.indexOf(d[field]) + ratio;
    }));
    simulation.alpha(1).restart();
  }

  $('#bubble-y').on('change', function () {
    session.style.widgets['bubble-y'] = this.value;
    groupBubblesY();
  });

  function groupBubblesY() {
    let field = session.style.widgets['bubble-y'];
    if (field == 'None') {
      svg.select('#bubble-yAxisLabel').text('');
      svg.selectAll('.ytitle').remove();
      simulation.force('y', d3.forceY().strength(0.03).y(center.y));
      simulation.alpha(1).restart();
      return;
    }
    svg.select('#bubble-yAxisLabel').text(MT2.titleize(field));
    let values = [];
    vnodes.forEach(function (d) {
      if (values.indexOf(d[field]) == -1) values.push(d[field]);
    });
    if (isNumber(values[0])) {
      values.sort((a, b) => b - a);
    } else {
      values.sort();
    }
    let ratio = height / (values.length + 1);
    let titles = svg.selectAll('.ytitle').data(values);
    titles.exit().remove();
    titles.enter().append('text')
      .attr('class', 'ytitle')
      .attr('x', 50)
      .merge(titles)
      .transition()
      .text(function (d) { return d })
      .attr('y', function (d) { return ratio * values.indexOf(d) + ratio })
      .attr('transform', function (d) { return 'rotate(270, 50,' + (ratio * values.indexOf(d) + ratio) + ')' });
    simulation.force('y', d3.forceY().strength(0.03).y(function (d) {
      return ratio * values.indexOf(d[field]) + ratio;
    }));
    simulation.alpha(1).restart();
  }

  $('#bubble-charge').on('input', function () {
    let v = -parseFloat(this.value);
    simulation.force('charge', d3.forceManyBody().strength(d => v));
    simulation.alpha(1).restart();
    session.style.widgets['bubble-charge'] = -v;
  });

  $('#bubble-size').on('input', function () {
    let v = parseFloat(this.value);
    svg.selectAll('circle').attr('r', v);
    session.style.widgets['bubble-size'] = v;
  });

  function updateNodeColors() {
    let field = session.style.widgets['node-color-variable'];
    let bubble = svg.selectAll('circle').data(vnodes);
    bubble.attr('stroke', d => d.selected ? session.style.widgets['selected-color'] : '#ffffff');
    if (field == 'None') {
      let color = session.style.widgets['node-color'];
      bubble.transition().attr('fill', color);
    } else {
      bubble.transition().attr('fill', d => temp.style.nodeColorMap(d[field]));
    }
  }

  $('#bubble-toggle-settings').click(function () {
    let pane = $('#bubble-settings-pane');
    if ($(this).hasClass('active')) {
      pane.animate({ left: '-400px' }, function () { pane.hide(); });
    } else {
      pane.show(0, function () { pane.animate({ left: '0px' }); });
    }
  });

  $('#bubbles-export-filetype').on('change', function () {
    if (this.value == 'svg') {
      $('#bubbles-export-advanced-button').slideUp();
      if ($('#bubbles-export-advanced').hasClass("show")) $('#bubbles-export-advanced-button').click();
    } else {
      $('#bubbles-export-advanced-button').slideDown();
    }
  });

  $('#bubbles-export-scale').on('input', function () {
    let scale = parseFloat(this.value);
    let wrapper = $('#bubbles').parent();
    $('#bubbles-export-dimensions').text(
      Math.round(wrapper.width() * scale) + 'x' +
      Math.round(wrapper.height() * scale) + 'px'
    );
  }).trigger('input');

  $('#bubbles-export').on('click', function () {
    let bubbles = document.getElementById('bubbles');
    let $bubbles = $(bubbles);
    let watermark = d3.select(bubbles).append('image')
      .attr('xlink:href', MT2.watermark)
      .attr('height', 128)
      .attr('width', 128)
      .attr('x', 10)
      .style('opacity', $('#bubbles-export-opacity').val());
    let filename = $('#bubbles-export-filename').val(),
      filetype = $('#bubbles-export-filetype').val();
    if (filetype == 'svg') {
      let content = MT2.unparseSVG(bubbles);
      let blob = new Blob([content], { type: 'image/svg+xml;charset=utf-8' });
      saveAs(blob, filename + '.' + filetype);
      watermark.remove();
    } else {
      saveSvgAsPng(bubbles, filename + '.' + filetype, {
        scale: parseFloat($('#bubbles-export-scale').val()),
        backgroundColor: session.style.widgets['background-color'],
        encoderType: 'image/' + filetype,
        encoderOptions: parseFloat($('#bubbles-export-quality').val())
      }).then(() => watermark.remove());
    }
  });

  layout.on('stateChanged', function () {
    let wrapper = $('#bubbles').parent();
    $('#bubbles-export-width').val(wrapper.width());
    $('#bubbles-export-height').val(wrapper.height());
    reset();
  });

  $window
    .on('node-color-change selected-color-change', updateNodeColors)
    .on('link-visibility node-visibility node-selected background-color-change', reset);
})();
