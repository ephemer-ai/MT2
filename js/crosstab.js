(function () {
  var data = [];

  function updateTable() {
    if(!$('#crosstab').length) return;
    var dataset = $('[name="crosstab-dataset"]:checked').data('value');
    var xVar = $('#crosstab-field-x').val();
    var yVar = $('#crosstab-field-y').val();
    var xValues = [], yValues = [];
    var rawdata = MT[
      "getVisible" + dataset[0].toUpperCase() + dataset.slice(1)
    ]();
    var n = rawdata.length;
    rawdata.forEach(row => {
      var val = row[xVar];
      if (!xValues.includes(val)) xValues.push(val);
      val = row[yVar];
      if (!yValues.includes(val)) yValues.push(val);
    });
    data = [];
    rawdata.forEach(row => {
      var match = data.find(arow => arow.col == row[yVar]);
      if (match) {
        match[row[xVar]]++;
      } else {
        var newRow = { col: row[yVar] };
        xValues.forEach(col => newRow[col] = 0);
        newRow[row[xVar]]++;
        data.push(newRow);
      }
    });
    let sValues = xValues.map(String);
    var crosstab = new Tabulator("#crosstab", {
      layout: "fitColumns",
      data: data,
      columns: [{ title: "", field: "col", cssClass: 'font-weight-bold' }].concat(sValues.map(x => ({ title: MT2.titleize(x + ''), field: x })))
    });
  }

  $("#crosstab-settings-toggle").click(function () {
    var pane = $("#crosstab-settings-pane");
    if ($(this).hasClass('active')) {
      pane.animate({ left: "-400px" }, function () {
        pane.hide();
      });
    } else {
      pane.show(0, function () {
        pane.animate({ left: "0px" });
      });
    }
  }).trigger('click');

  $('[name="crosstab-dataset"]').on('change', function () {
    var dataset = $('[name="crosstab-dataset"]:checked').data('value');
    var options = session.data[dataset.slice(0, -1) + 'Fields'].map(f => '<option value="' + f + '">' + MT2.titleize(f) + '</option>');
    $('#crosstab-field-x, #crosstab-field-y').html(options);
  }).trigger('change');

  $('#crosstab-field-x, #crosstab-field-y').on('change', updateTable);

  $("#crosstab-export").click(function () {
    var format = $("#export-crosstab-file-type").val();
    var name = $("#export-crosstab-file-name").val();
    if (format == "csv") {
      saveAs(new Blob([Papa.unparse(data)], { type: "text/csv;charset=utf-8" }), name + "." + format);
    } else if (format == "xlsx") {
      var wb = XLSX.utils.book_new();
      var ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws,
        MT2.titleize($('#crosstab-field-x').val()) + " by " + MT2.titleize($('#crosstab-field-y').val()));
      XLSX.writeFile(wb, name + "." + format);
    } else if (format == "pdf") {
      var keys = Object.keys(data[0]);
      pdfMake
        .createPdf({
          content: [
            {
              image: MT2.watermark
            },
            {
              text: "Cluster crosstab Snapshot",
              style: "header",
              alignment: "center"
            },
            {
              style: "paddedTable",
              table: {
                headerRows: 1,
                widths: keys.map(k => "*"),
                body: [
                  keys.map(MT2.titleize)
                ].concat(data.map(Object.values))
              }
            }
          ],
          footer: function (currentPage, pageCount) {
            return [
              {
                text: `Page ${currentPage.toString()} of ${pageCount}`,
                alignment: "center"
              }
            ];
          },
          styles: {
            header: {
              fontSize: 22,
              bold: true
            },
            paddedTable: {
              margin: [10, 10, 10, 10]
            }
          }
        })
        .download(name + ".pdf");
    } else {
      var blob = new Blob([JSON.stringify(data)], {
        type: "application/json;charset=utf-8"
      });
      saveAs(blob, name + "." + format);
    }
  });

  $('#crosstab-pivot').on('click', function () {
    var x = $('#crosstab-field-x').val();
    var y = $('#crosstab-field-y').val();
    $('#crosstab-field-x').val(y);
    $('#crosstab-field-y').val(x);
    updateTable();
  });

  $('#crosstab').parent().css({
    'overflow-y': 'hidden !important',
    'z-index': 1000
  });

  $window
    .on("link-visibility", updateTable)
    .on("node-visibility", updateTable);
})();
