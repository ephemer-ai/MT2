(() => {
  let tree;

  let redrawTree = () => {
    let size = session.style.widgets['tree-leaf-node-size'],
      color = session.style.widgets['node-color'],
      ncv = session.style.widgets['node-color-variable'];

    if (ncv == 'None') {
      tree.eachLeafNode(d => d3.select(d).attr('r', size).style('fill', color));
    } else {
      let ncm = temp.style.nodeColorMap;
      tree.eachLeafNode(circle => d3.select(circle).attr('r', size).style('fill', data => {
        let id = data.data.id;
        let match = session.data.nodes.find(node => node._id == id);
        if (match) {
          return ncm(match[ncv]);
        } else {
          return color;
        }
      }));
    }

    tagSelected();
    if (session.style.widgets['tree-round-true']) roundBranchDistances();
  };

  let drawTree = () => {
    let panel = $('#tree').parent();
    if (!panel.length) return;

    // only one input newick file, use original tree
    if (session.files.length == 1 && session.files[0].format == 'newick') {
      if (!temp.tree) {
        // no temp.tree when recall stash or loading MT2 file
        temp.tree = patristic.parseNewick(session.files[0].contents);
      } 
    } else {
      if (!temp.tree) return MT2.computeTree().then(drawTree);
    }

    tree = new TidyTree(temp.tree.clone(), {
      parent: '#tree',
      layout: 'horizontal',
      type: 'weighted',
      mode: 'square',
      animation: 0,
      branchNodes: false,
      branchDistances: false,
      leafNodes: true,
      leafLabels: false,
      margin: [60, 100, 60, 60]
    }, {
      select: select,
      contextmenu: contextMenu,
      showtooltip: tooltip,
      hidetooltip: hideTooltip
    });

    $('#tree').on('click', hideContext);

    redrawTree();
  };

  function select(e, d) {
    let n = d[0].data;
    e.preventDefault();
    if (e.ctrlKey) {
      session.data.nodes.find(node => node._id == n.id).selected = !n.selected;
    } else {
      session.data.nodes.forEach(node => {
        if (node._id == n.id) {
          node.selected = !n.selected;
        } else {
          node.selected = false;
        }
      });
    }
    $window.trigger('node-selected');
  }

  function contextMenu(e, d) {
    e.preventDefault();
    hideTooltip();
    let menu = d3.select('#tree-context-menu');
    d3.select('#tree-reroot').on('click', () => {
      tree.setData(d[0].data.reroot());
      $('#tree-branch-distance-size').trigger('input');
      menu.style('z-index', -1).style('display', 'none');
    });
    d3.select('#tree-rotate').on('click', () => {
      tree.setData(d[0].data.rotate().getRoot());
      menu.style('z-index', -1).style('display', 'none');
    });
    d3.select('#tree-flip').on('click', () => {
      tree.setData(d[0].data.flip().getRoot());
      menu.style('z-index', -1).style('display', 'none');
    });
    menu
      .style('display', 'block')
      .style('opacity', 1)
      .style('top', e.offsetY + 'px')
      .style('left', e.offsetX + 'px')
      .style('z-index', 1000);
  }

  function hideContext() {
    let menu = d3.select('#tree-context-menu');
    menu
      .transition().duration(100)
      .style('opacity', 0)
      .on('end', () => menu.style('z-index', -1));
  }

  function tooltip(e, d) {
    if (session.style.widgets['tree-tooltip-show']) {
      e.preventDefault();
      d3.select('#tooltip')
        .text(e.target.getAttribute('title'))
        .style('top', e.pageY + 'px')
        .style('left', (e.pageX + 5) + 'px')
        .style('z-index', 1000)
        .style('opacity', 1);
    }
  }

  function hideTooltip() {
    let tooltip = d3.select('#tooltip');
    tooltip
      .transition().duration(100)
      .style('opacity', 0)
      .on('end', () => tooltip.style('z-index', -1));
  }

  $('#phylogenetic-node-label-variable').on('change', function () {
    let labelVar = this.value;
    tree.eachLeafLabel(label => {
      d3.select(label).text(data => {
        let id = data.data.id;
        let node = session.network.nodes.find(node => node._id == id);
        return node[labelVar];
      }).attr('dx', 8)
    });
  });

  $('#phylogenetic-node-tooltip-variable').on('change', function () {
    let labelVar = this.value;
    tree.eachLeafNode((circle, data) => {
      let node = session.data.nodes.find(d => d.id == data.data.id);
      if (node === undefined) 
        node = session.data.nodes.find(d => d._id == data.data.id);
      d3.select(circle)
        .attr('title', node[labelVar]);
    });
  });

  $('#toggle-tree-settings').on('click', function () {
    let pane = $('#tree-settings-pane');
    if ($(this).hasClass('active')) {
      pane.animate({ left: '-400px' }, () => pane.hide());
    } else {
      pane.show(0, () => pane.animate({ left: '0px' }));
    }
  });

  $('#tree-type').on('change', function () {
    session.style.widgets['tree-type'] = this.value;
    tree.setType(session.style.widgets['tree-type']);
  });

  $('#tree-layout-vertical').parent().on('click', () => {
    session.style.widgets['tree-layout-vertical'] = true;
    session.style.widgets['tree-layout-horizontal'] = false;
    session.style.widgets['tree-layout-circular'] = false;
    tree.setLayout('vertical').recenter();
    $('.hideForCircular').slideDown();
  });

  $('#tree-layout-horizontal').parent().on('click', () => {
    session.style.widgets['tree-layout-vertical'] = false;
    session.style.widgets['tree-layout-horizontal'] = true;
    session.style.widgets['tree-layout-circular'] = false;
    tree.setLayout('horizontal').recenter();
    $('.hideForCircular').slideDown();
  });

  $('#tree-layout-circular').parent().on('click', () => {
    session.style.widgets['tree-layout-vertical'] = false;
    session.style.widgets['tree-layout-horizontal'] = false;
    session.style.widgets['tree-layout-circular'] = true;
    tree.setLayout('circular').recenter();
    $('.hideForCircular').slideUp();
  });

  $('#tree-vertical-stretch').on('input', function () {
    let val = parseFloat(this.value);
    session.style.widgets['tree-vertical-stretch'] = val;
    let cached = tree.animation;
    tree.setAnimation(0);
    tree.setVStretch(val);
    tree.setAnimation(cached);
  });

  $('#tree-horizontal-stretch').on('input', function () {
    let val = parseFloat(this.value);
    session.style.widgets['tree-horizontal-stretch'] = val;
    let cached = tree.animation;
    tree.setAnimation(0);
    tree.setHStretch(val);
    tree.setAnimation(cached);
  });

  $('#tree-simplify').on('click', () => {
    tree.setData(tree.data.simplify());
  });

  $('#tree-consolidate').on('click', () => {
    tree.setData(tree.data.consolidate());
  });

  $('#tree-ruler-show').parent().on('click', () => {
    session.style.widgets['tree-ruler-hide'] = false;
    tree.setRuler(true);
  });

  $('#tree-ruler-hide').parent().on('click', () => {
    session.style.widgets['tree-ruler-hide'] = true;
    tree.setRuler(false);
  });

  $('#tree-animation-on').parent().on('click', () => {
    session.style.widgets['tree-animation-on'] = true;
    tree.setAnimation(1200);
  });

  $('#tree-animation-off').parent().on('click', () => {
    session.style.widgets['tree-animation-on'] = false;
    tree.setAnimation(0);
  });

  $('#tree-mode-square').parent().on('click', () => {
    session.style.widgets['tree-mode-square'] = true;
    session.style.widgets['tree-mode-smooth'] = false;
    session.style.widgets['tree-mode-straight'] = false;
    tree.setMode('square');
  });

  $('#tree-mode-smooth').parent().on('click', () => {
    session.style.widgets['tree-mode-square'] = false;
    session.style.widgets['tree-mode-smooth'] = true;
    session.style.widgets['tree-mode-straight'] = false;
    tree.setMode('smooth');
  });

  $('#tree-mode-straight').parent().on('click', () => {
    session.style.widgets['tree-mode-square'] = false;
    session.style.widgets['tree-mode-smooth'] = false;
    session.style.widgets['tree-mode-straight'] = true;
    tree.setMode('straight');
  });

  $('#tree-branch-nodes-show').parent().on('click', () => {
    session.style.widgets['tree-branch-nodes-hide'] = false;
    tree.setBranchNodes(true);
  });

  $('#tree-branch-nodes-hide').parent().on('click', () => {
    session.style.widgets['tree-branch-nodes-hide'] = true;
    tree.setBranchNodes(false);
  });

  $('#tree-branch-distances-show').parent().on('click', () => {
    session.style.widgets['tree-branch-distances-hide'] = false;
    $('.tree-branch-distance-row').slideDown();
    tree.setBranchDistances(true);
  });

  $('#tree-branch-distances-hide').parent().on('click', () => {
    session.style.widgets['tree-branch-distances-hide'] = true;
    $('.tree-branch-distance-row').slideUp();
    tree.setBranchDistances(false);
  });

  function roundBranchDistances(unround) {
    tree.eachBranchDistance((label, data) => d3.select(label).text(Math.round(data.target.data.length)));
  }

  $('#tree-round-true').parent().on('click', () => {
    session.style.widgets['tree-round-true'] = true;
    roundBranchDistances();
  });

  $('#tree-round-false').parent().on('click', () => {
    session.style.widgets['tree-round-true'] = false;
    tree.eachBranchDistance((label, data) => d3.select(label).text(data.target.data.length.toFixed(3)));
  });

  $('#tree-branch-distance-size').on('input', function () {
    let speed = tree.animation;
    tree.animation = 0;
    let size = parseFloat(this.value);
    session.style.widgets['tree-branch-distance-size'] = size;
    tree.eachBranchDistance((label, data) => d3.select(label).style('font-size', size + 'px'));
    tree.animation = speed;
  });

  $('#tree-tooltip-show').parent().on('click', () => {
    session.style.widgets['tree-tooltip-show'] = true;
  });

  $('#tree-tooltip-hide').parent().on('click', () => {
    session.style.widgets['tree-tooltip-show'] = false;
  });

  $('#tree-leaf-label-show').parent().on('click', () => {
    session.style.widgets['tree-leaf-label-show'] = true;
    $('#tree-leaf-label-size-row').slideDown();
    tree.setLeafLabels(true);
  });

  $('#tree-leaf-label-hide').parent().on('click', () => {
    session.style.widgets['tree-leaf-label-show'] = false;
    $('#tree-leaf-label-size-row').slideUp();
    tree.setLeafLabels(false);
  });

  $('#tree-leaf-label-size').on('input', function() {
    let speed = tree.animation;
    tree.animation = 0;
    let size = parseFloat(this.value);
    session.style.widgets['tree-leaf-label-size'] = size;
    tree.eachLeafLabel(label => d3.select(label).style('font-size', size + 'px'));
    tree.animation = speed;
  });

  $('#tree-leaf-node-show').parent().on('click', () => {
    session.style.widgets['tree-leaf-node-show'] = true;
    $('.tree-leaf-node-row').slideDown();
    tree.setLeafNodes(true);
  });

  $('#tree-leaf-node-hide').parent().on('click', () => {
    session.style.widgets['tree-leaf-node-show'] = false;
    $('.tree-leaf-node-row').slideUp();
    tree.setLeafNodes(false);
  });

  //TODO: s/respresenting/representing/g
  // Must fix in patristic before correcting here!
  let treeVars = ['height', 'depth', 'length', 'respresenting', 'value'];
  $('#tree-leaf-node-radius-variable').on('change', function(){
    let v = this.value;
    let nodes = session.data.nodes;
    session.style.widgets['tree-leaf-node-radius-variable'] = v;
    let cap = session.style.widgets['tree-leaf-node-size'];
    if(treeVars.includes(v)){
      let minVal = Number.MAX_VALUE, maxVal = Number.MIN_VALUE;
      tree.data.each(branch => {
        let value = branch[v];
        if(value < minVal) minVal = value;
        if(value > maxVal) maxVal = value;
      });
      let scale = d3.scaleLinear()
        .domain([minVal, maxVal])
        .range([4, cap]);
      tree.eachLeafNode((node, branch) => {
        d3.select(node).attr('r', scale(branch.data[v]));
      });
    } else {
      let minVal = Number.MAX_VALUE, maxVal = Number.MIN_VALUE;
      nodes.forEach(branch => {
        let value = branch[v];
        if(value < minVal) minVal = value;
        if(value > maxVal) maxVal = value;
      });
      let scale = d3.scaleLinear()
        .domain([minVal, maxVal])
        .range([4, cap]);
      tree.eachLeafNode((node, data) => {
        let id = data.data.id;
        let package = nodes.find(d => d.id == id);
        d3.select(node).attr('r', scale(package[v]));
      });
    }
  });

  setTimeout(() => {
    $('#tree-leaf-node-radius-variable').append(
      treeVars.map(v => `<option value="${v}">${MT2.titleize(v)}</option>`).join('\n')
    );
  }, 1200);

  $('#tree-leaf-node-size').on('input', function () {
    let speed = tree.animation;
    tree.animation = 0;
    let size = parseFloat(this.value);
    session.style.widgets['tree-leaf-node-size'] = size;
    if(session.style.widgets['tree-leaf-node-radius-variable'] == 'None'){
      tree.eachLeafNode(node => d3.select(node).attr('r', size));
    } else {
      $('#tree-leaf-node-radius-variable').trigger('change');
    }
    tree.animation = speed;
  });

  $('#tree-export-filetype').on('change', function () {
    if (this.value == 'svg' || this.value == 'nwk') {
      $('#tree-export-advanced-button').slideUp();
      if ($('#tree-export-advanced').hasClass("show")) $('#tree-export-advanced-button').click();
    } else {
      $('#tree-export-advanced-button').slideDown();
    }
  });

  $('#tree-export-scale').on('input', function () {
    let scale = parseFloat(this.value);
    let wrapper = $('#tree').parent();
    $('#tree-export-dimensions').text(
      Math.round(wrapper.width() * scale) + 'x' +
      Math.round(wrapper.height() * scale) + 'px'
    );
  }).trigger('input');

  $('#tree-export').on('click', () => {
    let $root = $('#tree svg');
    let root = $root[0];
    let watermark = d3.select(root).append('image')
      .attr('xlink:href', MT2.watermark)
      .attr('height', 128)
      .attr('width', 128)
      .attr('x', 10)
      .style('opacity', $('#tree-export-opacity').val());
    let filetype = $('#tree-export-file-type').val();
    let filename = $('#tree-export-file-name').val();
    if (filetype == 'nwk') {
      let blob = new Blob([temp.tree.toNewick()], { type: 'application/newick;charset=utf-8' });
      saveAs(blob, $('#tree-export-file-name').val() + '.nwk');
    } else if (filetype == 'svg') {
      let blob = new Blob([MT2.unparseSVG($('#tree svg')[0])], { type: 'image/svg+xml;charset=utf-8' });
      saveAs(blob, $('#tree-export-file-name').val() + '.svg');
      watermark.remove();
    } else {
      saveSvgAsPng(root, filename + '.' + filetype, {
        scale: parseFloat($('#tree-export-scale').val()),
        backgroundColor: session.style.widgets['background-color'],
        encoderType: 'image/' + filetype,
        encoderOptions: parseFloat($('#tree-export-quality').val())
      }).then(() => watermark.remove());
    }
  });

  $('#tree-fitbutton').on('click', () => tree.recenter());

  function tagSelected() {
    tree.eachLeafNode((circle, data) => {
      let node = session.data.nodes.find(d => d.id == data.data.id);
      if (node === undefined) 
        node = session.data.nodes.find(d => d._id == data.data.id);
      if (node.selected) {
        d3.select(circle)
          .style('stroke', session.style.widgets['selected-color'])
          .style('stroke-width', 2);
      } else {
        d3.select(circle)
          .style('stroke', '#ffffff')
          .style('stroke-width', 1);
      }
    });
  }

  $window
    .on('node-selected', tagSelected)
    .on('node-color-change', redrawTree)
    .on('background-color-change', () => {
      $('#tree svg').parent().css('background-color', session.style.widgets['background-color']);
    });

  $('#tree svg').parent().css('background-color', session.style.widgets['background-color']);

  layout.on('stateChanged', () => {
    if ($('#tree').length) {
      setTimeout(() => {
        redrawTree();
        let wrapper = $('#tree').parent();
        $('#tree-export-width').val(wrapper.width());
        $('#tree-export-height').val(wrapper.height());
      }, 200);
    }
  });

  drawTree();
})();
