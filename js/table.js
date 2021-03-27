(function(){
  let table, meta = ['selected', 'visible', 'nn'];

  function updateColumns(){
    if(!$('#table').length) return;
    let type = $('input[name=table-dataset]:checked').data('value').slice(0,-1);
    $('#table-columns')
      .chosen('destroy')
      .html(
        session.data[type+'Fields'].map((d, i) => {
          if(meta.includes(d)) return;
          return `<option value="${d}"${(i < 7) ? " selected" : ""}>${MT2.titleize(d)}</option>`
        }).join('\n')
      )
      .chosen({'width': 'auto'})
      .on('change', updateTable);
  }

  function updateTable(){
    if(!$('#table').length) return;
    let data_type = $('input[name=table-dataset]:checked').data('value');
    let columns = $('#table-columns').val();
    table = new Tabulator("#table", {
      //height: "calc(100% - 60px) !important",
      maxHeight: "100%",
      layout: "fitColumns",
      columns: columns.map(c => ({title: MT2.titleize(c), field: c})),
      rowClick: function(e, row){
        let entity = row.getData();
        entity.selected = !entity.selected;
        if(entity.selected){
          $(row.getElement()).css("background", session.style.widgets['selected-color']);
          row.freeze();
        } else {
          $(row.getElement()).css("background", "");
          row.unfreeze();
        }
        $window.trigger('node-selected', 'table');
      },
      rowFormatter: function(row){
        if(row.getData().selected){
          $(row.getElement()).css("background", session.style.widgets['selected-color']);
        }
      },
      dataLoaded: function(data) {
        var rows = this.getRows();
        rows.forEach(function(row){
          let entity = row.getData();
          if (entity.selected) {
            row.freeze();
          }
        });
      }
    });
    table.setData(session.data[data_type]);
    addColDelTarget();
    resetTextsize();
  }

  function updateData(){
    let type = $('input[name=table-dataset]:checked').data('value');
    table.replaceData(session.data[type]);
  }

  $('#table-settings-toggle').click(function(){
    let pane = $('#table-settings-pane');
    if($(this).hasClass('active')){
      pane.animate({left: '-400px'}, function(){ pane.hide(); });
    } else {
      pane.show(0, function(){ pane.animate({left: '0px'}); });
    }
  });

  function resetTextsize(){
    let s = $('#table-font-size').val();
    $('#table').css({
      'font-size': s + 'px',
      'line-height': s/10
    });
  }

  function addColDelTarget () {
    $('.search-choice-close').each(function(i, obj) {
      obj.innerHTML = '&#x232B';
      obj.style.fontSize = 'x-small';
      obj.title = 'Remove column';
    });
  }

  $('input[name=table-dataset]').on('change', e => {
    updateColumns();
    updateTable();
  });

  $('#table-columns').on('change', updateTable);

  $('#table-font-size').on('input', resetTextsize);

  $('#table-export').click(function(){
    let format = $('#export-table-file-type').val();
    let data = JSON.parse(JSON.stringify(session.data[$('input[name=table-dataset]:checked').data('value')]));
    let name = $('#export-table-file-name').val();
    if(format == 'csv'){
      let blob = new Blob([Papa.unparse(data)], {type: 'text/csv;charset=utf-8'});
      saveAs(blob, name + '.' + format);
    } else if(format == 'xlsx'){
      let headers = session.data[$('input[name=table-dataset]:checked').data('value').slice(0,-1) + 'Fields'];
      data.forEach(thing => {
        Object.keys(thing).forEach(field => {
          if(!headers.includes(field)){
            delete thing[field];
          } else if(Array.isArray(thing[field])){
            thing[field] = thing[field].join('; ');
          }
        });
      });
      let wb = XLSX.utils.book_new();
      let ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, name);
      XLSX.writeFile(wb, name + '.' + format);
    } else {
      let blob = new Blob([JSON.stringify(data)], {type: 'application/json;charset=utf-8'});
      saveAs(blob, name + '.' + format);
    }
  });

  $('#table').parent().css('z-index', 1000);

  $window
    .on('link-visibility', updateTable)
    // .on('node-selected', updateData)
    .on('node-selected', function(event, view) {
      if (view != 'table') {
        updateTable();
      } 
    })
    .on('selected-color-change', updateTable);

  updateColumns();
  updateTable();
})();