(function() {
  let data = [];

  function updateTable(i, variable) {
    let aggregation = new Tabulator("#aggregation-table-" + i, {
      layout: "fitColumns"
    });
    let values = [];
    let tabledata = [];
    let dataset = variable.split(" ")[0];
    let column = variable
      .split(" ")
      .slice(1)
      .join(" ");
    let rawdata = MT[
      "getVisible" + dataset[0].toUpperCase() + dataset.slice(1) + "s"
    ]();
    let n = rawdata.length;
    rawdata.forEach(row => {
      let val = row[column];
      if (val === null) val = '_Unknown';
      if (values.includes(val)) {
        tabledata[values.indexOf(val)].n++;
      } else {
        values.push(val);
        let newRow = {};
        newRow[column] = val;
        newRow.n = 1;
        tabledata.push(newRow);
      }
    });
    tabledata.forEach(
      row => (row.percent = ((row.n / n) * 100).toLocaleString() + "%")
    );
    aggregation.setColumns([
      {
        title: MT2.titleize(dataset) + " " + MT2.titleize(column),
        field: column
      },
      { title: `Number of ${MT2.titleize(dataset)}s`, field: "n" },
      { title: "Percentage", field: "percent", headerSort: false }
    ]);
    aggregation.setData(tabledata);
    aggregation.setSort([
      { column: "n", dir: "desc" },
      { column: column, dir: "asc" }
    ]);
    data[i - 1] = {
      dataset: dataset,
      column: column,
      data: tabledata
    };
  }

  function updateTables() {
    let variables = $("#aggregation-variables li select");
    variables.each(function(i) {
      updateTable(i + 1, this.value);
    });
    if (variables.length < $(".aggregation-tables").length) {
      $(".aggregation-tables").each(function(i) {
        if (i > variables.length) {
          $(this).slideUp(() => $(this).remove());
        }
      });
    }
  }

  $("#aggregation-settings-toggle").click(function() {
    let pane = $("#aggregation-settings-pane");
    if ($(this).hasClass('active')) {
      pane.animate({ left: "-400px" }, function() {
        pane.hide();
      });
    } else {
      pane.show(0, function() {
        pane.animate({ left: "0px" });
      });
    }
  });

  $("#aggregation-add-variable")
    .on("click", function() {
      let i = $("#aggregation-variables li").length + 1;
      $("#aggregation-variables").append(`
          <li class='d-inline-flex aggregation-items'>
            <span class="oi oi-x pt-2 aggregation-remove"></span>
            <select class='flex-grow-1 form-control form-control-sm aggregation-variable' data-i="${i}">
              ${session.data.nodeFields
                .map(
                  v =>
                    `<option value="node ${v}" ${
                      v == "cluster" ? "selected" : ""
                    }>Node ${MT2.titleize(v)}</option>`
                )
                .join("\n")}
              ${session.data.linkFields
                .map(
                  v =>
                    `<option value="link ${v}">Link ${MT2.titleize(
                      v
                    )}</option>`
                )
                .join("\n")}
              ${session.data.clusterFields
                .map(
                  v =>
                    `<option value="cluster ${v}">Cluster ${MT2.titleize(
                      v
                    )}</option>`
                )
                .join("\n")}
            </select>
            <span class="pt-2 oi oi-elevator"></span>
          </li>`);

      $("#aggregation").append(
        `<div class="aggregation-tables table-sm" id="aggregation-table-${i}"></div>`
      );

      sortable("#aggregation-variables")[0].addEventListener(
        "sortupdate",
        updateTables
      );

      $(".aggregation-selector").on("change", updateTables);

      $(".aggregation-remove").on("click", function() {
        $(this)
          .parent()
          .slideUp(function() {
            $(this).remove();
            updateTables();
          });
      });

      $(".aggregation-variable").on("change", function() {
        updateTable($(this).data("i"), this.value);
      });

      updateTable(i, "node cluster");
    })
    .trigger("click");

  $("#aggregation-export").click(function() {
    let format = $("#export-aggregation-file-type").val();
    let name = $("#export-aggregation-file-name").val();
    if (format == "csv.zip") {
      var zip = new JSZip();
      data.forEach(t => {
        zip.file(t.dataset + "_" + t.column + ".csv", Papa.unparse(t.data));
      });
      zip
        .generateAsync({ type: "blob" })
        .then(content => saveAs(content, name + ".zip"));
    } else if (format == "xlsx") {
      let wb = XLSX.utils.book_new();
      data.forEach(t => {
        let ws = XLSX.utils.json_to_sheet(t.data);
        XLSX.utils.book_append_sheet(
          wb,
          ws,
          MT2.titleize(t.dataset) + " " + MT2.titleize(t.column)
        );
      });
      XLSX.writeFile(wb, name + "." + format);
    } else if (format == "pdf") {
      pdfMake
        .createPdf({
          content: [
            {
              image: MT2.watermark
            },
            {
              text: "Cluster Aggregation Snapshot",
              style: "header",
              alignment: "center"
            },
            ...data.map(t => ({
              style: "paddedTable",
              table: {
                headerRows: 1,
                widths: ["*", "*", "*"],
                body: [
                  [
                    MT2.titleize(t.dataset) + " " + MT2.titleize(t.column),
                    `Number of ${MT2.titleize(t.dataset)}s`,
                    "Percentage"
                  ]
                ].concat(t.data.map(Object.values))
              }
            }))
          ],
          footer: function(currentPage, pageCount) {
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
      let blob = new Blob([JSON.stringify(data)], {
        type: "application/json;charset=utf-8"
      });
      saveAs(blob, name + "." + format);
    }
  });

  $("#aggregation")
    .parent()
    .css("overflow-y", "scroll")
    .css("z-index", 1000);

  $window
    .on("link-visibility", updateTables)
    .on("node-visibility", updateTables);
})();
