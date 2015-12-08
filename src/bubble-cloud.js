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
                scope.diameter = element[0].offsetWidth;
                ctrl.init(element.find('svg'));
                ctrl.renderChart();
            };

            w.bind("resize", reload);
            $timeout(reload, 300);

            // Set size of element
            element.css('height', '100%');

            element.css('width', '100%');

            // Publish renderChart into the parent scope
            scope.renderChartFn = ctrl.renderChart;

            // Watch the data, if desired
            if (scope.watch === 'true') {
                scope.$watch('data', ctrl.renderChart, true);
            }

            scope.diameter = element[0].offsetWidth;
            // Set up the controller
            ctrl.init(element.find('svg'));
        },

        template: '<svg id="mychart"></svg>',

        controller: 'chartController',

    };

})

.controller('chartController', function ($scope) {  


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
            .attr('width', "100%")
            .attr('height', diameter)
            .attr('class', 'bubble');

        $scope.selection = d3.selectAll(svg_element);

        // Create a pack layout
        $scope.pack_layout = d3.layout.pack()
            .sort(null)
            .value(function (datum) {
                return datum.object[valueAttr];
            })
            .size([diameter, diameter])
            .padding(1.5);

        $scope.fill_color_fn = function (object){
            var p = (object.value - object.lowestValue) / (object.biggestValue - object.lowestValue),
                darker_green = 90,
                lighter_green = 180;

            var green = Math.floor(((1 - p) * (lighter_green - darker_green)) + darker_green);

            var color = "rgb(50," + green + ",60)";

            return color;
        };
        
        $scope.label_color_fn = function () { return 'white'; };

        if ($scope.tooltipFormatFn) {
            var tooltipFormatFn = $scope.$parent[$scope.tooltipFormatFn];
            if (! _(tooltipFormatFn).isFunction())
                throw new Error('tool-tip-format-fn attr must be a function in the parent scope');
            $scope.tooltip_format_fn = tooltipFormatFn;
        }
    };

    // Get the latest data and render the chart
    this.renderChart = function () {

        // Get the latest data

        var data = { children: get_flattened_data() };

        // Lay out the data

        var node = $scope.selection.selectAll('.node')
            .data($scope.pack_layout.nodes(data).filter(function(d) { return !d.children; }));

        // Handle added nodes

        var enter = node.enter().append('g')
            .attr('class', 'node');
        enter.append('title');
        enter.append('circle');
        enter.append('text')
            .attr('dy', '.3em')
            .style('text-anchor', 'middle')
            .style('font-size', '1vw')

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

        node.select('circle')
            .attr('r', function (datum) {
                return datum.r;
            })
            .style('fill', function (datum) {
                return fill_color_fn(datum.object);
            });

        node.select('text')
            .style('fill', function (datum) {
                return label_color_fn(datum.group);
            })
            .each(function(d) {
                var label = d.object[labelAttr].split(" ");
                var textNode = d3.select(this);
                textNode.selectAll("*").remove();
                console.log(label);
                label.forEach(function(word, iterator){
                    if(iterator == 0) {
                        if(label.length == 1) {
                            textNode.append("tspan").text(word).attr('x', 0).attr('dy', 5);
                        } else {
                            if(label.length > 2) {
                                textNode.append("tspan").text(word).attr('x', 0).attr('dy', -18*(label.length - 2));
                            } else {
                                textNode.append("tspan").text(word).attr('x', 0).attr('dy', 0);
                            }
                            
                        }
                    } else {
                        textNode.append("tspan").text(word).attr('x', 0).attr('dy', 18);
                    }
                    
                });
            });

        // Handle removed nodes

        node.exit().remove();
    };

})

;
