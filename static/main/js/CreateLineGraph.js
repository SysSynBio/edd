/**
* this function creates the line graph 
**/
function createLineGraph(linedata, minValue, maxValue, labels, minXvalue, maxXvalue) {

    /**
     * this function creates the x axis tick marks for grid
     **/
    function make_x_axis() {
        return d3.svg.axis()
            .scale(x)
            .orient("bottom")
            .ticks(5)
    }

    /**
     * this function creates the y axis tick marks for grid
     **/
    function make_y_axis() {
        return d3.svg.axis()
            .scale(y)
            .orient("left")
            .ticks(5)
    }


    var div = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    var margin = {top: 20, right: 150, bottom: 30, left: 40},
        width = 1000 - margin.left - margin.right,
        height = 270 - margin.top - margin.bottom;

    var color = d3.scale.category10();

    var y = d3.scale.linear().domain([minValue - (.1 * minValue), maxValue + (.1 * maxValue)]).range([height, 0]);
    var x = d3.scale.linear().domain([minXvalue - 1, maxXvalue]).range([0, width]);

    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left")
        .tickFormat(d3.format(".2s"));

    var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom")
        .ticks(5);

    //create svg graph object
    var svg = d3.select("div#container").append("svg")
        .attr("preserveAspectRatio", "xMinYMin meet")
        .attr("viewBox", "-30 -40 1100 280")
        .classed("svg-content", true)

    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis);


    // Draw the x Grid lines
    svg.append("g")
        .attr("class", "grid")
        .attr("transform", "translate(0," + height + ")")
        .call(make_x_axis()
            .tickSize(-height, 0, 0)
            .tickFormat("")
        )
    // Draw the y Grid lines
    svg.append("g")
        .attr("class", "grid")
        .call(make_y_axis()
            .tickSize(-width, 0, 0)
            .tickFormat("")
        )

    svg.append("g")
        .attr("class", "y axis")
        .call(yAxis)
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text("Frequency");

    var lineGen = d3.svg.line()
        .x(function (d) {
            return x(d.x);
        })
        .y(function (d) {
            return y(d.y)
        });

    //iterate through different arrays 
    var data = d3.nest()
        .key(function (d) {
            return d.name;
        })
        .key(function (d) {
            return d.i;
        })
        .entries(linedata);

    var legendSpace = width / data.length;

   // data.forEach(function (d, i) {

    for (var k = 0; k < data.length; k++) {
        var color1 = color(data[k].key)
        //label name coincides with same color
        var label = data[k].key;

        //lines
        for (var j = 0; j < data[k].values.length; j++) {
            var line = svg.append('path')
                .attr("class", data[k].key)

                .attr('stroke', color1)
                .attr('stroke-width', 2)
                .attr("class", "line")
                .attr('fill', 'none')

            // line.on("click", function(d) {
            //     d3.selectAll("." + d.name).style("fill", "red");
            // });

            var legend = svg.append("text")
                .attr('d', lineGen(data[k].values[j].values))
                .attr("x", width + 30)// spacing
                .attr("y", 9 + (k * 15))
                .attr("class", "legend")    // style the legend
                .style("fill", function () { // Add the colours dynamically
                    return data[k].color = color(data[k].key);
                })
                .on("click", function (d) {
                    // Determine if current line is visible
                    var self = this;
                     // d3.selectAll(color1).style("fill", "red");

                    // for (var c = 0; c < data.leng th; c++) {
                    //     var active = "#tag" + (data[c]).replace(/\s+/g, '') ? false : true,
                    //         newOpacity = active ? 1 : 0;
                    // // Hide or show the elements based on the ID
                    // d3.select("#tag" + d.key.replace(/\s+/g, ''))
                    //     .transition().duration(100)
                    //     .style("opacity", newOpacity);
                    // // Update whether or  not the elements are active
                    // data[c].active = active;
                    // }
                    var lines = d3.selectAll('.path');
                    var legends = d3.selectAll('.legend');

                    lines.filter(function(x) {
                        return self != this;
                    }).style("opacity", .1);
                    // All other elements transition opacity.
                    legends.filter(function (x) {
                        return self != this;
                    })
                        .style("opacity", .1);
                })
                .on('mouseout', function (d) {
                    d3.selectAll('.legend').style("opacity", 1);
                })
                .text(data[k].key);

            var dataCirclesGroup = svg.append('svg:g');
            var circles = dataCirclesGroup.selectAll('.data-point')
                .data(data[k].values[j].values);
            circles
                .enter()
                .append('svg:circle')
                .attr('class', 'dot')
                .attr('fill', 'grey')
                .attr('cx', function (d) {
                    return x(d["x"]);
                })
                .attr('cy', function (d) {
                    return y(d["y"]);
                })
                .attr('r', function () {
                    return 3;
                })
                .on("mouseover", function (d) {
                    circleLabel = label
                    div.transition()
                        .duration(200)
                        .style("opacity", .9);
                    div.html('<strong>' + circleLabel + '</strong>' + ": " + d.y + " " + d.y_unit)
                        .style("left", (d3.event.pageX) + "px")
                        .style("top", (d3.event.pageY - 30) + "px");
                })
                .on("mouseout", function (d) {
                    div.transition()
                        .duration(500)
                        .style("opacity", 0);
                });
            // .on("mouseover", function () {
            //     //highlight path mouse overed
            //     d3.select(this).style("stroke-width", '6px')
            //     var self = this;
            //     var paths = d3.selectAll('.line');
            //     // All other elements transition opacity.
            //     paths.filter(function (x) {
            //         return self != this;
            //     })
            //         .style("opacity", .1);
            // })
            // .on("mouseout", function (d) {
            //     d3.select(this)                          //on mouseover of each line, give it a nice thick stroke
            //         .style("stroke-width", 2)
            //     d3.selectAll('path').style("opacity", 1);
            // })

        }
        //data circles
    function findName(data, name) {
        return data.filter(function(d) { return d.key == name})
    }

        //color for specific path and name

    }

     function fade(opacity) {
        return function(d) {
            node.style("stroke-opacity", function(o) {
                thisOpacity = isConnected(d, o) ? 1 : opacity;
                this.setAttribute('fill-opacity', thisOpacity);
                return thisOpacity;
            });

            link.style("stroke-opacity", function(o) {
                return o.source === d || o.target === d ? 1 : opacity;
            });
        };
    }



}


 //
        //         var legendGroup = svg.append('svg:g');
        // var legend = legendGroup.selectAll('.line').data(d.values[j].values);
        // legend
        //   .enter()
        //   .append("text")
        //     .attr("x", width + 30)// spacing
        //     .attr("y", 9 + (i * 15) )
        //     .attr("class", "legend")    // style the legend
        //     .attr("dy", ".35em")
        //     .style("fill", color1)
        //     .on("mouseover", function(d){
        //       var self = this;
        //       var legends = d3.selectAll('.legend');
        //
        //       // All other elements transition opacity.
        //       legends.filter(function (x) { return self != this; })
        //           .style("opacity", .1);
        //       })
        //       .on('mouseout', function(d) {
        //           d3.selectAll('.legend').style("opacity", 1);
        //       })
        //     .text(label);
