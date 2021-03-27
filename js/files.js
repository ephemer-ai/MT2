(function () {
  'use strict';

  $('#file-panel').parent().css('z-index', 1000);

  $('#file-settings-toggle').on('click', function () {
    if ($(this).hasClass('active')) {
      document.querySelector('#file-settings-pane').classList.remove('d-none');
      MT2.animate('#file-settings-pane', 'slideInLeft');
    } else {
      MT2.animate('#file-settings-pane', 'slideOutLeft').then(e => {
        document.querySelector('#file-settings-pane').classList.add('d-none');
      })
    }
  });

  if (session.files.length > 0) {
    $('#file-prompt, #warning-prompt').remove();
    session.files.forEach(addToTable);
  }

  $('#data-files').on('change', function () {
    processFiles(this.files);
  });

  $('#file-panel').on('dragover', evt => {
    evt.stopPropagation();
    evt.preventDefault();
    evt.originalEvent.dataTransfer.dropEffect = 'copy';
  }).on('drop', evt => {
    evt.stopPropagation();
    evt.preventDefault();
    processFiles(evt.originalEvent.dataTransfer.files);
  });

  function processFiles(files){
    const n = files.length;
    $('#file-prompt, #warning-prompt').remove();
    for (let i = 0; i < n; i++) processFile(files[i]);
    $('#launch').prop('disabled', false).trigger("focus");
  }

  function processFile(rawfile) {
    const extension = rawfile.name.split('.').pop().toLowerCase();
    if (extension == 'zip') {
      let new_zip = new JSZip();
      new_zip
        .loadAsync(rawfile)
        .then(zip => {
          zip.forEach((relativePath, zipEntry) => {
            zipEntry.async("string").then(c => {
              MT2.processJSON(c, zipEntry.name.split('.').pop())
            });
          });
        });
      return;
    }
    if (extension == 'MT2' || extension == 'hivtrace') {
      let reader = new FileReader();
      reader.onloadend = out => MT2.processJSON(out.target.result, extension);
      reader.readAsText(rawfile, 'UTF-8');
      return;
    }
    if (extension == 'svg') {
      let reader = new FileReader();
      reader.onloadend = out => MT2.processSVG(out.target.result);
      reader.readAsText(rawfile, 'UTF-8');
      return;
    }
    fileto.promise(rawfile, (extension == 'xlsx' || extension == 'xls') ? 'ArrayBuffer' : 'Text').then(file => {
      file.name = filterXSS(file.name);
      file.extension = file.name.split('.').pop().toLowerCase();
      session.files.push(file);
      addToTable(file);
    });
  }

  function addToTable(file) {
    const extension = file.extension ? file.extension : filterXSS(file.name).split('.').pop().toLowerCase();
    const format = file.format ||
      ('fasta'  == extension.includes('fas')                                ) ? 'fasta'  :
      (file.name.toLowerCase().includes('node')                             ) ? 'node'   :
      ('newick' == extension.includes('nwk') || extension.includes('newick')) ? 'newick' :
      ('link'                                                               );
    file.format = format;
    file.fields = {};

    if(extension == 'xlsx' || extension == 'xls'){
      let workbook = XLSX.read(file.contents, { type: 'array' });
      let data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {raw: false, dateNF: 'yyyy-mm-dd'});
      let headers = [];
      data.forEach(row => {
        Object.keys(row).forEach(key => {
          const safeKey = filterXSS(key);
          if (!headers.includes(safeKey)) headers.push(safeKey);
        });
      });
      addTableTile(headers);
    } else {
      Papa.parse(file.contents, {
        delimiter: ",",
        header: true,
        preview: 1,
        complete: output => addTableTile(output.meta.fields.map(filterXSS))
      });
    }

    function addTableTile(headers) {
      let options = '<option>None</option>' + headers.map(h => `<option value="${h}">${MT2.titleize(h)}</option>`).join('\n');
      const sansDots = file.name.replace(/\./,'');
      let template = $(`
      <div class="file-table-row animate__animated animate__slideInDown" id="file-${sansDots}">
        <div class="d-flex justify-content-between">
          <div class="file-name">
            <a href="#" class="align-middle p-1" id="file-${sansDots}-remove" title="Remove this file">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x" viewBox="0 0 16 16">
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
              </svg>
            </a>
            <a href="#" class="align-middle p-1" id="file-${sansDots}-save" title="Resave this file">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-download" viewBox="0 0 16 16">
                <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
              </svg>
            </a>
            <span class="p-1">${file.name}</span>
          </div>
          <div class="file-format">
            <select class="form-select form-select-sm" id="file-${sansDots}-type" aria-label="File type selector for ${sansDots}">
              <option value="node"${(format == 'node') ? " selected" : ""}>Node</option>
              <option value="link"${(format == 'link') ? " selected" : ""}>Link</option>
              <option value="fasta"${(format == 'fasta') ? " selected" : ""}>FASTA</option>
              <option value="newick"${(format == 'newick') ? " selected" : ""}>Newick</option>
              <option value="matrix"${(format == 'matrix') ? " selected" : ""}>Distance Matrix</option>
            </select>
          </div>
        </div>
        <div class="row${(format == 'link' ? "" : " d-none")}" id="file-${sansDots}-link-row">
          <div class="col-4">
            <label for="file-${sansDots}-field-source">Source</label>
            <select id="file-${sansDots}-field-source" class="form-select form-select-sm">${options}</select>
          </div>
          <div class="col-4">
            <label for="file-${sansDots}-field-target">Target</label>
            <select id="file-${sansDots}-field-target" class="form-select form-select-sm">${options}</select>
          </div>
          <div class="col-4">
            <label for="file-${sansDots}-field-distance">Distance</label>
            <select id="file-${sansDots}-field-distance" class="form-select form-select-sm">${options}</select>
          </div>
        </div>
        <div class="row${(format == 'node' ? "" : " d-none")}" id="file-${sansDots}-node-row">
          <div class="col-4">
            <label for="file-${sansDots}-field-id">ID</label>
            <select id="file-${sansDots}-field-id" class="form-select form-select-sm">${options}</select>
          </div>
          <div class="col-4">
            <label for="file-${sansDots}-field-sequence">Sequence</label>
            <select id="file-${sansDots}-field-sequence" class="form-select form-select-sm">${options}</select>
          </div>
        </div>
      </div>
      `).appendTo("#file-table");

      
      if(!file.fields.source) file.fields.source = headers.find(h => ['source', 'Source', 'SOURCE'].includes(h));
      document.getElementById(`file-${sansDots}-field-source`).value = file.fields.source;
      if(!file.fields.target) file.fields.target = headers.find(h => ['target', 'Target', 'TARGET'].includes(h));
      document.getElementById(`file-${sansDots}-field-target`).value = file.fields.target;
      if(!file.fields.distance) file.fields.distance = headers.find(h => ['length', 'distance', 'tn93', 'snps'].includes(h));
      document.getElementById(`file-${sansDots}-field-distance`).value = file.fields.distance;
      if(!file.fields.id) file.fields.id = headers.find(h => ['id', 'ID'].includes(h));
      document.getElementById(`file-${sansDots}-field-id`).value = file.fields.id;
      if(!file.fields.sequence) file.fields.sequence = headers.find(h => ['seq', 'SEQ', 'sequence', 'Sequence', 'SEQUENCE'].includes(h));
      document.getElementById(`file-${sansDots}-field-sequence`).value = file.fields.sequence;

      document.getElementById(`file-${sansDots}-remove`).addEventListener('click', () => {
        session.files.splice(session.files.findIndex(f => f.name == file.name), 1);
        $(`file-${sansDots}-link-row`).slideUp(function(){ $(this).remove(); });
      });
      document.getElementById(`file-${sansDots}-save`).addEventListener('click', () => {
        saveAs(new Blob([file.contents], { type: 'text' }), file.name);
      });
      document.getElementById(`file-${sansDots}-type`).addEventListener('change', function(){
        let nodeRow = document.querySelector(`#file-${sansDots}-node-row`);
        let linkRow = document.querySelector(`#file-${sansDots}-link-row`);
        if(this.value == "link"){
          nodeRow.classList.add('d-none');
          if(!file.fields.source) file.fields.source = headers.find(h => ['source', 'Source', 'SOURCE'].includes(h));
          document.getElementById(`file-${sansDots}-field-source`).value = file.fields.source;
          if(!file.fields.target) file.fields.target = headers.find(h => ['target', 'Target', 'TARGET'].includes(h));
          document.getElementById(`file-${sansDots}-field-target`).value = file.fields.target;
          if(!file.fields.distance) file.fields.distance = headers.find(h => ['length', 'distance', 'tn93', 'snps'].includes(h));
          document.getElementById(`file-${sansDots}-field-distance`).value = file.fields.distance;
          linkRow.classList.remove('d-none');
        } else if(this.value == "node"){
          linkRow.classList.add('d-none');
          if(!file.fields.id) file.fields.id = headers.find(h => ['id', 'ID'].includes(h));
          document.getElementById(`file-${sansDots}-field-id`).value = file.fields.id;
          if(!file.fields.sequence) file.fields.sequence = headers.find(h => ['seq', 'SEQ', 'sequence', 'Sequence', 'SEQUENCE'].includes(h));
          document.getElementById(`file-${sansDots}-field-sequence`).value = file.fields.sequence;
          nodeRow.classList.remove('d-none');
        } else {
          linkRow.classList.add('d-none');
          nodeRow.classList.add('d-none');
        }
      });
      document.getElementById(`file-${sansDots}-field-source`).addEventListener('change', function(){
        file.fields.source = this.value;
      });
      document.getElementById(`file-${sansDots}-field-target`).addEventListener('change', function(){
        file.fields.target = this.value;
      });
      document.getElementById(`file-${sansDots}-field-distance`).addEventListener('change', function(){
        file.fields.distance = this.value;
      });
      document.getElementById(`file-${sansDots}-field-id`).addEventListener('change', function(){
        file.fields.id = this.value;
      });
      document.getElementById(`file-${sansDots}-field-sequence`).addEventListener('change', function(){
        file.fields.sequence = this.value;
      });
    }
  }

  async function readFastas() {
    const fastas = session.files.filter(f => f.extension.includes('fas'));
    const nodeCSVsWithSeqs = session.files.filter(f => f.format == "node" && f.fields.seq != "None" && f.fields.seq != "");
    let data = [];
    for(let i = 0; i < fastas.length; i++){
      let fasta = fastas[i];
      let nodes = await MT2.parseFASTA(fasta.contents);
      data = data.concat(nodes);
    }
    // TODO: Cannot presently preview sequences in Node CSV/XLSX tables.
    // for(let j = 0; j < nodeCSVsWithSeqs.length; j++){
    //   let csv = nodeCSVsWithSeqs[j];
    //   await MT2.parseNodeCSV(csv.contents).then(nodes => {
    //     data = data.concat(nodes);
    //   });
    // }
    return data;
  }

  async function updatePreview(data) {
    $('#alignment-preview').empty().append('<div class="spinner-border" role="status"><span class="sr-only">Loading...</span></div>');
    if ($('#align-sw').is(':checked')) {
      data = await MT2.align({
        nodes: data,
        reference: session.data.reference,
        match: [parseFloat($('#alignerMatch').val()), -parseFloat($('#alignerMismatch').val())],
        gap: [-parseFloat($('#alignerGapO').val()), -parseFloat($('#alignerGapE').val())]
      })
    }
    alignmentViewer(data, { showID: false })
      .then(canvas => $('#alignment-preview').empty().append(canvas));
  }

  $('.alignConfigRow').hide();

  $('#align-sw').on('change', function(){
    if(this.checked){
      session.style.widgets['align-sw'] = true;
      $('.alignConfigRow, #reference-file-row').slideDown();
      $('#alignment-preview').slideUp(function() {
        $(this).empty().show();
      });  
    } else {
      session.style.widgets['align-sw'] = false;
      $('.alignConfigRow, #reference-file-row').slideUp();
      $('#alignment-preview').slideUp(function () {
        $(this).empty().show();
      });  
    }
  });

  $('#reference-source-file').parent().on('click', () => {
    session.style.widgets['reference-source-file'] = true;
    session.style.widgets['reference-source-first'] = false;
    session.style.widgets['reference-source-consensus'] = false;
    session.data.reference = $('#refSeqID').val();
    if(!session.style.widgets['align-none']) $('#reference-file-row').slideDown();
  });

  $('#reference-source-first').parent().on('click', () => {
    session.style.widgets['reference-source-file'] = false;
    session.style.widgets['reference-source-first'] = true;
    session.style.widgets['reference-source-consensus'] = false;
    $('#reference-file-row').slideUp();
  });

  $('#reference-source-consensus').parent().on('click', () => {
    session.style.widgets['reference-source-file'] = false;
    session.style.widgets['reference-source-first'] = false;
    session.style.widgets['reference-source-consensus'] = true;
    $('#reference-file-row').slideUp();
  });

  $('#reference-file-row').hide();

  $('#refSeqFileLoad').on('change', function () {
    const file = this.files[0];
    let reader = new FileReader();
    reader.onloadend = e => {
      if (e.target.readyState == FileReader.DONE) {
        MT2.parseFASTA(e.target.result).then(nodes => {
          $('#refSeqID')
            .html(nodes.map((d, i) => `
              <option value="${filterXSS(d.seq)}" ${i == 0 ? "selected" : ""}>${filterXSS(d.id)}</option>
            `))
            .trigger('change');
        });
        $('label[for="refSeqFileLoad"]').text(filterXSS(file.name));
      }
    };
    reader.readAsText(file);
  });

  $('#refSeqID').html(`
    <option value="${MT2.HXB2.substr(2000, 2100)}" selected>Pol</option>
    <option value="${MT2.HXB2}">Complete</option>
  `).on('change', function(){ session.data.reference = this.value; });

  // $('#sequenceControlsButton, #alignment-preview').on('click', () => {
  //   readFastas().then(data => {
  //     if(session.style.widgets['reference-source-first']){
  //       session.data.reference = nodes[0].seq;
  //     }
  //     if(session.style.widgets['reference-source-consensus']){
  //       MT2.computeConsensus().then(consensus => session.data.reference = consensus);
  //     }
  //     updatePreview(data);
  //   });
  // });

  let auditBlock = $('#audited-sequences');
  const logAudit = (id, type) => {
    let match = auditBlock.find(`[data-id="${id}"]`);
    let button = $(`<button class="btn btn-warning btn-sm audit-exclude" data-id="${id}">Exclude</button>`).on('click', function(){
      let thi$ = $(this);
      const id = thi$.data('id');
      if(thi$.text() == 'Exclude'){
        session.data.nodeExclusions.push(id);
        thi$.removeClass('btn-warning').addClass('btn-success').text('Include');
      } else {
        session.data.nodeExclusions.splice(session.data.nodeExclusions.indexOf(id), 1);
        thi$.removeClass('btn-success').addClass('btn-warning').text('Exclude');
      }
    });
    let row = $(`<div class="alert alert-warning w-100 d-flex justify-content-between" role="alert"><span>${id} appears to be ${type}.</span></div>`);
    row.append(button);
    auditBlock.append(row);
  };

  $('#audit-launcher').on('click', () => {
    readFastas().then(data => {
      const start = Date.now();
      const isGaps = /^-+$/;
      const isRNA = /^[ACGURYMKWSBDHVN-]+$/;
      const isAA = /^[ARNDCQEGHILKMFPSTWYVBZN]+$/;
      const isDNA = /^[ACGTRYMKWSBDHVN-]+$/;
      const isCIGAR = /^[0-9MIDNSHP=X]+$/;
      const isMalformed = /[^ACGTURYMKWSBDHVNQEILFPZX0-9-]+/;
      const checkEmpty = $('#audit-empty').is(':checked');
      const checkGaps = $('#audit-gaps').is(':checked');
      const checkRNA = $('#audit-RNA').is(':checked');
      const checkAA = $('#audit-amino-acids').is(':checked');
      const checkCIGAR = $('#audit-CIGAR').is(':checked');
      const checkMalformed = $('#audit-malformed').is(':checked');
      let any = false;
      data.forEach(d => {
        const seq = d.seq, id = d.id;
        if(checkEmpty && seq == '') logAudit(id, 'empty');
        if(checkGaps && isGaps.test(seq)) logAudit(id, 'all gaps')
        if(checkRNA && isRNA.test(seq) && !isGaps.test(seq)) logAudit(id, 'RNA');
        if(checkAA && isAA.test(seq) && !isDNA.test(seq)) logAudit(id, 'amino acids');
        if(checkCIGAR && isCIGAR.test(seq)) logAudit(id, 'a CIGAR');
        if(checkMalformed && isMalformed.test(seq)) logAudit(id, 'malformed');
      });
      console.log('Sequence Auditing time:', (Date.now() - start).toLocaleString(), 'ms');
    });
  });

  $('#audit-toggle-all').on('click', () => {
    $('.audit-exclude').trigger('click');
  });

  $('#default-distance-metric').on("change", function () {
    const lsv = this.value;
    localforage.setItem('default-distance-metric', lsv);
    $('#default-distance-metric').val(lsv);
    if (lsv == 'snps') {
      $('#ambiguities-row').slideUp();
      $('#default-distance-threshold, #link-threshold')
        .attr('step', 1)
        .val(16);
      session.style.widgets["link-threshold"] = 16;
    } else {
      $('#ambiguities-row').slideDown();
      $('#default-distance-threshold, #link-threshold')
        .attr('step', 0.001)
        .val(0.015);
      session.style.widgets["link-threshold"] = 0.015;
    }
    session.style.widgets['default-distance-metric'] = lsv;
  });

  $('#default-distance-threshold').on("change", function () {
    session.style.widgets["link-threshold"] = this.value;
  });

  localforage.getItem('default-distance-metric').then(cachedLSV => {
    if (cachedLSV) {
      $('#default-distance-metric').val(cachedLSV).trigger('change');
    }
  });

  $('#ambiguity-resolution-strategy').on('change', function () {
    const v = this.value;
    session.style.widgets['ambiguity-resolution-strategy'] = v;
    if(v == 'HIVTRACE-G'){
      $('#ambiguity-threshold-row').slideDown();
    } else {
      $('#ambiguity-threshold-row').slideUp();
    }
  }).trigger('change');

  $('#ambiguity-threshold').on('change', function(){
    session.style.widgets['ambiguity-threshold'] = this.value;
  });

  localforage.getItem('default-view').then(cachedView => {
    $('#default-view')
      .on('change', function () {
        const v = this.value;
        localforage.setItem('default-view', v);
        session.style.widgets['default-view'] = v;
        session.layout.content[0].type = v;
      })
      .val(cachedView ? cachedView : session.style.widgets['default-view'])
      .trigger('change');
  });

  $('#generate-sequences').on('click', () => {
    $('#file-prompt, #warning-prompt').remove();
    $('#launch').prop('disabled', false).trigger("focus");
    processFile(new File([Papa.unparse(MT2.generateSeqs('gen-' + session.meta.readyTime + '-', parseFloat($('#generate-number').val()), 20))], 'generatedNodes.csv'));
  });

  $('#infer-directionality').on('change', function(){
    session.style.widgets['infer-directionality'] = this.checked;
  });

  $('#triangulate-distances').on('change', function(){
    session.style.widgets['triangulate-distances'] = this.checked;
  });

  $('#autostash').on('change', function(){
    session.style.widgets['autostash'] = this.checked;
  });

  localforage.getItem('autostash').then(autostash => {
    if (autostash == 'true') {
      $('#autostash-yes').parent().trigger('click');
    }
  });

  function message(msg) {
    session.messages.push(msg);
    $('#loading-information').html(session.messages.join('<br>'));
  }

  $('#launch').on('click', () => {
    session.meta.startTime = Date.now();
    $('#launch').prop('disabled', true);
    document.getElementById('loading-information').innerHTML="<p>Processing file(s)...</p>";
    let modalEl = document.getElementById('loading-information-modal');
    let modal = new bootstrap.Modal(modalEl, {
      backdrop: false,
      keyboard: false
    });
    modalEl.addEventListener('show.bs.modal', function (e) {
      session.messages = [];
      $('#loading-information').html('');
    });
    modal.show();
    launch();
  })

  const launch = async () => {
    temp.messageTimeout = setTimeout(() => {
      $('#loadCancelButton').slideDown();
      alertify.warning('If you stare long enough, you can reverse the DNA Molecule\'s spin direction');
    }, 20000);

    const nFiles = session.files.length - 1;
    const check = nFiles > 0;

    const hierarchy = ['newick', 'matrix', 'link', 'node', 'fasta'];
    session.files.sort((a, b) => hierarchy.indexOf(a.format) - hierarchy.indexOf(b.format));

    session.meta.anySequences = session.files.some(file => (file.format == "fasta") || (file.format == "node" && file.fields.seq !== "None"));

    session.files.forEach((file, fileNum) => {
      const start = Date.now();
      const origin = [file.name];

      if (file.format == 'fasta') {

        message(`Parsing ${file.name} as FASTA...`);
        let newNodes = 0;
        MT2.parseFASTA(file.contents).then(seqs => {
          const n = seqs.length;
          for (let i = 0; i < n; i++) {
            let node = seqs[i];
            if (!node) continue;
            newNodes += MT2.addNode({
              _id: filterXSS(node.id),
              seq: filterXSS(node.seq),
              origin: origin
            }, check);
          }
          console.log('FASTA Merge time:', (Date.now() - start).toLocaleString(), 'ms');
          message(` - Parsed ${newNodes} New, ${seqs.length} Total Nodes from FASTA.`);
          if (fileNum == nFiles) processSequences();
        });

      } else if (file.format == 'link') {

        message(`Parsing ${file.name} as Link List...`);
        let l = 0;

        let forEachLink = link => {
          const keys = Object.keys(link);
          const n = keys.length;
          let safeLink = {};
          for (let i = 0; i < n; i++) {
            let key = filterXSS(keys[i]);
            safeLink[key] =  (typeof link[key] === 'string')  ?   filterXSS(link[key]) : link[key];  // #195
            if (!session.data.linkFields.includes(key)) {
              session.data.linkFields.push(key);
            }
          }
          l += MT2.addLink(Object.assign({
            source: '' + safeLink[file.fields.source],
            target: '' + safeLink[file.fields.target],
            origin: origin,
            visible: true,
            distance: file.fields.distance == 'None' ? 0 : parseFloat(safeLink[file.fields.distance])
          }, safeLink), check);
        };

        if (file.extension == 'xls' || file.extension == 'xlsx') {

          let workbook = XLSX.read(file.contents, { type: 'array' });
          let data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {raw: false, dateNF: 'yyyy-mm-dd'});
          data.map(forEachLink);
          message(` - Parsed ${l} New, ${data.length} Total Links from Link Excel Table.`);
          let n = 0, t = 0;
          let nodeIDs = [];
          const k = data.length;
          for (let i = 0; i < k; i++) {
            const l = data[i];
            const f1 = l[file.fields.id];
            if (nodeIDs.indexOf(f1) == -1) {
              t++;
              nodeIDs.push(f1);
              n += MT2.addNode({
                _id: '' + f1,
                origin: origin
              }, true);
            }
            const f2 = l[file.fields.seq];
            if (nodeIDs.indexOf(f2) == -1) {
              t++;
              nodeIDs.push(f2);
              n += MT2.addNode({
                _id: '' + f2,
                origin: origin
              }, true);
            }
          }
          console.log('Link Excel Parse time:', (Date.now() - start).toLocaleString(), 'ms');
          message(` - Parsed ${n} New, ${t} Total Nodes from Link Excel Table.`);
          if (fileNum == nFiles) processSequences();

        } else {

          Papa.parse(file.contents, {
            delimiter: ",",
            // newline: "\r\n",
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: results => {
              let data = results.data;
              data.map(forEachLink);
              message(` - Parsed ${l} New, ${data.length} Total Links from Link CSV.`);
              results.meta.fields.forEach(key => {
                const safeKey = filterXSS(key);
                if (!session.data.linkFields.includes(safeKey)) {
                  session.data.linkFields.push(safeKey);
                }
              });
              let newNodes = 0, totalNodes = 0;
              const n = data.length;
              let nodeIDs = [];
              for (let i = 0; i < n; i++) {
                const l = data[i];
                const f1 = l[file.fields.id];
                if (nodeIDs.indexOf(f1) == -1) {
                  totalNodes++;
                  newNodes += MT2.addNode({
                    _id: '' + f1,
                    origin: origin
                  }, true);
                }
                const f2 = l[file.fields.seq];
                if (nodeIDs.indexOf(f2) == -1) {
                  totalNodes++;
                  newNodes += MT2.addNode({
                    _id: '' + f2,
                    origin: origin
                  }, true);
                }
              }
              console.log('Link CSV Parse time:', (Date.now() - start).toLocaleString(), 'ms');
              message(` - Parsed ${newNodes} New, ${totalNodes} Total Nodes from Link CSV.`);
              if (fileNum == nFiles) processSequences();
            }
          });
        }
      } else if (file.format == 'node') {

        message(`Parsing ${file.name} as Node List...`);

        let m = 0, n = 0;

        if (file.extension == 'xls' || file.extension == 'xlsx') {

          let workbook = XLSX.read(file.contents, { type: 'array' });
          let data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {raw: false, dateNF: 'yyyy-mm-dd'});
          data.forEach(node => {
            let safeNode = {
              _id: filterXSS('' + node[file.fields.id]),
              seq: (file.fields.seq == 'None') ? '' : filterXSS(node[file.fields.seq]),
              origin: origin
            };
            Object.keys(node).forEach(key => {
              let safeKey = filterXSS(key);
              if (!session.data.nodeFields.includes(safeKey)) {
                session.data.nodeFields.push(safeKey);
              }
              safeNode[safeKey] = filterXSS(node[key]);
            });
            m += MT2.addNode(safeNode, check);
          });
          console.log('Node Excel Parse time:', (Date.now() - start).toLocaleString(), 'ms');
          message(` - Parsed ${m} New, ${n} Total Nodes from Node Excel Table.`);
          if (fileNum == nFiles) processSequences();

        } else {

          Papa.parse(file.contents, {
            delimiter: ",",
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            step: data => {
              let node = data.data;
              let safeNode = {
                _id: filterXSS('' + node[file.fields.id]),
                seq: (file.fields.seq == 'None') ? '' : filterXSS(node[file.fields.seq]),
                origin: origin
              };
              Object.keys(node).forEach(key => {
                let safeKey = filterXSS(key);
                if (!session.data.nodeFields.includes(safeKey)) {
                  session.data.nodeFields.push(safeKey);
                }
                safeNode[safeKey] = (typeof node[key] === 'string') ? filterXSS(node[key]) : node[key];
              });
              m += MT2.addNode(safeNode, check);
            },
            complete: () => {
              console.log('Node CSV Parse time:', (Date.now() - start).toLocaleString(), 'ms');
              message(` - Parsed ${m} New, ${n} Total Nodes from Node CSV.`);
              if (fileNum == nFiles) processSequences();
            }
          });
        }

      } else if (file.format == 'matrix') {

        message(`Parsing ${file.name} as Distance Matrix...`);

        if (file.extension == 'xls' || file.extension == 'xlsx') {

          let workbook = XLSX.read(file.contents, { type: 'array' });
          let data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {header: 1, raw: false, dateNF: 'yyyy-mm-dd'});
          let nodeIDs = [], nn = 0, nl = 0;

          if (data[0][0].replace(/\"/g, '').replace(/\'/g, '')) { // triangle matrix
            let topNodeIDs = [''];
            data.forEach((row, i) => {
              const nodeID = row[0];
              topNodeIDs.push(nodeID);
            })
            data.unshift(topNodeIDs);
          }

          data.forEach((row, i) => {
            if (i == 0) {
              nodeIDs = row;
              nodeIDs.forEach((cell, k) => {
                if (k > 0) {
                  nn += MT2.addNode({
                    _id: filterXSS('' + cell),
                    origin: origin
                  }, check);
                }
              });
            } else {
              const source = filterXSS('' + row[0]);
              row.forEach((cell, j) => {
                if (j == 0) return;
                const target = filterXSS('' + nodeIDs[j]);
                if (source == target) return;
                nl += MT2.addLink({
                  source: source,
                  target: target,
                  origin: origin,
                  distance: parseFloat(cell)
                }, check);
              });
            }
          });
          console.log('Distance Matrix Excel Parse time:', (Date.now() - start).toLocaleString(), 'ms');
          message(` - Parsed ${nn} New, ${data.length - 1} Total Nodes from Excel Distance Matrix.`);
          message(` - Parsed ${nl} New, ${((data.length - 1) ** 2 - (data.length - 1)) / 2} Total Links from Excel Distance Matrix.`);
          if (fileNum == nFiles) processSequences();

        } else {

          MT2.parseCSVMatrix(file).then(o => {
            message(` - Parsed ${o.nn} New, ${o.tn} Total Nodes from Distance Matrix.`);
            message(` - Parsed ${o.nl} New, ${o.tl} Total Links from Distance Matrix.`);
            if (fileNum == nFiles) processSequences();
          });
        }

      } else { // if(file.format == 'newick'){

        let links = 0;
        let newLinks = 0;
        let newNodes = 0;
        const tree = patristic.parseNewick(file.contents);
        temp.tree = tree;
        let m = tree.toMatrix(), matrix = m.matrix, labels = m.ids.map(filterXSS), n = labels.length;
        for (let i = 0; i < n; i++) {
          const source = labels[i];
          newNodes += MT2.addNode({
            _id: source,
            origin: origin
          }, check);
          for (let j = 0; j < i; j++) {
            newLinks += MT2.addLink({
              source: source,
              target: labels[j],
              origin: origin,
              distance: parseFloat(matrix[i][j])
            }, check);
            links++;
          }
        }
        console.log('Newick Tree Parse time:', (Date.now() - start).toLocaleString(), 'ms');
        message(` - Parsed ${newNodes} New, ${n} Total Nodes from Newick Tree.`);
        message(` - Parsed ${newLinks} New, ${links} Total Links from Newick Tree.`);
        if (fileNum == nFiles) processSequences();
      }
    });

    async function processSequences() {
      if (!session.meta.anySequences) return MT2.runHamsters();
      session.data.nodeFields.push('seq');
      let nodes = session.data.nodes, subset = [];
      const n = nodes.length;
      const gapString = '-'.repeat(session.data.reference.length);
      for (let i = 0; i < n; i++) {
        const d = nodes[i];
        if (!d.seq) {
          d.seq = gapString;
        } else {
          subset.push(d);
        }
      }
      if (session.style.widgets['align-sw']){
        message('Aligning Sequences...');
        let output = await MT2.align({
          reference: session.data.reference,
          isLocal: $('#localAlign').is(':checked'),
          match: [$('#alignerMatch').val(), $('#alignerMismatch').val()].map(parseFloat),
          gap: [$('#alignerGapO').val(), $('#alignerGapE').val()].map(parseFloat),
          nodes: subset
        });
        const start = Date.now();
        const m = subset.length;
        for (let j = 0; j < m; j++) {
          Object.assign(subset[j], output[j]);
        }
        console.log("Alignment Merge time: ", (Date.now() - start).toLocaleString(), "ms");
      }
      const start = Date.now();
      for(let k = 0; k < n; k++){
        let node = nodes[k];
        node['_seqInt'] = tn93.toInts(node['seq']);
      }
      console.log("Integer Sequence Translation time: ", (Date.now() - start).toLocaleString(), "ms");
      session.data.consensus = await MT2.computeConsensus();
      await MT2.computeConsensusDistances();
      subset.sort((a, b) => a['_diff'] - b['_diff']);
      if(session.style.widgets['ambiguity-resolution-strategy']){
        await MT2.computeAmbiguityCounts();
      }
      message('Computing Links based on Genomic Proximity...');
      const k = await MT2.computeLinks(subset);
      message(` - Found ${k} New Links from Genomic Proximity`);
      MT2.runHamsters();
    };
  };
})();