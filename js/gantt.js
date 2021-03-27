(function () {
  let bars = [];
  let margin = {
    top: 40,
    right: 20,
    bottom: 0,
    left: 80
  };
  let svg = d3.select('#gantt').append("svg");
  let x, y, height = 600, width = 800, rect;
  let tickFormat = d3.timeFormat("%Y-%m-%d");
  let clickCount = 0;

  // issue: #124
  const element = document.createElement('canvas');
  let context = element.getContext("2d");
  context.font = "1rem" + window.getComputedStyle(document.body).fontFamily;
  let measureText = 0;
  session.data.nodes.filter(d => d.visible).forEach(d => {
    d.id = d.id === undefined ? d._id : d.id;
    if(d.id && isNaN(d.id)) {
      const _measureText = context.measureText(d.id.trim()).width;
      _measureText > measureText && (measureText = Math.ceil(_measureText) )
    } else {
      measureText = 25;
    }
  });
  margin.left = measureText + 5;

  svg.append("g")
    .attr("class", "gantt-chart")
    .attr("width", width)
    .attr("height", height)
    .attr("transform", "translate(" + margin.left + ", " + margin.top + ")");

  svg.append("g").attr("class", "x-axis");

  svg.append("g")
    .attr("class", "y-axis")
    .attr("transform", "translate(" + margin.left + ", " + margin.top + ")");

  let mouseG = svg.append("g").attr("class", "mouse-over-effects")

  let mouseLine = mouseG.append("path")
    .attr("class", "mouse-line")
    .style("stroke", "black")
    .style("stroke-width", "1px")
    .style("opacity", "0");

  let timestamp = mouseG.append('text').attr('y', margin.top).attr('text-anchor', 'middle');

  let mousebox = mouseG.append('rect')
    .attr('fill', 'none')
    .attr('pointer-events', 'all')
    .on('mouseout', function () {
      mouseLine.style("opacity", "0");
      timestamp.style("opacity", "0");
    })
    .on('mouseover', function () {
      mouseLine.style("opacity", "1");
      timestamp.style("opacity", "1");
    });

  function refresh() {
    let wrapper = $('#gantt').parent().css('z-index', 1000);
    if (!wrapper.length) return;
    height = wrapper.height() - margin.top - margin.bottom - 5;
    width = wrapper.width() - margin.left - margin.right - 5;

    bars = [];

    svg.attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);

    $('.date-table-row').each((i, el) => {
      let $el = $(el);
      let dateid = $el.data('dateid');
      let startField = $el.find(`#date-${dateid}-start`).val();
      let endField = $el.find(`#date-${dateid}-end`).val();
      if (endField == 'None') endField = startField;
      session.data.nodes.filter(d => d.visible).forEach(d => {
        d.id = d.id === undefined ? d._id : d.id;
        let startDate, endDate;
        if (typeof d[startField] == 'number') {
          startDate = moment((d[startField] - 25567) * 24 * 60 * 60 * 1000);
        } else {
          startDate = moment(d[startField]);
        }
        if (typeof d[endField] == 'number') {
          endDate = moment((d[endField] - 25567) * 24 * 60 * 60 * 1000);
        } else {
          endDate = moment(d[endField]);
        }
        if (startDate.isValid() || endDate.isValid()) {
          bars.push({
            "startDate": startDate.isValid() ? startDate.toDate() : endDate.toDate(),
            "endDate": endDate.isValid() ? endDate.toDate() : startDate.toDate(),
            "barID": `${d.id}-${dateid}`,
            "barClass": `date-${dateid}`,
            "row": d.id
          });
        }
      });
    });

    if (bars.length == 0) return;

    bars.sort((a, b) => b.endDate - a.endDate);
    let timeDomainEnd = bars[0].endDate;

    bars.sort((a, b) => a.startDate - b.startDate);
    let timeDomainStart = bars[0].startDate;

    x = d3.scaleTime()
      .domain([timeDomainStart, timeDomainEnd])
      .range([0, width])
      .clamp(true);

    y = d3.scaleBand()
      .domain(Array.from(new Set(bars.map(t => t.row))))
      .range([0, height - margin.top - margin.bottom])
      .padding(0.1);

    svg.select('.x-axis')
      .transition()
      .attr("transform", "translate(" + margin.left + ", " + height + ")")
      .call(d3.axisBottom()
        .scale(x)
        .tickFormat(tickFormat)
        .tickSize(8)
        .tickPadding(8));

    svg.select('.y-axis')
      .transition()
      .call(d3.axisLeft()
        .scale(y)
        .tickSize(0));

    rect = svg.select(".gantt-chart").selectAll("rect").data(bars, d => d.barID);

    rect.exit().remove();

    rect.enter().append("rect")
      .attr("rx", 5)
      .attr("ry", 5)
      .attr('fill-opacity', .6)
      .attr("class", d => d.barClass)
      .transition()
      .attr("y", 0)
      .attr("transform", d => "translate(" + x(d.startDate) + "," + y(d.row) + ")")
      .attr("height", d => y.bandwidth())
      .attr("width", d => {
        return Math.max(x(d.endDate) - x(d.startDate), 5);
      });

    rect = rect.merge(rect)
      .transition()
      .attr("transform", d => "translate(" + x(d.startDate) + "," + y(d.row) + ")")
      .attr("height", d => y.bandwidth())
      .attr("width", d => Math.max(x(d.endDate) - x(d.startDate), 5));

    mousebox
      .attr('width', width)
      .attr('height', height - margin.top - margin.bottom)
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
      .on('mousemove', function () {
        let xc = d3.mouse(this)[0] + margin.left;
        let h = height - margin.bottom;
        mouseLine.attr("d", function () {
          return "M" + xc + "," + h + " " + xc + "," + margin.top;
        });
        timestamp.attr('x', Math.min(Math.max(xc, 125), width)).text(tickFormat(x.invert(xc - margin.left)));
      });

    setBackground();
  }

  $('#addDate').click(function () {
    clickCount++;
    let root = $(`<div class="form-group date-table-row" data-dateid='${clickCount}'></div>`);
    $('<a href="#"><span class="oi oi-circle-x"></span></a>').css({
      position: 'relative',
      top: '2px',
      left: '2px'
    }).click(function (e) {
      root.slideUp(function () {
        root.remove();
        refresh();
      });
    }).appendTo(root);
    let options = '<option>None</option>' + session.data.nodeFields.map(function (h) { return '<option value="' + h + '">' + MT2.titleize(h) + '</option>'; }).join('\n');
    root.append(`
    <div class="row">
      <div class='col-3 offset-1'><label for="date-${clickCount}-start">Start</label></div>
      <div class='col-8'><select id="date-${clickCount}-start" data-dateid="${clickCount}" class="form-control form-control-sm">${options}</select></div>
    </div>
    <div class="row">
      <div class='col-3 offset-1'><label for="date-${clickCount}-end">End</label></div>
      <div class='col-8'><select id="date-${clickCount}-end" data-dateid="${clickCount}" class="form-control form-control-sm">${options}</select></div>
    </div>
    <div class="row">
      <div class='col-3 offset-1'><label for="date-${clickCount}-color">Color</label></div>
      <div class='col-8'><input id="date-${clickCount}-color" data-dateid="${clickCount}" class="form-control form-control-sm" type="color"></div>
    </div>
    <div class="row">
      <div class='col-3 offset-1'><label for="date-${clickCount}-transparency">Transparency</label></div>
      <div class='col-8'><input id="date-${clickCount}-transparency" data-dateid="${clickCount}" type="range" class="form-range" min="0" max="1" step="0.01" value="0.5"></div>
    </div>
  </div>`);
    root.appendTo('#ganttConfigurations');
    $('#date-' + clickCount + '-start, #date-' + clickCount + '-end').on('change', refresh);
    $('#date-' + clickCount + '-color').on('change', function (e) {
      svg.selectAll('.date-' + $(this).data('dateid')).attr('fill', e.target.value);
    });
    $('#date-' + clickCount + '-transparency').on('change', function (e) {
      svg.selectAll('.date-' + $(this).data('dateid')).attr('fill-opacity', 1 - e.target.value);
    });
  });

  $('#toggle-gantt-settings').click(function () {
    let pane = $('#gantt-settings-pane');
    if ($(this).hasClass('active')) {
      pane.animate({ left: '-400px' }, function () { pane.hide(); });
    } else {
      pane.show(0, function () { pane.animate({ left: '0px' }); });
    }
  });

  $('#gantt-export-filetype').on('change', function (e) {
    if (e.target.value == 'svg') {
      $('#gantt-export-advanced-button').slideUp();
      if ($('#gantt-export-advanced').hasClass("show")) $('#gantt-export-advanced-button').click();
    } else {
      $('#gantt-export-advanced-button').slideDown();
    }
  });

  $('#gantt-export-scale').on('input', function (e) {
    let scale = parseFloat(e.target.value);
    let wrapper = $('#gantt').parent();
    $('#gantt-export-dimensions').text(
      Math.round(wrapper.width() * scale) + 'x' +
      Math.round(wrapper.height() * scale) + 'px'
    );
  }).trigger('input');

  $('#gantt-export').on('click', function () {
    let $gantt = $('#gantt svg');
    let gantt = $gantt.get(0);
    let watermark = d3.select(gantt).append('image')
      .attr('xlink:href', MT2.watermark)
      .attr('height', 128)
      .attr('width', 128)
      .attr('x', 900)
      .style('opacity', $('#gantt-export-opacity').val());
    let filename = $('#gantt-export-filename').val(),
      filetype = $('#gantt-export-filetype').val();
    if (filetype == 'svg') {
      let content = MT2.unparseSVG(gantt);
      let blob = new Blob([content], { type: 'image/svg+xml;charset=utf-8' });
      saveAs(blob, filename + '.' + filetype);
      watermark.remove();
    } else {
      saveSvgAsPng(gantt, filename + '.' + filetype, {
        scale: parseFloat($('#gantt-export-scale').val()),
        backgroundColor: session.style.widgets['background-color'],
        encoderType: 'image/' + filetype,
        encoderOptions: parseFloat($('#gantt-export-quality').val())
      }).then(() => watermark.remove());
    }
  });

  function setBackground() {
    let col = session.style.widgets['background-color'];
    $('#gantt').css('background', col);

    let contrast = session.style.widgets['background-color-contrast'];
    $('#gantt .x-axis, .y-axis').css('color', contrast);
  }

  $window.on('background-color-change', setBackground);

  layout.on('stateChanged', function () {
    refresh();
    let wrapper = $('#gantt').parent();
    $('#gantt-export-width').val(wrapper.width());
    $('#gantt-export-height').val(wrapper.height());
  });

  setTimeout(function () {
    refresh();
    setBackground();
  }, 80);
})();
