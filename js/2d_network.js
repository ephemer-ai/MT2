(() => {
  "use strict";

  if (session.style['network-pinned'] && !$('#network-pinned').hasClass('active')) $('#network-pinned').button('toggle');
  
  let halfWidth = $('#network').parent().width() / 2,
    halfHeight = $('#network').parent().parent().parent().height() / 2,
    transform = d3.zoomTransform(d3.select('svg#network').node()),
    settings = session.style.widgets;

  let zoom = d3.zoom().on('zoom', e => svg.attr('transform', transform = e.transform));

  let brush = d3.brush()
    .filter(() => !d3.event.button)
    .on('start', function(){
      session.network.nodes.forEach(d => {
        if (d.visible) d._previouslySelected = d.selected;
      });
    })
    .on('brush', function(e){
      if(e.sourceEvent.type === 'end') return;
      let selection = [
        transform.invert(e.selection[0]),
        transform.invert(e.selection[1])
      ];
      if(selection.includes(null)) return;
      session.network.nodes.forEach( function (d) {
        d.selected = (d._previouslySelected ^ (
          selection[0][0] <= d.x && d.x <= selection[1][0] &&
          selection[0][1] <= d.y && d.y <= selection[1][1]
        )) === 1;
      });
    })
    .on('end', function(e){
      if (e.selection == null) return;
      d3.select(this).call(e.target.move, null);
      session.network.nodes.forEach(d => delete d._previouslySelected);
      session.data.nodes.forEach(d => {
        let match = session.network.nodes.find(node => node._id == d._id);
        if (match) d.selected = match.selected;
      });
      $window.trigger('node-selected');
    });

  d3.select('svg#network')
    .html(null) //Let's make sure the canvas is blank.
    .attr('height', halfHeight * 2)
    .attr('width', halfWidth * 2)
    .on('click', hideContextMenu)
    .call(zoom);

  d3.select('svg#network')
    .append('g')
    .attr('class', 'brush')
    .call(brush)
    .attr('pointer-events', 'none')
    .select('rect.overlay')
    .attr('pointer-events', 'none');

  d3.select('svg#network')
    .append('g')
    .attr('class', 'horizontal-gridlines');

  d3.select('svg#network')
    .append('g')
    .attr('class', 'vertical-gridlines');

  let svg = d3.select('svg#network').append('g');

  svg.append('g').attr('class', 'clusters');
  svg.append('g').attr('class', 'links');
  svg.append('g').attr('class', 'nodes');

  svg.append('svg:defs').append('marker')
    .attr('id', 'end-arrow')
    .attr('viewBox', '0 0 10 10')
    .attr('refX', 20)
    .attr('refY', 5)
    .attr('markerWidth', 4)
    .attr('markerHeight', 4)
    .attr('orient', 'auto')
    .append('svg:path')
    .attr('d', 'M0,0 L0,10 L10,5 z');

  let force = d3.forceSimulation()
    .force('link', d3.forceLink()
      .id(d => d._id)
      .distance(l => l.origin.length * settings['link-length'])
      .strength(settings['network-link-strength'])
    )
    .force('charge', d3.forceManyBody()
      .strength(-settings['node-charge'])
    )
    .force('gravity', d3.forceAttract()
      .target([halfWidth, halfHeight])
      .strength(settings['network-gravity'])
    )
    .force('center', d3.forceCenter(halfWidth, halfHeight));

  if (settings['network-friction']) force.velocityDecay(settings['network-friction']);

  function updateColumns(){
    if(!$('#network').length) return;
    let variables = settings['node-tooltip-variable'];
    if ('None' != variables) {
      $('#node-tooltip-variable')
        .chosen('destroy')
        .html(
          session.data['nodeFields'].map((d, i) => {
            return `<option value="${d}"${variables.includes(d) ? " selected" : ""}>${MT2.titleize(d)}</option>`
          }).join('\n')
        )
        .chosen({'width': 'inherit', 'max_selected_options': 3});
    }
  }

  function render() { 
    if(!$('#network').length) return;
    const start = Date.now();
    let newNodes = MT2.getVisibleNodes(true);
    let oldNodes;
    if(session.style.widgets["timeline-date-field"] != 'None')
      oldNodes = session.network.timelineNodes;
    else
      oldNodes = session.network.nodes;
    
    if (newNodes.length === 0 && session.style.widgets["timeline-date-field"] == 'None') return;
    
    newNodes.forEach((d, i) => {
      let match = oldNodes.find(d2 => d2._id == d._id);
      if (match) {
        ['x', 'y', 'fx', 'fy', 'vx', 'vy', 'fixed'].forEach(v => {
          if (typeof match[v] != "undefined") d[v] = match[v];
        });
      }
    });

    session.network.nodes = newNodes;
    
    let nodes = svg.select('g.nodes').selectAll('g').data(newNodes, d => d._id)
      .join(
        enter => {
          let g = enter.append('g')
            .attr('tabindex', '0')
            .call(d3.drag() //A bunch of mouse handlers.
              .on('start', dragstarted)
              .on('drag', dragged)
              .on('end', dragended))
            .on('mouseenter focusin', showNodeTooltip)
            .on('mouseout focusout', hideTooltip)
            .on('contextmenu', showContextMenu)
            .on('click', clickHandler)
            .on('keydown', e => {
              if (e.code == 'Space') clickHandler(n);
              if (e.shiftKey && e.key == 'F10') showContextMenu(n);
            });
          g.append('path')
            .attr('stroke', settings['node-color-border'])
            .attr('stroke-width', settings['node-border-width'])
          g.append('text')
            .attr('dy', 5)
            .attr('dx', 8);
          return g;
        }
      );

    $('#node-symbol-variable').trigger('change');
    updateNodeColors();
    redrawLabels();

    let vlinks = getVLinks();
    let links = svg.select('g.links').selectAll('line').data(vlinks)
      .join('line')
      .attr('stroke-width', settings['link-width'])
      .attr('opacity', 1 - settings['link-opacity'])
      .on('mouseenter', showLinkTooltip)
      .on('mouseout', hideTooltip);

    updateLinkColor();
    scaleLinkWidth();

    let linklabels = svg.select('g.links').selectAll('text').data(getLLinks())
      .join('text')
      .attr('text-anchor', 'middle')
      .attr('dy', settings['link-width'] + 2)
      .text(l => l[settings['link-label-variable']]);

    let layoutTick = () => {  
      nodes
        .attr('transform', d => d.fixed ?
          `translate(${d.fx}, ${d.fy})` :
          `translate(${d.x}, ${d.y})`
        );
      links
        .attr('x1', l => l.source.x)
        .attr('y1', l => l.source.y)
        .attr('x2', l => l.target.x)
        .attr('y2', l => l.target.y);
      if (settings['link-label-variable'] !== 'None') {
        linklabels
          .attr('x', l => (l.source.x + l.target.x) / 2)
          .attr('y', l => (l.source.y + l.target.y) / 2)
          .attr('transform', l => 'rotate(' +
            calcAngle(l.source, l.target) + ' ' +
            (l.source.x + l.target.x) / 2 + ' ' +
            (l.source.y + l.target.y) / 2 + ')'
          );
      }
    }

    let foci = settings['polygon-foci'];
    let gather = settings['polygon-gather-force'];
    let fill = settings['polygon-color'];
    let opacity = 0.4;
    
    if (settings['polygon-color-show']) {
      fill = d => temp.style.polygonColorMap(d.key);
      opacity = d => temp.style.polygonAlphaMap(d.key);
    }
    d3.select('#network g.clusters').html(null);
    let groups = Array.from(d3.group(newNodes, d => d[foci]), ([key, value]) => {
      var values = value.map(dd => {
        dd.foci = key;
        return dd;
      });
      return {'key':key, 'values':values};
    });
    groups = groups.filter(group => group.values.length > 2);     
    let groupPath = d => {
      return "M" + d3.polygonHull(d.values.map(i => [i.x, i.y])).join("L") + "Z";
    };
    let clusters = new Array(groups.length);  // The largest node for each cluster.
    newNodes.forEach(d => {
      let r =  d[foci];
      let i = d.foci;
      if (!clusters[i] || (r > clusters[i].radius)) clusters[i] = d;
    });
    let polygonsTick = () => {
      newNodes.forEach(function(o, i) {
        o.y += (clusters[o.foci].y - o.y) * gather;
        o.x += (clusters[o.foci].x - o.x) * gather;
      });
      nodes.attr('transform', d => `translate(${d.x}, ${d.y})`);
      links
        .attr('x1', l => l.source.x)
        .attr('y1', l => l.source.y)
        .attr('x2', l => l.target.x)
        .attr('y2', l => l.target.y);
      if (settings['link-label-variable'] !== 'None') {
        linklabels
          .attr('x', l => (l.source.x + l.target.x) / 2)
          .attr('y', l => (l.source.y + l.target.y) / 2)
          .attr('transform', l => 'rotate(' +
            calcAngle(l.source, l.target) + ' ' +
            (l.source.x + l.target.x) / 2 + ' ' +
            (l.source.y + l.target.y) / 2 + ')'
          );
      }
      d3.select('#network g.clusters').selectAll('path')
        .data(groups)
          .attr("d", groupPath)
        .enter().insert("path", "circle")
          .style("fill", fill)
          .style("stroke", fill)
          .style("stroke-width", 40)
          .style("stroke-linejoin", "round")
          .style("opacity", opacity)
          .attr("d", groupPath);
    }      
    
    if(settings['polygon-show']) temp.polygonGroups = groups;
    else delete temp.polygonGroups;

    let handleTick = d => {
      if(d) return polygonsTick;
      else return layoutTick;		
    }
    force.nodes(session.network.nodes).on('tick', handleTick(settings['polygon-show']));
    force.force('link').links(vlinks);
    force.force('link').distance(settings['link-length']);
    force.alpha(0.3).alphaTarget(0).restart();
    console.log("Network render time:", (Date.now() - start).toLocaleString(), 'ms');
  }

  function getVLinks() {
    let vlinks = MT2.getVisibleLinks(true);
    let output = [];
    let n = vlinks.length;
    let nodes = session.network.nodes;
    for (let i = 0; i < n; i++) {
      let src = nodes.find(d => d._id == vlinks[i].source || d.id == vlinks[i].source);
      let tgt = nodes.find(d => d._id == vlinks[i].target || d.id == vlinks[i].target);
      if (vlinks[i].origin) {
        if (typeof vlinks[i].origin == 'object') {
          if (src && tgt) {
            vlinks[i].origin.forEach((o, j, l) => {
              output.push(Object.assign({}, vlinks[i], {
                origin: o,
                oNum: j,
                origins: l.length,
                source: src,
                target: tgt
              }));
            });
          } 
        } else {
          if (src && tgt) {
            output.push(Object.assign({}, vlinks[i], {
              oNum: 0,
              origins: 1,
              source: src,
              target: tgt
            }));
          }
        }
      } else {
        if (src && tgt) {
          output.push(Object.assign({}, vlinks[i], {
            origin: 'Unknown',
            oNum: 0,
            origins: 1,
            source: src,
            target: tgt
          }));
        }
      }
    }
    return output;
  }

  function getLLinks() {
    let vlinks = MT2.getVisibleLinks(true);
    let n = vlinks.length;
    for (let i = 0; i < n; i++) {
      vlinks[i].source = session.network.nodes.find(d => d._id == vlinks[i].source);
      vlinks[i].target = session.network.nodes.find(d => d._id == vlinks[i].target);
    }
    return vlinks;
  }

  const radToDeg = 180 / Math.PI;
  function calcAngle(source, target) {
    return Math.atan((source.y - target.y) / (source.x - target.x)) * radToDeg;
  }

  let selected, multidrag = false;

  function dragstarted(e, n) {
    if (!e.active) force.alphaTarget(0.3).restart();
    function setNode(d) {
      d.fx = d.x;
      d.fy = d.y;
    }
    multidrag = n.selected;
    selected = svg.select('g.nodes')
      .selectAll('g')
      .data(session.network.nodes)
      .filter(d => d.selected);
    if (multidrag) {
      selected.each(setNode);
    } else {
      setNode(n);
    }
  }

  function dragged(e, n) {
    function updateNode(d) {
      d.fx += e.dx;
      d.fy += e.dy;
    }
    if (multidrag) {
      selected.each(updateNode);
    } else {
      updateNode(n);
    }
  }

  function dragended(e, n) {
    if (!e.active) force.alphaTarget(0);
    function unsetNode(d) {
      if (!d.fixed) {
        d.fx = null;
        d.fy = null;
      } else {
        // save node location back to temp network for pinned network
        if(session.style.widgets["timeline-date-field"] != 'None') {
          let node = session.network.timelineNodes.find(d2 => d2._id == d._id);
          if(node) {
            node.x = d.x;
            node.y = d.y;
            node.fx = d.fx;
            node.fy = d.fy;
          }
        }
      }
    }
    if (multidrag) {
      selected.each(unsetNode);
    } else {
      unsetNode(n);
    }
  }

  function clickHandler(e, n) {
    if (e.ctrlKey) {
      session.data.nodes.find(node => node._id == n._id).selected = !n.selected;
    } else {
      session.data.nodes.forEach(node => {
        if (node._id == n._id) {
          node.selected = !n.selected;
        } else {
          node.selected = false;
        }
      });
    }
    $window.trigger('node-selected');
  }

  let clipboard = new ClipboardJS('#copyID, #copySeq');

  clipboard.on('success', hideContextMenu);

  function showContextMenu(e, d) {
    e.preventDefault();
    hideTooltip();
    $('#copyID').attr('data-clipboard-text', d._id);
    $('#copySeq').attr('data-clipboard-text', d.seq);
    d3.select('#viewAttributes').on('click', function () {
      hideContextMenu();
      let target = $('#network-attribute-modal tbody').empty();
      let nd = session.data.nodes.find(nd => nd._id == d._id);
      for (let attribute in nd) {
        if (attribute[0] == '_') continue;
        target.append(`<tr><td><strong>${MT2.titleize(attribute)}</strong></td><td>${d[attribute]}</td></tr>`);
      }
      $('#network-attribute-modal').modal('show');
    }).node().focus();
    if (d.fixed) {
      $('#pinNode').text('Unpin Node').on('click', function () {
        d.fx = null;
        d.fy = null;
        d.fixed = false;
        force.alpha(0.3).alphaTarget(0).restart();
        hideContextMenu();
      });
    } else {
      $('#pinNode').text('Pin Node').on('click', function () {
        d.fx = d.x;
        d.fy = d.y;
        d.fixed = true;
        hideContextMenu();
      });
    }
    $('#context-menu').css({
      'z-index': 1000,
      'display': 'block',
      'left': (e.pageX) + 'px',
      'top': (e.pageY - 56) + 'px',
    }).animate({ 'opacity': 1 }, 80);
  }

  function hideContextMenu() {
    $('#context-menu').animate({ 'opacity': 0 }, 80, function () {
      $(this).css('z-index', -1);
    });
  }

  function showNodeTooltip(e, d) {
    if (settings['node-highlight']) highlightNeighbors(d);
    if ($('#node-tooltip-variable').val() == 'None') return;
    let variables = settings['node-tooltip-variable'];
    if(Array.isArray(variables) && variables.length > 1) {
      let data = [];
      for(let item of variables){
        if('' == item) continue;
        let arrayItem = [];
        arrayItem.push(MT2.titleize(item));
        arrayItem.push(d[item]);
        data.push(arrayItem);
      }        
      tabulate(data);
      d3.select('#tooltip')
        .style('left', (e.pageX + 8) + 'px')
        .style('top', (e.pageY - 28) + 'px')
        .style('z-index', 1000)
        .transition().duration(100)
        .style('opacity', 1);
    } else {
      d3.select('#tooltip')
        .html(d[variables])
        .style('left', (e.pageX + 8) + 'px')
        .style('top', (e.pageY - 28) + 'px')
        .style('z-index', 1000)
        .transition().duration(100)
        .style('opacity', 1);
    }
  }

  function tabulate(data) {
    let table = d3.select("#tooltip").append("table"),
        tbody = table.append("tbody");
    let rows = tbody.selectAll("tr")
        .data(data)
        .enter()
        .append("tr");
    let cells = rows.selectAll("td")
        .data(d => d)
        .enter()
        .append("td")
        .text(d => d);
  }

  function highlightNeighbors(node) {
    let links = getVLinks();
    let lindices = [], neighbors = [node._id];
    let n = links.length;
    for (let i = 0; i < n; i++) {
      let l = links[i];
      if (l.source._id !== node._id && l.target._id !== node._id) {
        lindices.push(l.index);
      } else {
        if (l.source._id == node._id) {
          neighbors.push(l.target._id);
        } else {
          neighbors.push(l.source._id);
        }
      }
    }
    svg
      .select('g.nodes')
      .selectAll('g')
      .selectAll('path')
      .attr('opacity', d => neighbors.includes(d._id) ? 1 : .1);
    svg
      .select('g.links')
      .selectAll('line')
      .data(links)
      .attr('opacity', l => lindices.includes(l.index) ? .1 : 1);
  }

  $('#link-tooltip-variable').on('change', function () {
    settings['link-tooltip-variable'] = this.value;
  });

  function showLinkTooltip(e, d) {
    let v = settings['link-tooltip-variable'];
    if (v == 'None') return;
    d3.select('#tooltip')
      .html((v == 'source' || v == 'target') ? d[v]._id : d[v])
      .style('left', (e.pageX + 8) + 'px')
      .style('top', (e.pageY - 28) + 'px')
      .style('z-index', 1000)
      .transition().duration(100)
      .style('opacity', 1);
  }

  $('#highlight-neighbors').parent().on('click', function () {
    settings['node-highlight'] = true;
  });

  $('#dont-highlight-neighbors').parent().on('click', function () {
    settings['node-highlight'] = false;
  });

  function hideTooltip() {
    if (settings['node-highlight']) {
      svg
        .select('g.nodes')
        .selectAll('g')
        .selectAll('path')
        .attr('opacity', 1);
      let linkOpacity = 1 - settings['link-opacity'];
      svg
        .select('g.links')
        .selectAll('line')
        .attr('opacity', linkOpacity);
    }
    let tooltip = d3.select('#tooltip');
    tooltip
      .transition().duration(100)
      .style('opacity', 0)
      .on('end', () => tooltip.style('z-index', -1));
    tooltip.select('table').remove();
    tooltip.html('');
  }

  let isNumber = a => typeof a == "number";

  function redrawNodes() {
    //Things to track in the function:
    //* Shapes:     
    let type = d3[settings['node-symbol']];
    let symbolVariable = settings['node-symbol-variable'];
    //* Sizes:
    let defaultSize = settings['node-radius'];
    let size = defaultSize, med = defaultSize, oldrng, min, max;
    let sizeVariable = settings['node-radius-variable'];
    let scale;
    let nodes;
    if (sizeVariable !== 'None') {
      if (session.style.widgets["timeline-date-field"] == 'None') nodes = session.network.nodes;
      else nodes = session.network.timelineNodes;
      let n = nodes.length;
      min = Number.MAX_VALUE;
      max = Number.MIN_VALUE;
      for (let i = 0; i < n; i++) {
        let size = nodes[i][sizeVariable];
        if (typeof size == 'undefined') continue;
        if (size < min) min = size;
        if (size > max) max = size;
      }
      med = (max - min) / 2;
      let maxWidth = settings['node-radius-max'];
      let minWidth = settings['node-radius-min'];
      scale = d3.scaleLinear()
        .domain([min, max])
        .range([minWidth, maxWidth]);
    }
    nodes = svg.select('g.nodes').selectAll('g').data(session.network.nodes);
    nodes.selectAll('path').each(function (d) {
      if (symbolVariable !== 'None') type = d3[temp.style.nodeSymbolMap(d[symbolVariable])];
      if (sizeVariable !== 'None') {
        size = d[sizeVariable];
        if (!isNumber(size)) size = med;
        size = scale(size);
      }
      d3.select(this).attr('d', d3.symbol().size(size).type(type));          
    });
  }

  function redrawNodeBorder(){
    let nodes = svg.select('g.nodes').selectAll('g').data(session.network.nodes);
    nodes
      .selectAll('path')
      .attr('stroke', settings['node-color-border'])
      .attr('stroke-width', settings['node-border-width']);
  }

  function redrawLabels() {
    let nodes = svg.select('g.nodes').selectAll('g').data(session.network.nodes).select('text'),
      labelVar = settings['node-label-variable'];
    if (labelVar == 'None') {
      nodes.text('');
    } else {
      let size = settings['node-label-size'],
        orientation = settings['node-label-orientation'];
      nodes
        .text(n => n[labelVar])
        .style('font-size', size + 'px');
      switch (orientation) {
        case 'Left':
          nodes
            .attr('text-anchor', 'end')
            .attr('dx', -8)
            .attr('dy', (size - 4) / 2);
          break;
        case 'Top':
          nodes
            .attr('text-anchor', 'middle')
            .attr('dx', 0)
            .attr('dy', 4 - size);
          break;
        case 'Bottom':
          nodes
            .attr('text-anchor', 'middle')
            .attr('dx', 0)
            .attr('dy', size + 4);
          break;
        case 'Middle':
          nodes
            .attr('text-anchor', 'middle')
            .attr('dx', 0)
            .attr('dy', (size - 4) / 2);
          break;
        default: //'right'
          nodes
            .attr('text-anchor', 'start')
            .attr('dx', 8)
            .attr('dy', (size - 4) / 2);
      }
    }
  }

  $('#network-settings-toggle').on('click', function () {
    let pane = $('#network-settings-pane');
    if ($(this).hasClass('active')) {
      pane.animate({ left: '-400px' }, function () { pane.hide(); });
    } else {
      pane.show(0, function () { pane.animate({ left: '0px' }); });
    }
  });

  $('#node-label-variable').on('change', function () {
    settings['node-label-variable'] = this.value;
    if (this.value == 'None') {
      $('.node-label-row').slideUp();
    } else {
      $('.node-label-row').css('display', 'flex');
    }
    redrawLabels();
  });

  $('#node-label-size').on('input', function () {
    settings['node-label-size'] = parseFloat(this.value);
    redrawLabels();
  });

  $('#node-label-orientation').on('change', function () {
    settings['node-label-orientation'] = this.value;
    redrawLabels();
  });

  $('#node-tooltip-variable').on('change', function (e) {
    settings['node-tooltip-variable'] = $('#node-tooltip-variable').val();
  });

  $('#node-symbol').on('input', function () {
    settings['node-symbol'] = this.value;
    redrawNodes();
  });

  $('#node-symbol-variable').on('change', function () {
    if($(this).find("option").length <= 1) return false;    
    let variable = this.value;
    settings['node-symbol-variable'] = variable;
    let wrapper = $('#node-symbol-table-wrapper');
    let table = wrapper.find('table');
    if (variable == 'None') {
      temp.style.nodeSymbolMap = function () { return settings['node-symbol']; };
      $('#node-symbol-table-row').slideUp();
      $('#node-symbol-row').slideDown();
      wrapper.fadeOut(function () { table.empty(); });
      redrawNodes();
      return;
    }

    let nodeSymbols;
    if(session.style.nodeSymbolsTable[variable]) {
      nodeSymbols = session.style.nodeSymbolsTable[variable];
    } else {
      nodeSymbols = session.style.nodeSymbolsTable[variable] = [...session.style.nodeSymbols];
    }
    
    $('#node-symbol-row').slideUp();
    $('#node-symbol-table-row').slideDown();
    let values = [];
    let aggregates = {};
    let nodes = session.data.nodes;
    let n = nodes.length;
    let vnodes = 0;
    for (let i = 0; i < n; i++) {
      let d = nodes[i];
      if (!d.visible) continue;
      vnodes++;
      let dv = d[variable];
      if (values.indexOf(dv) == -1) values.push(dv);
      if (dv in aggregates) {
        aggregates[dv]++;
      } else {
        aggregates[dv] = 1;
      }
    }
    if (values.length > nodeSymbols.length) {
      let symbols = [];
      let m = Math.ceil(values.length / nodeSymbols.length);
      while (m-- > 0) {
        symbols = symbols.concat(nodeSymbols);
      }
      nodeSymbols = symbols;
    }
    values.sort(function (a, b) {return aggregates[b] - aggregates[a];}); //#297

    if (session.style.widgets["node-timeline-variable"] == 'None') {
      session.style.nodeSymbolsTableKeys[variable] = values;
      session.style.nodeSymbolsTable[variable] = nodeSymbols;
    } else {
      
      // During timeline mode, user Pause and switch to a different Node Symbol but nodeSymbolsTableKeys[variable] is not available
      if(!session.style.nodeSymbolsTableKeys[variable]) {
        let valuesTL = [];
        let aggregatesTL = {};
        let nodesTL = session.network.timelineNodes;
        let n = nodesTL.length;
        let vnodesTL = 0;
        let nodeSymbolsTL = [...session.style.nodeSymbols];
        for (let i = 0; i < n; i++) {
          let d = nodesTL[i];
          if (!d.visible) continue;
          vnodesTL++;
          let dv = d[variable];
          if (valuesTL.indexOf(dv) == -1) valuesTL.push(dv);
          if (dv in aggregatesTL) {
            aggregatesTL[dv]++;
          } else {
            aggregatesTL[dv] = 1;
          }
        }
        if (valuesTL.length > nodeSymbolsTL.length) {
          let symbols = [];
          let m = Math.ceil(valuesTL.length / nodeSymbolsTL.length);
          while (m-- > 0) {
            symbols = symbols.concat(nodeSymbolsTL);
          }
          nodeSymbolsTL = symbols;
        }
        valuesTL.sort(function (a, b) {return aggregatesTL[b] - aggregatesTL[a];});
        session.style.nodeSymbolsTableKeys[variable] = valuesTL;
        session.style.nodeSymbolsTable[variable] = nodeSymbolsTL;
      }        

      let key;
      let tempNodeSymbols=[];
      for(let v of values) {
        let table = session.style.nodeSymbolsTableKeys[variable];
        key = table.findIndex( k => k === v);
        tempNodeSymbols.push(nodeSymbols[key]);
      }
      nodeSymbols = tempNodeSymbols;
    }
    
    temp.style.nodeSymbolMap = d3.scaleOrdinal(nodeSymbols).domain(values);
    let nodeSymbolHeaderTitle =  (session.style.overwrite && session.style.overwrite.nodeSymbolHeaderTitle ? session.style.overwrite.nodeSymbolHeaderTitle : "Node " + MT2.titleize(variable));
    table.empty().append(
      '<tr>' +
      '<th class="p-1" contenteditable>' + nodeSymbolHeaderTitle + '</th>' +
      (settings['node-symbol-table-counts'] ? '<th>Count</th>' : '') +
      (settings['node-symbol-table-frequencies'] ? '<th>Frequency</th>' : '') +
      '<th>Shape</th>' +
      '</tr>');
    let options = $('#node-symbol').html();
    values.forEach(function (v, i) {
      let selector = $('<select></select>').append(options).val(temp.style.nodeSymbolMap(v)).on('change', function (e) {
        nodeSymbols.splice(i, 1, this.value);
        temp.style.nodeSymbolMap = d3.scaleOrdinal(nodeSymbols).domain(values);

        // make update during timeline - also need to update saved nodeSymbols
        if (session.style.widgets["node-timeline-variable"] != 'None') {
          let key = session.style.nodeSymbolsTableKeys[variable].findIndex( k => k === v);
          session.style.nodeSymbolsTable[variable].splice(key, 1, this.value);
        }
        redrawNodes();
      });
      let cell = $('<td></td>').append(selector);
      let row = $(
        '<tr>' +
        '<td contenteditable>' + MT2.titleize('' + v) + '</td>' +
        (settings['node-symbol-table-counts'] ? ('<td>' + aggregates[v] + '</td>') : '') +
        (settings['node-symbol-table-frequencies'] ? ('<td>' + (aggregates[v] / vnodes).toLocaleString() + '</td>') : '') +
        '</tr>'
      ).append(cell);
      table.append(row);
    });
    
    table
      .find(".p-1")
      .on("focusout", function() {
        session.style.overwrite.nodeSymbolHeaderTitle = $(this).text();
      });

    sortable('#node-symbol-table', { items: 'tr' });
    wrapper.fadeIn();
    redrawNodes();
  });

  $('#node-symbol-table-show').parent().on('click', function () {
    $('#node-symbol-table-wrapper').fadeIn();
  });

  $('#node-symbol-table-hide').parent().on('click', function () {
    $('#node-symbol-table-wrapper').fadeOut();
  });

  $('#node-radius').on('input', function () {
    settings['node-radius'] = parseFloat(this.value);
    redrawNodes();
  });

  $('#node-radius-max').on('input', function () {
    settings['node-radius-max'] = parseFloat(this.value);
    redrawNodes();
  });

  $('#node-radius-min').on('input', function () {
    settings['node-radius-min'] = parseFloat(this.value);
    redrawNodes();
  });

  $('#node-radius-variable').on('change', function () {
    if (this.value == 'None') {
      $('#node-max-radius-row').slideUp();
      $('#node-min-radius-row').slideUp();
      $('#node-radius-row').slideDown();
    } else {
      $('#node-max-radius-row').css('display', 'flex');
      $('#node-min-radius-row').css('display', 'flex');
      $('#node-radius-row').slideUp();
    }
  
    settings['node-radius-variable'] = this.value;
    redrawNodes();
  });

  $("#node-border-width").on("change", function() {
    session.style.widgets["node-border-width"] = this.value;
    $window.trigger("node-border-change");
  });

  function updateNodeColors() {
    let variable = settings['node-color-variable'];
    let nodes = svg.select('g.nodes').selectAll('g').select('path').data(session.network.nodes).classed('selected', d => d.selected);
    if (variable == 'None') {
      let col = settings['node-color'];
      nodes.attr('fill', col).attr('opacity', 1);
    } else {
      nodes
        .attr('fill', d => temp.style.nodeColorMap(d[variable]))
        .attr('opacity', d => temp.style.nodeAlphaMap(d[variable]));
    }
  }

  $('#node-charge').on('input', function () {
    let v = parseFloat(this.value);
    force.force('charge').strength(-v);
    force.alpha(0.3).alphaTarget(0).restart();
    settings['node-charge'] = v;
  });

  $('#link-directed').parent().on('click', function () {
    svg.select('g.links').selectAll('line').attr('marker-end', 'url(#end-arrow)');
    settings['link-directed'] = true;
  });

  $('#link-undirected').parent().on('click', function () {
    svg.select('g.links').selectAll('line').attr('marker-end', null);
    settings['link-directed'] = false;
  });

  $('#link-label-variable').on('change', function () {
    let label = this.value;
    settings['link-label-variable'] = label;
    if (label == 'None') {
      svg.select('g.links').selectAll('text').text('');
    } else {
      svg.select('g.links').selectAll('text').data(getLLinks()).text(l => l[label]);
      force.alpha(0.01).alphaTarget(0).restart();
    }
  });

  $('#link-length').on('input', function () {
    let v = parseFloat(this.value);
    force.force('link').distance(this.value);
    force.alpha(0.3).alphaTarget(0).restart();
    settings['link-length'] = v;
  });

  function updateLinkColor() {
    let variable = settings['link-color-variable'];
    let links = svg.select('g.links').selectAll('line');
    if (variable == 'None') {
      let color = settings['link-color'],
        opacity = 1 - settings['link-opacity'];
      links
        .attr('stroke', color)
        .attr('opacity', opacity);
    } else {
      links
        .data(getVLinks())
        // fix link color mismatched for source and target variables
        .attr('stroke', l => ('source' == variable || 'target' == variable) ? temp.style.linkColorMap(l[variable]._id) : temp.style.linkColorMap(l[variable]))
        .attr('opacity', l => ('source' == variable || 'target' == variable) ? temp.style.linkAlphaMap(l[variable]._id) : temp.style.linkAlphaMap(l[variable]))
        .attr('stroke-dasharray', l => {
          //This quirky little algorithm creates the dasharray code necessary to make dash-y links.
          let length = 15;
          let out = new Array(l.origins * 2);
          let ofs = new Array(l.origins).fill(1);
          let ons = new Array(l.origins).fill(0);
          ons[l.oNum] = 1;
          ofs[l.oNum] = 0;
          for (let i = 0; i < l.origins; i++) {
            out[2 * i] = ons[i] * length;
            out[2 * i + 1] = ofs[i] * length;
          }
          return out.join(', ');
        });
    }
  }

  $('#link-opacity').on('input', function () {
    settings['link-opacity'] = parseFloat(this.value);
    let opacity = 1 - parseFloat(this.value);
    svg.select('g.links').selectAll('line').attr('opacity', opacity);
  });

  function scaleLinkWidth() {
    let scalar = settings['link-width'];
    let variable = settings['link-width-variable'];
    let vlinks = getVLinks();
    let links = svg.select('g.links').selectAll('line').data(vlinks);
    if (variable == 'None') return links.attr('stroke-width', scalar);
    let maxWidth = settings['link-width-max'];
    let minWidth = settings['link-width-min'];
    vlinks = MT2.getVisibleLinks();

    let n = vlinks.length;
    let max = -Infinity;
    let min = Infinity;
    for (let i = 0; i < n; i++) {
      let l = vlinks[i][variable];
      if (!isNumber(l)) return;
      if (l > max) max = l;
      if (l < min) min = l;
    }
    let mid = (max - min) / 2 + min;
    let scale = d3.scaleLinear()
      .domain([min, max])
      .range([minWidth, maxWidth]);
    links.attr('stroke-width', d => {
      let v = d[variable];
      if (!isNumber(v)) v = mid;
      return scale(v);
    });
  }

  $('#link-width').on('input', function () {
    settings['link-width'] = parseFloat(this.value);
    scaleLinkWidth();
  });

  $('#link-width-max').on('input', function () {
    settings['link-width-max'] = parseFloat(this.value);
    scaleLinkWidth();
  });

  $('#link-width-min').on('input', function () {
    settings['link-width-min'] = parseFloat(this.value);
    scaleLinkWidth();
  });

  $('#link-width-variable').on('change', function () {
    if (this.value == 'None') {
      $('#link-max-width-row').slideUp();
      $('#link-min-width-row').slideUp();
      $('#link-width-row').slideDown();
    } else {
      $('#link-max-width-row').css('display', 'flex');
      $('#link-min-width-row').css('display', 'flex');
      $('#link-width-row').slideUp();
    }
    settings['link-width-variable'] = this.value;
    scaleLinkWidth();
  });

  $('#network-gridlines-show').parent().on('click', function () {
    settings['network-gridlines-show'] = true;
    let range = Math.ceil(Math.max(halfWidth, halfHeight) / 50);
    let ords = Object.keys(new Array(range).fill(null)).map(parseFloat);
    d3.select('#network g.horizontal-gridlines').selectAll('line').data(ords).enter().append('line')
      .attr('x1', 0)
      .attr('x2', halfWidth * 2)
      .attr('y1', function (d) { return d * 100; })
      .attr('y2', function (d) { return d * 100; })
      .attr('stroke', 'lightgray');
    d3.select('#network g.vertical-gridlines').selectAll('line').data(ords).enter().append('line')
      .attr('x1', function (d) { return d * 100; })
      .attr('x2', function (d) { return d * 100; })
      .attr('y1', 0)
      .attr('y2', halfHeight * 2)
      .attr('stroke', 'lightgray');
  });

  $('#network-gridlines-hide').parent().on('click', function () {
    settings['network-gridlines-show'] = false;
    d3.select('#network g.horizontal-gridlines').html(null);
    d3.select('#network g.vertical-gridlines').html(null);
  });

  $('#polygon-show').parent().on('click', function () {
    settings['polygon-show'] = true;
    $(".polygon-settings-row").slideDown();
    if(settings['polygon-color-show'] == true){
      $('#polygon-color-show').click();
    } else {
      $('#polygon-color-hide').click();
    }

    render();
  });

  $('#polygon-hide').parent().on('click', function () {
    settings['polygon-show'] = false;
    $(".polygon-settings-row").slideUp();
    $("#polygon-color-table-row").slideUp();
    $("#polygon-color-value-row").slideUp();
    $("#polygon-color-table").empty();
    render();
  });

  $('#polygon-foci').on('change', function () {
    settings['polygon-foci'] = this.value;
    render();
    if(settings['polygon-color-show'] == true) {
      $("#polygon-color-table").empty();
      updatePolygonColors();
    }
  });

  $('#polygon-gather-force').on('input', function () {
    let v = parseFloat(this.value);
    settings['polygon-gather-force'] = v;
    render();
  });

  $('#polygon-color-hide').parent().on('click', function () {
    settings['polygon-color-show'] = false;
    $("#polygon-color-value-row").slideDown();
    $("#polygon-color-table-row").slideUp();
    $("#polygon-color-table").empty();
    render();
  });

  $("#polygon-color-show").parent().on("click", function() { 
    settings['polygon-color-show'] = true;
    $("#polygon-color-value-row").slideUp();
    $("#polygon-color-table-row").slideDown();
    updatePolygonColors();
  });

  function updatePolygonColors() {
    let polygonSort = $("<a style='cursor: pointer;'>&#8645;</a>").on("click", e => {
      session.style.widgets["polygon-color-table-counts-sort"] = "";
      if (session.style.widgets["polygon-color-table-name-sort"] === "ASC")
        session.style.widgets["polygon-color-table-name-sort"] = "DESC"
      else
        session.style.widgets["polygon-color-table-name-sort"] = "ASC"
        updatePolygonColors();
    });
    let polygonColorHeaderTitle =  (session.style.overwrite && session.style.overwrite.polygonColorHeaderVariable == settings['polygon-foci'] ? session.style.overwrite.polygonColorHeaderTitle : "Polygon " + MT2.titleize(settings['polygon-foci']));
    let polygonHeader = $("<th class='p-1' contenteditable>" + polygonColorHeaderTitle + "</th>").append(polygonSort);
    let countSort = $("<a style='cursor: pointer;'>&#8645;</a>").on("click", e => {

      session.style.widgets["polygon-color-table-name-sort"] = "";
      if (session.style.widgets["polygon-color-table-counts-sort"] === "ASC")
        session.style.widgets["polygon-color-table-counts-sort"] = "DESC"
      else
        session.style.widgets["polygon-color-table-counts-sort"] = "ASC"
        updatePolygonColors();
    });
    let countHeader = $((session.style.widgets["polygon-color-table-counts"] ? "<th>Count</th>" : "")).append(countSort);
    let polygonColorTable = $("#polygon-color-table")
      .empty()
      .append($("<tr></tr>"))
      .append(polygonHeader)
      .append(countHeader)
      .append((session.style.widgets["polygon-color-table-frequencies"] ? "<th>Frequency</th>" : ""))
      .append("<th>Color</th>" );
    if (!session.style.polygonValueNames) session.style.polygonValueNames = {};
    let aggregates = MT2.createPolygonColorMap();
    let values = Object.keys(aggregates);

    if (session.style.widgets["polygon-color-table-counts-sort"] == "ASC")
      values.sort(function(a, b) { return aggregates[a] - aggregates[b] });
    else if (session.style.widgets["polygon-color-table-counts-sort"] == "DESC")
      values.sort(function(a, b) { return aggregates[b] - aggregates[a] });
    if (session.style.widgets["polygon-color-table-name-sort"] == "ASC")
      values.sort(function(a, b) { return a - b });
    else if (session.style.widgets["polygon-color-table-name-sort"] == "DESC")
      values.sort(function(a, b) { return b - a });

    let total = 0;
    values.forEach(d => total += aggregates[d] );

    values.forEach((value, i) => {
      session.style.polygonColors.splice(i, 1, temp.style.polygonColorMap(value));
      session.style.polygonAlphas.splice(i, 1, temp.style.polygonAlphaMap(value));
      let colorinput = $('<input type="color" value="' + temp.style.polygonColorMap(value) + '">')
        .on("change", function(){
          session.style.polygonColors.splice(i, 1, this.value);
          temp.style.polygonColorMap = d3
            .scaleOrdinal(session.style.polygonColors)
            .domain(values);
          render();
        });
      let alphainput = $("<a>⇳</a>").on("click", e => {
        $("#color-transparency-wrapper").css({
          top: e.clientY + 129,
          left: e.clientX,
          display: "block"
        });
        $("#color-transparency")
          .val(session.style.polygonAlphas[i])
          .one("change", function() {
            session.style.polygonAlphas.splice(i, 1, parseFloat(this.value));
            temp.style.polygonAlphaMap = d3
              .scaleOrdinal(session.style.polygonAlphas)
              .domain(values);
            $("#color-transparency-wrapper").fadeOut();
            render();
          });
      });
      let cell = $("<td></td>")
        .append(colorinput)
        .append(alphainput);

      let row = $(
        "<tr>" +
          "<td data-value='" + value + "'>" +
            (session.style.polygonValueNames[value] ? session.style.polygonValueNames[value] : MT2.titleize("" + value)) +
          "</td>" +
          (session.style.widgets["polygon-color-table-counts"] ? "<td>" + aggregates[value] + "</td>" : "") +
          (session.style.widgets["polygon-color-table-frequencies"] ? "<td>" + (aggregates[value] / total).toLocaleString() + "</td>" : "") +
        "</tr>"
      ).append(cell);
      polygonColorTable.append(row);
    });
    
    temp.style.polygonColorMap = d3
      .scaleOrdinal(session.style.polygonColors)
      .domain(values);
    temp.style.polygonAlphaMap = d3
      .scaleOrdinal(session.style.polygonAlphas)
      .domain(values);

    polygonColorTable
      .find("td")
      .on("dblclick", function() {
        $(this).attr("contenteditable", true).focus();
      })
      .on("focusout", function() {
        let $this = $(this);
        $this.attr("contenteditable", false);
        session.style.polygonValueNames[$this.data("value")] = $this.text();
      });
      
    polygonColorTable
      .find(".p-1")
      .on("focusout", function() {
        session.style.overwrite.polygonColorHeaderVariable = session.style.widgets["polygon-foci"];
        session.style.overwrite.polygonColorHeaderTitle = $($(this).contents()[0]).text();
      });

    sortable("#polygon-color-table", { items: "tr" });
    render();
  }

  $("#polygon-color")
    .on("change", function() {
      session.style.widgets["polygon-color"] = this.value;
      render();
    })
    .val(session.style.widgets["polygon-color"]);

  $("#polygon-color-table-wrapper").on("contextmenu", e => {
    e.preventDefault();
    $("#polygon-color-table-context").css({
        top: e.clientY,
        left: e.clientX,
        display: "block"
      });
    });

  $("#polygon-color-table-drag").on("click", function() {
    let $this = $(this);
    $this.parent().hide();
    if ($this.text() == "Drag") {
      $("#polygon-color-table-draghandle").slideDown();
      $this.text("Pin");
    } else {
      $("#polygon-color-table-draghandle").slideUp();
      $this.text("Drag");
    }
  });

  $("#polygon-color-table-draghandle").on("mousedown", function() {
    let body = $("body");
    let parent = $(this).parent();
    body.on("mousemove", e => {
      parent
        .css("top"  , parseFloat(parent.css("top"  )) + e.originalEvent.movementY + "px")
        .css("right", parseFloat(parent.css("right")) - e.originalEvent.movementX + "px");
    });
    body.on("mouseup", () => body.off("mousemove").off("mouseup"));
  });

  $("#polygon-color-table-context-hide").on("click", () => $("#polygon-color-table-hide").parent().trigger('click'));

  $("#polygon-color-table-expand").on("click", function() {
    let $this = $(this);
    if ($this.text() == "Expand") {
      $("#polygon-color-table-wrapper").css({
        "max-height": "none",
        "overflow-y": "auto"
      });
      $this.text("Contract");
    } else {
      $("#polygon-color-table-wrapper").css({
        "max-height": "400px",
        "overflow-y": "scroll"
      });
      $this.text("Expand");
    }
  });

  $("#polygon-color-table-counts").on("click", function() {
    let $this = $(this);
    if (session.style.widgets["polygon-color-table-counts"]) {
      session.style.widgets["polygon-color-table-counts"] = false;
      $this.text("Show Counts");
    } else {
      session.style.widgets["polygon-color-table-counts"] = true;
      $this.text("Hide Counts");
    }
    $("#polygon-color-show").click();
  });

  $("#polygon-color-table-frequencies").on("click", function() {
    let $this = $(this);
    if (session.style.widgets["polygon-color-table-frequencies"]) {
      session.style.widgets["polygon-color-table-frequencies"] = false;
      $this.text("Show Frequencies");
    } else {
      session.style.widgets["polygon-color-table-frequencies"] = true;
      $this.text("Hide Frequencies");
    }
    $("#polygon-color-show").click();
  });

  $("#polygon-color-table-show")
    .parent()
    .on("click", () => $("#polygon-color-table-wrapper").fadeIn());

  $("#polygon-color-table-hide")
    .parent()
    .on("click", () => $("#polygon-color-table-wrapper").fadeOut());
  
  $('#network-friction').on('input', function () {
    let v = parseFloat(this.value);
    force.velocityDecay(v);
    force.alpha(0.3).alphaTarget(0).restart();
    settings['network-friction'] = v;
  });

  $('#network-gravity').on('input', function () {
    let v = parseFloat(this.value);
    force.force('gravity').strength(v);
    force.alpha(0.3).alphaTarget(0).restart();
    settings['network-gravity'] = v;
  });

  $('#network-link-strength').on('input', function () {
    let v = parseFloat(this.value);
    force.force('link').strength(v);
    force.alpha(0.3).alphaTarget(0).restart();
    settings['network-link-strength'] = v;
  });

  $('#network-export-filetype').on('change', function () {
    if (this.value == 'svg') {
      $('#network-export-advanced-button').parent().parent().slideUp();
      if ($('#network-export-advanced').hasClass("show")) $('#network-export-advanced-button').click();
    } else {
      $('#network-export-advanced-button').parent().parent().slideDown();
    }
  });

  $('#network-export-scale').on('input', function () {
    let scale = parseFloat(this.value);
    let wrapper = $('#network').parent();
    $('#network-export-dimensions').text(
      Math.round(wrapper.width() * scale) + 'x' +
      Math.round(wrapper.height() * scale) + 'px'
    );
  }).trigger('input');

  $('#network-export').on('click', function () {
    let network = document.getElementById('network');
    let $network = $(network);
    let watermark = d3.select(network).append('image')
      .attr('xlink:href', MT2.watermark)
      .attr('height', 128)
      .attr('width', 128)
      .attr('x', 10)
      .style('opacity', $('#network-export-opacity').val());
    //
    let vnodes = MT2.getVisibleNodes();
    let aggregates = MT2.createNodeColorMap();
    let values = Object.keys(aggregates);
    var columns = [];
    columns.push('Node ' + MT2.titleize(session.style.widgets["node-color-variable"]));
    if (session.style.widgets["node-color-table-counts"]) columns.push('Count');
    if (session.style.widgets["node-color-table-frequencies"]) columns.push('Frequency');
    columns.push('Color');
    var data = [];
    values.forEach((value, i) => {
      let nodeValue =  (session.style.nodeValueNames[value] ? session.style.nodeValueNames[value] : MT2.titleize("" + value));
      let tableCounts = (session.style.widgets["node-color-table-counts"] ?  aggregates[value] : undefined);
      let tableFreq = (session.style.widgets["node-color-table-frequencies"] ? (aggregates[value] / vnodes.length).toLocaleString() : undefined);
      let line = {
        Node: nodeValue,
        Count: tableCounts, 
        Frequency: tableFreq,
        Color: '<div  style="margin-left:5px; width:40px;height:12px;background:' + temp.style.nodeColorMap(value)  +'"> </div>'
      }
      data.push(line);
    })
    let nodeWrapper = document.getElementById('node-color-table-wrapper');
    let nodeLegend = MT2.tabulate(data, columns, nodeWrapper, network);

    let vlinks = MT2.getVisibleLinks();
    aggregates = MT2.createLinkColorMap();
    values = Object.keys(aggregates);
    columns = [];
    columns.push('Link ' + MT2.titleize(session.style.widgets["link-color-variable"]));
    if (session.style.widgets["link-color-table-counts"]) columns.push('Count');
    if (session.style.widgets["link-color-table-frequencies"]) columns.push('Frequency');
    columns.push('Color');
    data = [];
    values.forEach((value, i) => {
      let nodeValue =  (session.style.linkValueNames[value] ? session.style.linkValueNames[value] : MT2.titleize("" + value));
      let tableCounts = (session.style.widgets["link-color-table-counts"] ?  aggregates[value] : undefined);
      let tableFreq = (session.style.widgets["link-color-table-frequencies"] ? (aggregates[value] / vlinks.length).toLocaleString() : undefined);
      let line = {
        Link: nodeValue,
        Count: tableCounts, 
        Frequency: tableFreq,
        Color: '<div  style="margin-left:5px; width:40px;height:12px;background:' + temp.style.linkColorMap(value)  +'"> </div>'
      }
      data.push(line);
    })
    let linkWrapper = document.getElementById('link-color-table-wrapper');
    let linkLegend = MT2.tabulate(data, columns, linkWrapper, network);

    let statsDiv = document.getElementById('network-statistics-wrapper');
    let foreignObjStats = d3.select(network).append("svg:foreignObject")
    .attr("x", statsDiv.offsetLeft)
    .attr("y", statsDiv.offsetTop-60)
    .attr("width", statsDiv.offsetWidth)
    .attr("height", statsDiv.offsetHeight);
    foreignObjStats.append("xhtml:body").html(statsDiv.innerHTML);
    //
    let filetype = $('#network-export-filetype').val(),
      filename = $('#network-export-filename').val();
    if (filetype == 'svg') {
      let content = MT2.unparseSVG(network);
      let blob = new Blob([content], { type: 'image/svg+xml;charset=utf-8' });
      saveAs(blob, filename + '.' + filetype);
      watermark.remove();
      nodeLegend.remove();
      linkLegend.remove();
      foreignObjStats.remove();
    } else {
      saveSvgAsPng(network, filename + '.' + filetype, {
        scale: parseFloat($('#network-export-scale').val()),
        backgroundColor: settings['background-color'],
        encoderType: 'image/' + filetype,
        encoderOptions: parseFloat($('#network-export-quality').val())
      }).then(() => {
          watermark.remove(); 
          nodeLegend.remove(); 
          linkLegend.remove();
          foreignObjStats.remove();
        });
    }
  });

  function fit(thing, bounds) {
    if (!bounds) bounds = svg.node().getBBox();
    if (bounds.width == 0 || bounds.height == 0) return; // nothing to fit
    let parent = svg.node().parentElement.parentElement,
      midX = bounds.x + bounds.width / 2,
      midY = bounds.y + bounds.height / 2;
    let scale = 0.95 / Math.max(bounds.width / parent.clientWidth, bounds.height / parent.clientHeight);
    d3.select('svg#network')
      .transition()
      .duration(750)
      .call(zoom.transform, d3.zoomIdentity
        .translate(parent.clientWidth / 2 - scale * midX, parent.clientHeight / 2 - scale * midY)
        .scale(scale));
  }

  $('#fitbutton').on('click', fit);

  $('#network-pinned').on('click', function () { 
    let nodes = svg
      .select('g.nodes')
      .selectAll('g')
      .data(session.network.nodes)
      .select('path');
    if (session.style['network-pinned']) { 
      nodes.each(function (d) {
        delete d.fx;
        delete d.fy;
        d.fixed = false;
      });
      force.alpha(0.3).alphaTarget(0).restart();
    } else {
      nodes.each(function (d) {
        d.fx = d.x;
        d.fy = d.y;
        d.fixed = true;
      });
    }
    session.style['network-pinned'] = !session.style['network-pinned'];
  });

  //#298
  $('#casesensitivebutton').on('click', function () { 
    if (session.style.widgets["search-case-sensitive"]) { 
      session.style.widgets["search-case-sensitive"] = false;
    } else {
      session.style.widgets["search-case-sensitive"] = true;
    }
    $("#search").trigger("input");
    $('#search-results').html("").hide();
  });

  //#298
  $('#wholewordbutton').on('click', function () { 
    if (session.style.widgets["search-whole-word"]) { 
      session.style.widgets["search-whole-word"] = false;
    } else {
      session.style.widgets["search-whole-word"] = true;
    }
    $("#search").trigger("input");
    $('#search-results').html("").hide();
  });

  $("#node-symbol-table-wrapper").on("contextmenu", function (e) {
    e.preventDefault();
    $("#node-symbol-table-context").css({
      top: e.clientY - 55,
      left: e.clientX,
      display: "block"
    });
  });

  $("#node-symbol-table-move").on("click", function () {
    let $this = $(this);
    $this.parent().hide();
    if ($this.text() == "Drag") {
      $("#node-symbol-table-draghandle").slideDown();
      $this.text("Pin");
    } else {
      $("#node-symbol-table-draghandle").slideUp();
      $this.text("Drag");
    }
  });

  $("#node-symbol-table-draghandle").on("mousedown", function () {
    let body = $("body");
    let parent = $(this).parent();
    body.on("mousemove", function (e2) {
      parent
        .css(
          "top",
          (parseFloat(parent.css("top")) + e2.originalEvent.movementY) + "px"
        )
        .css(
          "left",
          (parseFloat(parent.css("left")) + e2.originalEvent.movementX) + "px"
        );
    });
    body.on("mouseup", function (e3) {
      body.off("mousemove").off("mouseup");
    });
  });

  $("#node-symbol-table-context-hide").on("click", function () {
    $("#node-symbol-table-hide")
      .parent()
      .click();
    $(this).parent().hide();
  });

  $("#node-symbol-table-expand").on("click", function () {
    let $this = $(this);
    if ($this.text() == "Expand") {
      $("#node-symbol-table-wrapper").css({
        "max-height": "none",
        "overflow-y": "auto"
      });
      $this.text("Contract");
    } else {
      $("#node-symbol-table-wrapper").css({
        "max-height": "400px",
        "overflow-y": "scroll"
      });
      $this.text("Expand");
    }
    $this.parent().hide();
  });

  $('#node-symbol-table-counts').on('click', function () {
    let $this = $(this);
    if (settings['node-symbol-table-counts']) {
      settings['node-symbol-table-counts'] = false;
      $this.text("Show Counts");
    } else {
      settings['node-symbol-table-counts'] = true;
      $this.text("Hide Counts");
    }
    $("#node-symbol-variable").trigger('change');
    $this.parent().hide();
  });

  $('#node-symbol-table-frequencies').on('click', function () {
    let $this = $(this);
    if (settings['node-symbol-table-frequencies']) {
      settings['node-symbol-table-frequencies'] = false;
      $this.text("Show Frequencies");
    } else {
      settings['node-symbol-table-frequencies'] = true;
      $this.text("Hide Frequencies");
    }
    $("#node-symbol-variable").change();
    $this.parent().hide();
  });

  d3.select(window).on('keydown keyup', function (e) {
    d3.select('g.brush')
      .attr('pointer-events', e.ctrlKey ? 'all' : 'none')
      .select('rect.overlay')
      .attr('pointer-events', e.ctrlKey ? 'all' : 'none');
  });

  let stopSimulation = () => force.stop();

  $window
    .on('background-color-change.2d', function () {
        $('#network').css('background-color', settings['background-color']);
      })  
    .on('node-border-change.2d', redrawNodeBorder)
    .on('node-color-change.2d', updateNodeColors)
    .on('node-visibility.2d link-visibility.2d cluster-visibility.2d node-selected.2d', render)
    .on('link-color-change.2d', updateLinkColor)
    .on('resize.2d', function () {
      if (session.style.widgets["node-timeline-variable"] != 'None') { 
        $('#node-timeline-variable').val(session.style.widgets["node-timeline-variable"]).change();
        setTimeout(fit, 0);
      }
    })
    .on('stop-force-simulation.2d', stopSimulation);

  layout.on('stateChanged', function () {
    let wrapper = $('#network').parent();
    $('#network-export-width').val(wrapper.width());
    $('#network-export-height').val(wrapper.height());
    brush.extent(brush.extent());
  });

  let linkColorVariable = session.style.widgets["link-color-variable"] === 'None' ? 'origin' : session.style.widgets["link-color-variable"];
  if (session.files.length > 1) $('#link-color-variable').val(linkColorVariable).change(); 
  if (settings['background-color']) $('#network').css('background-color', settings['background-color']);

  render();
  if (session.style.widgets["node-timeline-variable"] != 'None') { 
    $('#node-timeline-variable').val(session.style.widgets["node-timeline-variable"]).change();
  }

  //For some mysterious reason, this really needed a delay...
  setTimeout(function () {
    updateColumns();
    $('#node-symbol-variable').trigger('change');
    if (settings["node-radius-variable"] != 'None') $('#node-radius-variable').trigger('change');
    if (settings["link-width-variable"] != 'None') $('#link-width-variable').trigger('change');
    if (settings["polygon-show"]) $(".polygon-settings-row").slideDown();
    else {
      $(".polygon-settings-row").slideUp();
      $("#polygon-color-table-row").slideUp();
      $("#polygon-color-value-row").slideUp();
    }
  }, 1);

  setTimeout(fit, 1200);

})();