(() => {
  'use strict';

  let nsp = document.getElementById("network-settings-pane");
  document.getElementById("network-settings-toggle").addEventListener("click", function (){
    if (this.classList.contains("active")) {
      nsp.classList.remove("d-none");
      MT2.animate(nsp, "slideInLeft");
    } else {
      MT2.animate(nsp, "slideOutLeft").then(e => {
        nsp.classList.add("d-none");
      })
    }
  });

  let height = 600, width = 800; //These get reset almost immediately, they just need to be non-negative numbers

  let graphCanvas = d3.select('#canvas-network');
  let graphCanvasNode = graphCanvas.node();
  
  let context = graphCanvasNode.getContext('2d');

  let settings = session.style.widgets;

  let nodes, links, simulation;

  simulation = d3.forceSimulation()
    .force('link', d3.forceLink()
      .id(d => d._id)
      .distance(l => settings['link-length'])
      .strength(settings['network-link-strength'])
    )
    .force('charge', d3.forceManyBody()
      .strength(-settings['node-charge'])
    )
    .force('gravity', d3.forceAttract()
      .target([width / 2, height / 2])
      .strength(settings['network-gravity'])
    )
    .force('center', d3.forceCenter(width / 2, height / 2));

  function resize(){
    let wrapper = $('#canvas-network').parent();
    height = wrapper.height();
    width = wrapper.width();
    graphCanvasNode.height = height;
    graphCanvasNode.width = width;
    graphCanvas
      .call(
        d3.drag().subject(dragsubject)
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended))
      .call(
        d3.zoom().scaleExtent([1 / 10, 8])
          .on("zoom", e => {
            transform = e.transform;
            render();
          }));
    simulation
      .force('center')
      .x(width/2)
      .y(height/2);
    simulation
      .force('gravity')
      .target([width / 2, height / 2]);
  }

  function updateData(){
    nodes = MT2.getVisibleNodes();

    links = MT2.getVisibleLinks(true);
    for (let i = links.length-1; i >= 0; i--) {
      let link = links[i];
      link.source = nodes.find(d => d._id == link.source || d.id == link.source);
      link.target = nodes.find(d => d._id == link.target || d.id == link.target);
    }

    simulation.nodes(nodes);
    simulation.force('link').links(links);

    resize();
  }

  updateData();

  let transform = d3.zoomIdentity;

  let stats = new Stats();
  stats.showPanel(0);
  Object.assign(stats.dom.style, {
    "position": "absolute",
    "top": "10px",
    "left": "auto",
    "right": "10px",
    "z-index": "100000000"
  });
  nsp.appendChild(stats.dom);

  simulation.on("tick", render);

  function render(){
    stats.begin();

    context.save();
    context.clearRect( 0, 0, context.canvas.width, context.canvas.height);

    context.translate(transform.x, transform.y);
    context.scale(transform.k, transform.k);

    context.strokeStyle = "rgba(0, 0, 0, 0.2)";
    for (let i = links.length-1; i >= 0; i--){
      let d = links[i];
      context.beginPath();
      context.moveTo(d.source.x, d.source.y);
      context.lineTo(d.target.x, d.target.y);
      context.stroke();
    }

    context.fillStyle = "#0000ff";
    for (let i = nodes.length-1; i >= 0; i--) {
      let d = nodes[i];
      context.beginPath();
      context.arc(d.x, d.y, 5, 0, Math.PI*2, true);
      context.fill();
    }

    context.restore();

    stats.end();
  }

  function dragsubject(e) {
    let x = transform.invertX(e.x),
        y = transform.invertY(e.y);
    let r2 = 25;
    for (let i = nodes.length-1; i >= 0; i--) {
      let node = nodes[i];
      let nx = node.x, ny = node.y;
      let dx = x - nx;
      let dy = y - ny;
      if (dx * dx + dy * dy < r2) {
        node.x =  transform.applyX(nx);
        node.y = transform.applyY(ny);
        return node;
      }
    }
  }
  
  function dragstarted(e) {
    if (!e.active) simulation.alphaTarget(0.3).restart();
    e.subject.fx = transform.invertX(e.x);
    e.subject.fy = transform.invertY(e.y);
  }
  
  function dragged(e) {
    e.subject.fx = transform.invertX(e.x);
    e.subject.fy = transform.invertY(e.y);
  }
  
  function dragended(e) {
    if (!e.active) simulation.alphaTarget(0);
    e.subject.fx = null;
    e.subject.fy = null;
  }

  layout.on('stateChanged', resize);

  $window
    .on('node-visibility link-visibility cluster-visibility', () => {
      updateData();
      simulation.alpha(0.3).restart();
    })
    .on('node-selected', render);

})();