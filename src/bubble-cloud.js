angular.module('bubbleCloud', [])

.directive('bubbleCloud', function ($window, $timeout) {

    return {

        restrict: 'E',

        scope: {

            // Either an array of data objects (with groups, labels, and values),
            // or a dictionary of groups of data objects (with labels and values)
            data: '=',

            // Set to 'true' to automatically update when data does
            watch: '@',

            // The attribute containing a data object's value
            valueAttr: '@',

            // The attribute containing a data object's label (optional)
            labelAttr: '@',

            // The attribute containing a data object's group
            // (required if data is an array)
            groupAttr: '@',

            // A function which takes a group name and returns the desired
            // fill color. Optional. The default is d3.scale.category20c()
            fillColorFn: '=',

            // A function which takes a group name and returns the desired
            // label color. Optional. The default is black.
            labelColorFn: '=',

            // A function which takes a data object and returns the tooltip
            // text. The default is to combine the label and the value.
            tooltipFormatFn: '@',

            // Overall diameter of the chart, in pixels
            diameter: '@',

            // A function name to publish into the parent scope, to allow
            // reloading the chart (optional)
            renderChartFn: '=?',

        },

        link: function (scope, element, attrs, ctrl) {  
            
            var w = angular.element($window);

            var reload = function() {
                if(element[0].offsetWidth < element[0].offsetHeight) {
                    scope.diameter = element[0].offsetWidth;
                } else {
                    scope.diameter = element[0].offsetHeight;
                }
                
                ctrl.init(element.find('svg'));
                ctrl.renderChart();

                if(element[0].offsetWidth > element[0].offsetHeight) {
                    ctrl.FontModifier = "h";
                    ctrl.FontSizeMultiplier = 1;
                } else {
                    ctrl.FontModifier = "w";
                    ctrl.FontSizeMultiplier = 0.5;
                }
            };

            if(element[0].offsetWidth > element[0].offsetHeight) {
                ctrl.FontModifier = "h";
                ctrl.FontSizeMultiplier = 1;
            } else {
                ctrl.FontModifier = "w";
                ctrl.FontSizeMultiplier = 0.5;
            }

            w.bind("resize", reload);
            $timeout(reload, 300);


            // Publish renderChart into the parent scope
            scope.renderChartFn = ctrl.renderChart;

            // Watch the data, if desired
            if (scope.watch === 'true') {
                scope.$watch('data', ctrl.renderChart, true);
            }

            if(element[0].offsetWidth < element[0].offsetHeight) {
                scope.diameter = element[0].offsetWidth;
            } else {
                scope.diameter = element[0].offsetHeight;
            }

            // Set up the controller
            ctrl.init(element.find('svg'));
        },

        template: '<svg id="mychart"></svg>',

        controller: 'chartController',

    };

})

.controller('chartController', function ($scope, $filter) {

    var tooltip;

    function addTooltipOnElement(element) {
        element
            .on('mouseover', function(datum) {
                var colorsEnum = {
                    "#81C784": 'lighter-green',
                    "#66BB6A": 'light-green',
                    "#4CAF50": 'medium-green',
                    "#388E3C": 'dark-green',
                    "#1B5E20": 'darker-green'
                };
                if (tooltip) {
                    return;
                }
                tooltip = document.createElement('div');
                document.body.appendChild(tooltip);
                tooltip.className = 'tooltip -' + colorsEnum[datum.object.color];
                tooltip.innerHTML = $filter('number')(datum.value);
                tooltip.style.position = 'fixed';
                tooltip.style.top = d3.event.pageY + 'px';
                tooltip.style.left = (d3.event.pageX - tooltip.offsetWidth / 2) + 'px';
            })
            .on('mouseout', function() {
                if (!tooltip) {
                    return;
                }
                tooltip.remove();
                tooltip = null;
            })
            .on('mousemove', function() {
                if (!tooltip) {
                    return;
                }
                tooltip.style.top = d3.event.pageY + 'px';
                tooltip.style.left = (d3.event.pageX - tooltip.offsetWidth / 2) + 'px';
            });
    }


    // Return a flattened array of objects of this form:
    //
    //   { group: 'Rock', name: 'Rolling Stones, The', value: 12 }
    //
    function get_flattened_data () {

        var data = $scope.data;

        if (_(data).isArray()) {

            var groupAttr = $scope.groupAttr;
            if (! groupAttr) throw new Error('group-attr is required on <bubble>');

            data = _($scope.data).groupBy(function (item) { return item[groupAttr]; });
        }

        var flattened_data = [];

        _(data).each(function (items, group) {

            _(items).each(function (item) {
                flattened_data.push({ group: group, object: item });
            });

        });

        return flattened_data;

    }

    // Initialize the controller with the given SVG element
    // (wrapped in an array)
    this.init = function (svg_element) {

        var valueAttr = $scope.valueAttr;
        if (! valueAttr) throw new Error('value-attr is required on <bubble>');

        var diameter = parseInt($scope.diameter);

        svg_element
            .attr('width', diameter)
            .attr('height', diameter)
            .css('position', 'absolute')
            .css('top', '50%')
            .css('left', '50%')
            .css('margin-top', (-1 * diameter / 2) + 'px')
            .css('margin-left', (-1 * diameter / 2) + 'px')
            .attr('class', 'bubble')
            .attr('preserveAspectRatio', 'xMidYMid meet');

        $scope.selection = d3.selectAll(svg_element);

        // Create a pack layout
        $scope.pack_layout = d3.layout.pack()
            .sort(null)
            .value(function (datum) {
                return datum.object[valueAttr];
            })
            .size([diameter, diameter])
            .padding(1.5);

        $scope.fill_color_fn = function (object) {
            var color = object.color;

            return color;
        };
        
        $scope.label_color_fn = function () { return 'white'; };
        
    };

    // Get the latest data and render the chart
    this.renderChart = function () {
        
        var self = this;

        // Get the latest data

        var data = { children: get_flattened_data() };

        // Lay out the data

        var node = $scope.selection.selectAll('.node')
            .data($scope.pack_layout.nodes(data).filter(function(d) { return !d.children; }));

        // Handle added nodes

        var enter = node.enter().append('g')
            .attr('class', 'node');
        enter.append('circle');
        enter.append('text')
            .attr('dy', '.3em')
            .style('text-anchor', 'middle');   

        // Handle each node

        var valueAttr = $scope.valueAttr;
        var labelAttr = $scope.labelAttr;
        var label_format_fn = $scope.label_format_fn;
        var fill_color_fn = $scope.fill_color_fn;
        var label_color_fn = $scope.label_color_fn;
        var tooltip_format_fn = $scope.tooltip_format_fn;

        node.attr('transform', function (datum) {
            return 'translate(' + (datum.x) + ',' + datum.y + ')';
        });

        node.select('title')
            .text(function (datum) {
                if (tooltip_format_fn) {
                    return tooltip_format_fn(datum);
                } else {
                    return datum.object[labelAttr] + ': ' + d3.format(',d')(datum.object[valueAttr]);
                }
            });
            
        var circles = node.select('circle')
            .attr('r', function (datum) {
                return datum.r;
            })
            .attr('stroke', 'white')
            .attr('stroke-width', '3')
            .style('fill', function (datum) {
                return fill_color_fn(datum.object);
            });

        addTooltipOnElement(circles);

       var texts = node.select('text')
            .style('fill', function (datum) {
                return label_color_fn(datum.group);
            })
            .each(function(d) {
                var label = d.object[labelAttr].split(' ');
                var textNode = d3.select(this);
                textNode.selectAll('*').remove();

                label.forEach(function(word, iterator) {
                    var tspan = textNode.append('tspan')
                        .text(word)
                        .attr('x', 0)
                        .style('font-size', function() {
                            return (d.object.value/d.object.biggestValue + self.FontSizeMultiplier) + 'v'+ self.FontModifier;
                        });

                    tspan.attr('dy', '1.1em');
                });
                textNode
                    .attr('y', function() {
                        return (-1 * (this.offsetHeight / 2));
                    });
            });

        addTooltipOnElement(texts);

        // Handle removed nodes

        node.exit().remove();
    };

});
