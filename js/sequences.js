(function () {
  let canvas, context, width, height;
  let av = $('#sequences-panel');

  function update() {
    if(!$('#sequences-panel').length) return;
    alignmentViewer(session.data.nodes.filter(d => d.seq).map((node) => {!!!node.id && (node.id = node._id); return node;}), {
      width: 0 | $('#avwidth').val(),
      height: 0 | $('#avheight').val(),
      showChar: $('#showChar').is(':checked')
    }).then(function (c) {
      av.append(c);
      canvas = d3.select('#sequences-panel canvas');
      context = canvas.node().getContext('2d');
      let rect = canvas.node().getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      d3.select('#sequences-panel').call(d3.zoom().scaleExtent([0.1, 8]).on('zoom', function (e) {
        var t = e.transform;
        canvas.style('transform', 'translate(' + Math.round(t.x - width / 2) + 'px,' + Math.round(t.y - height / 2) + 'px) scale(' + t.k + ',' + t.k + ')');
      }));
      av.trigger('zoom');
    });
  }

  av.on('mouseup', function () {
    console.log('up');
    av.css('cursor', 'grab');
  });
  av.on('mousedown', function () {
    av.css('cursor', 'grabbing');
  });

  $('#avheight, #avwidth').on('input', function () {
    av.empty();
    update();
  });

  $("input[type='radio'][name='showChars']").on('change', function () {
    av.empty();
    update();
  });

  $('#sequences-export').on('click', function () {
    let type = $('#export-sequences-file-type').val();
    if (type == 'fasta') {
      let blob = new Blob([
        session.data.nodes
          .filter(d => d.seq)
          .map(node => ">" + node._id + "\r\n" + node.seq).join("\r\n")
      ]);
      saveAs(blob, $('#export-sequences-file-name').val() + '.fasta');
    } else if (type == 'mega') {
      let blob = new Blob([
        session.data.nodes
          .filter(d => d.seq)
          .map(node => "#" + node._id + "\r\n" + node.seq).join("\r\n")
      ]);
      saveAs(blob, $('#export-sequences-file-name').val() + '.mega');
    } else if (type == 'png') {
      $('#sequences-panel canvas').get(0).toBlob(function (blob) {
        saveAs(blob, $('#export-sequences-file-name').val() + '.png');
      });
    }
  });

  $('#toggle-sequences-settings').on('click', function () {
    let pane = $('#sequences-settings-pane');
    if ($(this).hasClass('active')) {
      pane.animate({ left: '-400px' }, function () { pane.hide(); });
    } else {
      pane.show(0, function () { pane.animate({ left: '0px' }); });
    }
  });

  function setBackground() {
    let col = session.style.widgets['background-color'];
    $('#sequences-panel').css('background', col);
  }

  $window.on('background-color-change', setBackground);

  update();
  setBackground();
})();