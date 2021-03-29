(function () {
    let links = [];
    let nodes = [];

    let graph = ForceGraph()($("#network").get(0));

    function updateNodeTooltip() {
      let nodeTooltip = session.style.widgets["network-node-tooltip-variable"];
      if (nodeTooltip == "None" || nodeTooltip == null) {
        graph.nodeLabel("");
      } else {
        graph.nodeLabel(d => `<span class="network-node-tooltip">${d[nodeTooltip]}</span>`);
      }
    }

    function updateNodeColors() {
      let nodeColorBy = session.style.widgets["node-color-variable"];
      if (nodeColorBy == "None") {
        let nodeColor = session.style.widgets["node-color"];
        graph.nodeColor(d =>
          d.selected ? session.style.widgets["selected-color"] : nodeColor
        );
      } else {
        graph.nodeColor(d =>
          d.selected
            ? session.style.widgets["selected-color"]
            : temp.style.nodeColorMap(d[nodeColorBy])
        );
      }
      graph.nodeOpacity(1);
    }

    function updateNodeSizes() {
      let nodeSizeBy = session.style.widgets["network-node-radius-variable"];
      if (nodeSizeBy !== "None") graph.nodeVal(nodeSizeBy);
      graph.nodeRelSize(session.style.widgets["network-node-radius"]);
    }

    function updateLinkTooltip() {
      let linkTooltip = session.style.widgets["network-link-tooltip-variable"];
      if (linkTooltip == "None") {
        graph.linkLabel("");
      } else {
        graph.linkLabel(d => `<span style="color:#333333;background:#f5f5f5;border:1px solid #cccccc;border-radius:.25rem;padding:.25rem;">${d[linkTooltip]}</span>`);
      }
    }

    function updateLinkColors() {
      let linkColorBy = session.style.widgets["link-color-variable"];
      if (linkColorBy == "None") {
        let linkColor = session.style.widgets["link-color"];
        graph.linkColor(l => linkColor);
      } else {
        graph.linkColor(l => temp.style.linkColorMap(l[linkColorBy]));
      }
    }

    function updateLinkOpacity() {
      graph.linkOpacity(1 - session.style.widgets["network-link-transparency"]);
    }

    function updateLinkWidth() {
      graph.linkWidth(session.style.widgets["network-link-width"]);
    }

    function updateBackground() {
      graph.backgroundColor(session.style.widgets["background-color"]);
    }

    function updateData() {
      if(!$("#network").length) return;
      let newNodes = MT2.getVisibleNodes(true);
      newNodes.forEach(d => {
        let match = nodes.find(d2 => d._id == d2._id || d.id == d2.id);
        if (match) {
          d.x = match.x;
          d.y = match.y;
          d.z = match.z;
          d.vx = match.vx;
          d.vy = match.vy;
          d.vz = match.vz;
        }
        d.id = d._id;
      });
      nodes = newNodes;
      links = MT2.getVisibleLinks(true);
      graph.graphData({
        nodes: nodes,
        links: links
      });
    }

    function updateGraph() {
      updateData();
      updateBackground();
      updateNodeSizes();
      updateNodeColors();
      updateNodeTooltip();
      updateLinkWidth();
      updateLinkColors();
      updateLinkOpacity();
      updateLinkTooltip();
    }

    // graph.onNodeClick(function(node){
    //   let model = session.data.nodes.find(d => node.id = d.id);
    //   if(!model) return;
    //   model.selected = !model.selected;
    //   $window.trigger("node-selected");
    // });

    let nsp = document.getElementById("network-settings-pane");

    var stats = new Stats();
    stats.showPanel(0);
    Object.assign(stats.dom.style, {
      "position": "absolute",
      "top": "10px",
      "left": "auto",
      "right": "10px",
      "z-index": "100000000"
    });
    nsp.appendChild( stats.dom );
    graph.onEngineTick(() => {
      stats.end();
      stats.begin();
    });

    $("#toggle-network-settings").on("click", function () {
      if ($(this).hasClass("active")) {
        nsp.classList.remove("d-none");
        MT2.animate(nsp, "slideInLeft");
      } else {
        MT2.animate(nsp, "slideOutLeft").then(e => {
          nsp.classList.add("d-none");
        })
      }
    });

    let a, downloads = 0;
    function download() {
      if (downloads) {
        cancelAnimationFrame(a);
      } else {
        $("#network canvas")[0].toBlob(blob => {
          saveAs(blob, $("#export-network-file-name").val() + "." + $("#export-network-file-format").val());
        });
      }
    }
    $("#network-export").on("click", function () {
      downloads = 0;
      a = requestAnimationFrame(download);
    });

    function clearCoords() {
      nodes.forEach(d => {
        delete d.x;
        delete d.y;
        delete d.z;
      });
      updateGraph();
    }

    function fit(thing, bounds) {
      graph.cameraPosition({ z: 1000 });
    }

    $("#network-fitbutton").on("click", fit);

    $("#reload-network").on("click", clearCoords);

    $("#network-node-tooltip-variable").on("change", function (e) {
      session.style.widgets["network-node-tooltip-variable"] = e.target.value;
      updateNodeTooltip();
    });

    $("#network-node-radius-variable").on("change", function (e) {
      session.style.widgets["network-node-radius-variable"] = e.target.value;
      updateNodeSizes();
    });

    $("#network-node-radius").on("input", function (e) {
      session.style.widgets["network-node-radius"] = parseFloat(e.target.value);
      updateNodeSizes();
    });

    $("#network-link-tooltip-variable").on("change", function (e) {
      session.style.widgets["network-link-tooltip-variable"] = e.target.value;
      updateLinkTooltip();
    });

    $("#network-link-transparency").on("change", function (e) {
      session.style.widgets["network-link-transparency"] = parseFloat(
        e.target.value
      );
      updateLinkOpacity();
    });

    $("#network-link-width").on("change", function (e) {
      session.style.widgets["network-link-width"] = parseFloat(e.target.value);
      updateLinkWidth();
    });

    $window
      .on("link-visibility node-visibility", updateData)
      .on("node-color-change selected-color-change", updateNodeColors)
      .on("link-color-change", updateLinkColors)
      .on("background-color-change", updateBackground)
      .on("node-selected", function () {
        updateData();
        updateNodeColors();
      });

    // layout.on("stateChanged", function(){
    //   graph.d3Force("center", [0,0,0]);
    //   setTimeout(clearCoords, 200);
    // });

    setTimeout(updateGraph, 100);

  })();
