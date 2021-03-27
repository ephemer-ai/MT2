(function () {
    let links = [];
    let nodes = [];

    let graph = ForceGraph3D()($("#3DNet").get(0));

    function updateNodeTooltip() {
      let nodeTooltip = session.style.widgets["3DNet-node-tooltip-variable"];
      if (nodeTooltip == "None" || nodeTooltip == null) {
        graph.nodeLabel("");
      } else {
        graph.nodeLabel(d => `<span class="three-dee-node-tooltip">${d[nodeTooltip]}</span>`);
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
      let nodeSizeBy = session.style.widgets["3DNet-node-radius-variable"];
      if (nodeSizeBy !== "None") graph.nodeVal(nodeSizeBy);
      graph.nodeRelSize(session.style.widgets["3DNet-node-radius"]);
    }

    function updateLinkTooltip() {
      let linkTooltip = session.style.widgets["3DNet-link-tooltip-variable"];
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
      graph.linkOpacity(1 - session.style.widgets["3DNet-link-transparency"]);
    }

    function updateLinkWidth() {
      graph.linkWidth(session.style.widgets["3DNet-link-width"]);
    }

    function updateBackground() {
      graph.backgroundColor(session.style.widgets["background-color"]);
    }

    function updateData() {
      if(!$('#3DNet').length) return;
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
    //   $window.trigger('node-selected');
    // });

    $("#toggle-3DNet-settings").on("click", function () {
      let pane = $("#3DNet-settings-pane");
      if ($(this).hasClass('active')) {
        pane.animate({ left: "-400px" }, function () {
          pane.hide();
        });
      } else {
        pane.show(0, function () {
          pane.animate({ left: "0px" });
        });
      }
    });

    let a,
      downloads = 0;
    function download() {
      if (downloads) {
        cancelAnimationFrame(a);
      } else {
        $("#3DNet canvas")[0].toBlob(function (blob) {
          saveAs(blob, $("#export-3d-file-name").val() + ".png");
        });
      }
    }
    $("#3DNet-export").on("click", function () {
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

    $('#3DNet-fitbutton').on('click', fit);

    $("#reload-3DNet").on("click", clearCoords);

    $("#3DNet-node-tooltip-variable").on("change", function (e) {
      session.style.widgets["3DNet-node-tooltip-variable"] = e.target.value;
      updateNodeTooltip();
    });

    $("#3DNet-node-radius-variable").on("change", function (e) {
      session.style.widgets["3DNet-node-radius-variable"] = e.target.value;
      updateNodeSizes();
    });

    $("#3DNet-node-radius").on("change", function (e) {
      session.style.widgets["3DNet-node-radius"] = parseFloat(e.target.value);
      updateNodeSizes();
    });

    $("#3DNet-link-tooltip-variable").on("change", function (e) {
      session.style.widgets["3DNet-link-tooltip-variable"] = e.target.value;
      updateLinkTooltip();
    });

    $("#3DNet-link-transparency").on("change", function (e) {
      session.style.widgets["3DNet-link-transparency"] = parseFloat(
        e.target.value
      );
      updateLinkOpacity();
    });

    $("#3DNet-link-width").on("change", function (e) {
      session.style.widgets["3DNet-link-width"] = parseFloat(e.target.value);
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

    // layout.on('stateChanged', function(){
    //   graph.d3Force('center', [0,0,0]);
    //   setTimeout(clearCoords, 200);
    // });

    setTimeout(updateGraph, 100);
  })();
