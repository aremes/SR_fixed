var margin = {top: 280, right: 280, bottom: 250, left: 280},
    radius = Math.min(margin.top, margin.right, margin.bottom, margin.left);

var hue = d3.scale.category10();

/*
var luminance = d3.scale.sqrt()
    .domain([0, 1e6])
    .clamp(true)
    .range([90, 20]);
*/

/*
var svg = d3.select("body").append("svg")
    .attr("width", margin.left + margin.right)
    .attr("height", margin.top + margin.bottom)
  .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
*/

var svg = d3.select(".content").append("svg")
    .attr("width", 500)
    .attr("height", 500)
    .append("g")
    .attr("transform", "translate(" + (margin.left-40) + "," + (margin.top-50) + ")");

var tip = d3.tip()
  .attr("class", "d3-tip")
  .offset([-10, 0])
  .html( function(d){
    if( d.name === "f" ){
      return "<text>Frauen </br> Zum Hineinzoomen klicken</text>";
    }else if( d.name === "m" ){
      return "<text>M&auml;nner</br> Zum Hineinzoomen klicken</text>";
    }else if( d.depth === 2 ){
      return tip.hide(); //sifu - wie kann man das "richtig" lösen. das stimmt so nicht, produziert einen Fehler auf der Konsole, macht aber was ich will (tip erscheint nicht.)
    }else{
      return "<text><strong>"+d.name+":</br>"+d.partei+",</br>"+d.info+"</strong></text>";
    }
  });

svg.call(tip);

var partition = d3.layout.partition()
    //.sort(function(a, b) { return d3.ascending(a.name, b.name); })
    .size([2 * Math.PI, radius]);

var arc = d3.svg.arc()
    .startAngle( function(d){ return d.x; } )
    .endAngle( function(d){ return d.x + d.dx - 0.01 / ( d.depth + 0.5 ); } )
    .innerRadius( function(d){ return radius / 3 * d.depth; } )
    .outerRadius( function(d){ return radius / ( 2 + d.depth ) * ( d.depth + 1 ) -1; } )

/*
var arc = d3.svg.arc()
    .startAngle(function(d) { return d.x; })
    .endAngle(function(d) { return d.x + d.dx - .01 / (d.depth + .5); })
    .innerRadius(function(d) { return radius / 3 * d.depth; })
    .outerRadius(function(d) { return radius / 3 * (d.depth + 1) - 1; });
*/

d3.json("geschlecht.json", function(error, root) {
  // Compute the initial layout on the entire tree to sum sizes.
  // Also compute the full name and fill color for each node,
  // and stash the children so they can be restored as we descend.
  partition
      .value(function(d) { return d.value; })
      .nodes(root)
      .forEach(function(d) {
        d._children = d.children;
        d.sum = d.value;
        d.key = key(d);
        d.fill = fill(d);
      });

  // Now redefine the value function to use the previously-computed sum.
  partition
      .children(function(d, depth) { return depth < 2 ? d._children : null; })
      .value(function(d) { return d.sum; });

  //svg.selectAll( '.center' ).remove();

  /*we do element backgrounds using patterns :) <-- damnit i need to cut back on smiley usage..*/
  /* you need to play with the x/y width values to get what you want..*/
  svg.append("defs").append("pattern")
      .attr("id", "centerBackground")
      .attr("x", "0")
      .attr("y", "0")
      .attr("width", 1)
      .attr("height", 1)
      .attr("patternUnits", "objectBoundingBox")
        .append("image") 
          .attr("xlink:href", "icon_21902.svg")
          .attr("x", 0)
          .attr("y", 0)
          .attr("width", 2*radius/3)
          .attr("height", 2*radius/3);

  var center = svg.append("circle")
      .attr("r", radius / 3)
      .style("fill","url(#centerBackground)")
      .on("click", zoomOut);

  //center.append("title")
      //.text("zoom out");

  /*
  center.append("image") // wird nicht angezeigt. Format ändenr hilft nichts, x,y ändern auch nicht, kann geladen werden
          .attr("xlink:href", "icon_21902.svg")
          .attr("x", "-50px")
          .attr("y", "-50px")
          .attr("width", "100px")
          .attr("height", "100px");
  */


  var path = svg.selectAll("path")
      .data(partition.nodes(root).slice(1))
    .enter().append("path")
      .attr("d", arc)
      .style("fill", function(d) { return d.fill; })
      .style("fill-opacity", function(d){
            if(d.depth===2){
              return 0.01;
            }else{
              return 1;
            }
          })
      .each(function(d) { this._current = updateArc(d); })
      //.on("click", zoomIn); //hier: Funktion für click
      .on("click", function(d){
          if(d.children){
            zoomIn(d);
            d3.select(".infocontent2").classed("hidden", false);
            d3.select(".text.allgemein").classed( "hidden", false);
          }else if(!d.children){
            d3.select(".text.allgemein").classed( "hidden", true);
            //d3.selectAll(".infocontent2.text").classed( "hidden", true );
            d3.select(".text." + d.id).classed( "hidden", false);
          }
        })
      .on("mouseover", tip.show )
      .on("mouseout", tip.hide);

  function zoomIn(p) {
    if (p.depth > 1) p = p.parent;
    if (!p.children) return;
    zoom(p, p);

    center.select("image")
        .remove();
  }

  function zoomOut(p) {
    if (!p.parent) return;
    d3.selectAll(".infocontent2").classed("hidden", true);
    d3.selectAll(".infocontent2 .text").classed("hidden", true);//du hast auch versucht elemente zu selecten die sowohl die infoconten2 als auch die text class haben.. whitespace :)
    zoom(p.parent, p);

    /* Dieser Part produziert einen "not defined fehler"
    circle.classed("female", false); 
    circle.classed("male", false);
    center.select("image")
      .remove();
    d3.select(".text.geschlecht").classed("hidden", false);
    */
  }

  // Zoom to the specified new root.
  function zoom(root, p) {
    if (document.documentElement.__transition__) return;

    // Rescale outside angles to match the new layout.
    var enterArc,
        exitArc,
        outsideAngle = d3.scale.linear().domain([0, 2 * Math.PI]);

    function insideArc(d) {
      return p.key > d.key
          ? {depth: d.depth - 1, x: 0, dx: 0} : p.key < d.key
          ? {depth: d.depth - 1, x: 2 * Math.PI, dx: 0}
          : {depth: 0, x: 0, dx: 2 * Math.PI};
    }

    function outsideArc(d) {
      return {depth: d.depth + 1, x: outsideAngle(d.x), dx: outsideAngle(d.x + d.dx) - outsideAngle(d.x)};
    }

    center.datum(root);

    // When zooming in, arcs enter from the outside and exit to the inside.
    // Entering outside arcs start from the old layout.
    if (root === p) enterArc = outsideArc, exitArc = insideArc, outsideAngle.range([p.x, p.x + p.dx]);

    path = path.data(partition.nodes(root).slice(1), function(d) { return d.key; });

    // When zooming out, arcs enter from the inside and exit to the outside.
    // Exiting outside arcs transition to the new layout.
    if (root !== p) enterArc = insideArc, exitArc = outsideArc, outsideAngle.range([p.x, p.x + p.dx]);

    d3.transition().duration(d3.event.altKey ? 7500 : 750).each(function() {
      path.exit().transition()
          .style("fill-opacity", function(d) { return d.depth === 1 + (root === p) ? 1 : 0; })
          .attrTween("d", function(d) { return arcTween.call(this, exitArc(d)); })
          .remove();

      path.enter().append("path")
          .style("fill-opacity", function(d) { return d.depth === 2 - (root === p) ? 1 : 0; })
          .style("fill", function(d) { return d.fill; })
          //.on("click", zoomIn)
          .on("click", function(d){
            if(d.children){
              zoomIn(d);
              d3.select(".infocontent2").classed("hidden", false);
              d3.select(".text.allgemein").classed( "hidden", false);
            }else if(!d.children){
              d3.select(".text.allgemein").classed( "hidden", true);
              //d3.selectAll(".infocontent2.text").classed( "hidden", true );
              d3.select(".text." + d.id).classed( "hidden", false);
            }
          })
          .each(function(d) { this._current = enterArc(d); })
          .on("mouseover", tip.show )
          .on("mouseout", tip.hide);

      /* - hier gibt's einen Fehler
      path.transition()
          .each("end", function(d, i){ 
            if(labelText === "m"){
              circle.classed("male", true)
              center.append("image")
              .attr("xlink:href", "icon_25455.svg")
              .attr("x", "-50px")
              .attr("y", "-50px")
              .attr("width", "100px")
              .attr("height", "100px")
              d3.selectAll(".text").classed("hidden", true)
              d3.select(".text.m").classed("hidden", false);
            }else if(labelText==="f"){
              circle.classed("female", true)
              center.append("image")
              .attr("xlink:href", "icon_25454.png")
              .attr("x", "-50px")
              .attr("y", "-50px")
              .attr("width", "100px")
              .attr("height", "100px")
              d3.selectAll(".text").classed("hidden", true)
              d3.select(".text.f").classed("hidden", false);
            }
          })


      
      path.transition()
          .style("fill-opacity", 1)
          .attrTween("d", function(d) { return arcTween.call(this, updateArc(d)); });
      */
      path.transition()
          .style("fill-opacity", function(d){
            if(d.depth===2){
              return 0.01;
            }else{
              return 1;
            }
          })
          .attrTween("d", function(d) { return arcTween.call(this, updateArc(d) ); } );
    });
  }
});

function key(d) {
  var k = [], p = d;
  while (p.depth) k.push(p.name), p = p.parent;
  return k.reverse().join(".");
}

/*
function fill(d) {
  var p = d;
  while (p.depth > 1) p = p.parent;
  var c = d3.lab(hue(p.name));
  //c.l = luminance(d.sum);
  return c;
}
*/

function fill(d){
  var p = d;
  //var c;
  if( p.depth === 1 ){
    var colors = {
     'm': "#cfb725",
     'f': "#30b68f",
    }
    return colors[p.name];
  }else if( p.depth === 2 ){
    var colors = {
      'SPÖ': 'red',
      'ÖVP': 'black',
      'FPÖ': 'blue',
      'Grüne': 'green',
      'BZÖ': 'orange',
      'unabhängig': '#999',
      'Krone': '#999'
    }
    return colors[p.partei];
  }
}

function arcTween(b) {
  var i = d3.interpolate(this._current, b);
  this._current = i(0);
  return function(t) {
    return arc(i(t));
  };
}

function updateArc(d) {
  return {depth: d.depth, x: d.x, dx: d.dx};
}

d3.select(self.frameElement).style("height", margin.top + margin.bottom + "px");
