/*
Copyright 2013 Steven Irby

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

(function () {
   
    // add method to Date for adding days 
    Date.prototype.addDays = function(days) {
        var date = new Date(this.valueOf())
        date.setDate(date.getDate() + days);
        return date;
    }

    function addScript (src, cb) {
        // add script to the page
        var script = document.createElement('script');
        script.src = src;
        document.documentElement.appendChild(script);
        script.onload = function() {
            if (typeof(cb) === 'function') {
                cb();
            }
        };
    }

    var Report = function () {
        this.days = 364;
        this.dates = [];

        this.segments = {
            nutrition: [
                'Net Calories',
                'Calories',
                'Carbs',
                'Fat',
                'Protein',
                'Saturated Fat',
                'Polyunsaturated Fat',
                'Monounsaturated Fat',
                'Trans Fat',
                'Cholesterol',
                'Sodium',
                'Potassium',
                'Fiber',
                'Sugar',
                'Vitamin A',
                'Vitamin C',
                'Iron',
                'Calcium'
            ],
            fitness: [
                'Calories Burned',
                'Exercise Minutes'
            ],
            progress: [
                '1'
            ]
        };
        
        this.dfds = [];

        // add modal markup to page
        $('body').append($('<div class="modal" style="display: none; position: fixed; z-index: 1000; top: 0; left: 0; height: 100%; width: 100%; background: rgba( 255, 255, 255, .8 ) url(\'http://i.stack.imgur.com/FhHRx.gif\') 50% 50% no-repeat;"><h1>Generating Report Page</h1><h2>Please wait...</h2></div>'));

        this.cleanDom();
        this.showModal();
        this.createDates();
        this.generateData();
       
        var me = this; 
        // wait for all the data before continuing on
        // TODO - what if there is an error?
        $.when.apply(null, this.dfds).then(function () {
            me.addGraphs();
            me.hideModal();
        });
    };

    Report.prototype = {
        showModal: function () {
            $('body').css('overflow', 'hidden');
            $('.modal').css('display', 'block');
        },
        hideModal: function () {
            $('body').css('overflow', 'auto');
            $('.modal').css('display', 'none');
        },
        createDates: function () {
            /*
             * generate list of dates for number of days
             */

            var startDate,
                stopDate,
                currentDate,
                date = new Date();
            
            date.setDate(date.getDate() - this.days);
            
            startDate = date;
            stopDate = new Date();
            
            currentDate = startDate;
            while (currentDate <= stopDate) {
               this.dates.push(currentDate.getTime());
               currentDate = currentDate.addDays(1);
            }
        },
        generateData: function () {
            /*
             * generate data for graphs
             */

            this.allData = {};
            var i, fields,
                x = 0, field, key,
                me = this, n; 

            for (key in this.segments) {
                if (this.segments.hasOwnProperty(key)) {
                    fields = this.segments[key];
                    // run through the fields (calories, sugar, fiber, etc.)
                    $.each(fields, function (i, field) {
                        me.allData[field] = [];
                        me.dfds.push(me.fetchData(key, field).pipe(function (xml) {
                            var $xml = $(xml), value;

                            console.log('creating data for: ' + field);
                            // get dates from first row string, and only do this once!
                            for (n = 0; n < me.dates.length; n++) {
                                value = $xml.find('row:eq(1) number:eq(' + n + ')').text();
                                me.allData[field].push([me.dates[n], value]);
                            }
                        }));
                    });
                }
            }
        },
        fetchData: function (segment, field) {
            /*
             * asynchronously request xml from myfitnesspal
             */

            //var url = 'http://localhost:1337/365.xml';
            var url = 'http://www.myfitnesspal.com/reports/results/';
            url = url + segment + '/' + field + '/365'; // set this to 365 - weight loss data only comes in 7, 30, 90, and 365
            console.log(url);
            
            return $.ajax({
                type: 'GET',
                url: url,
                dataType: "xml",
                success: function (xml){
                    return xml;  
                }
            });
        },
        cleanDom: function () {
            /*
             * clear the DOM of anything
             */

            $('#content').empty();
        },
        addGraphs: function () {
            /*
             * create a new graph object for all fields
             */

            var i, key, fields, fieldsLength;

            for (key in this.segments) {
                if (this.segments.hasOwnProperty(key)) {
                    fields = this.segments[key];
                    fieldsLength = fields.length;

                    for (i = 0; i < fieldsLength; i++) {
                        if (fields[i] !== '1') {
                            new Graph(this, fields[i]);
                        }
                    }
                }
            }
        }
    };
        
    var Graph = function (parent, field) {
        var markup = [
            '<div class="graphContainer"> ',
            '    <h2></h2> ',
            '    <div class="selectionContainer" style="display: none;"><p>You selected: <span class="selection"></span></p></div>',
            '    <p><button class="zoom" type="button" style="-moz-box-shadow:inset 0px 1px 0px 0px #ffffff;',
            ' -webkit-box-shadow:inset 0px 1px 0px 0px #ffffff; box-shadow:inset 0px 1px 0px 0px #ffffff; background:-webkit-gradient( linear, left top, left bottom, color-stop(0.05, #ededed), color-stop(1, #dfdfdf) ); background:-moz-linear-gradient( center top, #ededed 5%, #dfdfdf 100% ); background-color:#ededed; -moz-border-radius:6px; -webkit-border-radius:6px; border-radius:6px; border:1px solid #dcdcdc; color:#777777; font-family:arial; font-size:15px; font-weight:bold; padding:6px 24px; text-decoration:none; text-shadow:1px 1px 0px #ffffff;">Zoom in</button></p> ',
            '',
            '    <p><button class="pauseZoom" type="button" style="display: none; -moz-box-shadow:inset 0px 1px 0px 0px #ffffff;',
            ' -webkit-box-shadow:inset 0px 1px 0px 0px #ffffff; box-shadow:inset 0px 1px 0px 0px #ffffff; background:-webkit-gradient( linear, left top, left bottom, color-stop(0.05, #ededed), color-stop(1, #dfdfdf) ); background:-moz-linear-gradient( center top, #ededed 5%, #dfdfdf 100% ); background-color:#ededed; -moz-border-radius:6px; -webkit-border-radius:6px; border-radius:6px; border:1px solid #dcdcdc; color:#777777; font-family:arial; font-size:15px; font-weight:bold; padding:6px 24px; text-decoration:none; text-shadow:1px 1px 0px #ffffff;">Pause Zoom</button></p> ',
            '',
            '    <p><button class="resumeZoom" type="button" style="display: none; -moz-box-shadow:inset 0px 1px 0px 0px #ffffff;',
            ' -webkit-box-shadow:inset 0px 1px 0px 0px #ffffff; box-shadow:inset 0px 1px 0px 0px #ffffff; background:-webkit-gradient( linear, left top, left bottom, color-stop(0.05, #ededed), color-stop(1, #dfdfdf) ); background:-moz-linear-gradient( center top, #ededed 5%, #dfdfdf 100% ); background-color:#ededed; -moz-border-radius:6px; -webkit-border-radius:6px; border-radius:6px; border:1px solid #dcdcdc; color:#777777; font-family:arial; font-size:15px; font-weight:bold; padding:6px 24px; text-decoration:none; text-shadow:1px 1px 0px #ffffff;">Resume Zoom</button></p> ',
            '',
            '    <p><button class="cancelZoom" type="button" style="display: none; -moz-box-shadow:inset 0px 1px 0px 0px #ffffff;',
            ' -webkit-box-shadow:inset 0px 1px 0px 0px #ffffff; box-shadow:inset 0px 1px 0px 0px #ffffff; background:-webkit-gradient( linear, left top, left bottom, color-stop(0.05, #ededed), color-stop(1, #dfdfdf) ); background:-moz-linear-gradient( center top, #ededed 5%, #dfdfdf 100% ); background-color:#ededed; -moz-border-radius:6px; -webkit-border-radius:6px; border-radius:6px; border:1px solid #dcdcdc; color:#777777; font-family:arial; font-size:15px; font-weight:bold; padding:6px 24px; text-decoration:none; text-shadow:1px 1px 0px #ffffff;">Reset zoom</button></p> ',
            '',
            '    <div class="graph" style="width: 800px; height: 400px; position: relative; box-sizing: border-box; ',
            '    padding: 20px 15px 15px 15px; margin: 10px auto 5px 0; border: 1px solid #ddd; background: #fff; ',
            '    background: linear-gradient(#f6f6f6 0, #fff 50px); background: -o-linear-gradient(#f6f6f6 0, #fff 50px); ',
            '    background: -ms-linear-gradient(#f6f6f6 0, #fff 50px); background: -moz-linear-gradient(#f6f6f6 0, #fff 50px); ',
            '    background: -webkit-linear-gradient(#f6f6f6 0, #fff 50px); ',
            '    box-shadow: 0 3px 10px rgba(0,0,0,0.15); -o-box-shadow: 0 3px 10px rgba(0,0,0,0.1); ',
            '    -ms-box-shadow: 0 3px 10px rgba(0,0,0,0.1); -moz-box-shadow: 0 3px 10px rgba(0,0,0,0.1); ',
            '    -webkit-box-shadow: 0 3px 10px rgba(0,0,0,0.1);"></div> ',
            '    <span class="clickdata"></span> ',
            '    <div class="legend" style="width: 200px;"></div>',
            '</div> ',
        ];
        
        this._parent = parent; // lazily pass in parent
        this.field = field;
        this.zooming = false;
        this.$container = $(markup.join(''));
        this.$container.find('h2').text(field);
        this.previousHoverPoint = null;
        this.chartOptions = {
            grid: {
                aboveData: false,
                axisMargin: 0,
                borderWidth: 0,
                clickable: true,
                hoverable: true,
                autoHighlight: true,
                mouseActiveRadius: 50
            },
            xaxes: [
                {mode: "time", labelWidth: 30},
            
            ],
            yaxes: [
                {min: 0},
                {position: 'right', labelWidth: 30}
            ],
	        selection: {
	        	mode: "x"
	        },
            legend: {
                show: true,
                position: 'nw',
                container: this.$container.find('.legend'),
                backgroundColor: null
            }
        };

        this.graphData();
    };
    
    Graph.prototype = {
        graphData: function () {
            /*
             * add graphs to the page
             */

            this.graphData = [{
                    label: this.field,
                    data : this._parent.allData[this.field],
                    yaxis: 1
                },
                {
                    label: 'Weight Loss',
                    data : this._parent.allData['1'],
                    yaxis: 2
                }
            ];

            $('#content').append(this.$container);
            this.$graph = this.$container.find('.graph');
            this.plot = $.plot(this.$graph, this.graphData, this.chartOptions);

            this._fixUpLegend();
            this.bindEvents();
        },
        _fixUpLegend: function () {
            /*
             * errrr stupid legend and bad css on the page
             */
            
            this.$container.find('table').css('width', 'auto');
            this.$container.find('td').css({'border-bottom' : '0', 'vertical-align' : 'middle'});
            this.$container.find('.legendLabel').css('padding-left', '10px');
        },
        convertDateToString: function (dateObj, backwards) {
            var d = new Date(parseInt(dateObj, 10)),
                month = d.getMonth() + 1,
                day = d.getDate(),
                year = d.getFullYear(),
                date = month + "-" + day + "-" + year;

            if (backwards) {
                date = year + "-" + month + "-" + day;
            }
            
            return date; 
        },
        bindEvents: function () {
            /*
             * bind all graph events
             */

            var me = this;

            this.$container.find('button').bind('click', $.proxy(me._zoomButton, me));
	    	this.$graph.bind('plothover', $.proxy(me._plotHover, me));
	    	this.$graph.bind('plotclick', $.proxy(me._plotclick, me));
            this.$graph.bind('plotselecting', $.proxy(me._plotselecting, me));
            this.$graph.bind('plotselected', $.proxy(me._plotselected, me));
        },
        _zoomButton: function (event) {
            /*
             * hide and show zoom buttons
             */
            var $clicked = $(event.currentTarget);
            
            if ($clicked.hasClass('zoom')) {
                // - turn on zooming
                // - hide the zoom button and show the cancel zoom button
                this.zooming = true;
                this.$container.find('.pauseZoom').show();
                this.$container.find('.cancelZoom').show();
                // show the selection range
                this.$container.find('.selectionContainer').show();
                $clicked.hide();
            } else if ($clicked.hasClass('pauseZoom')) {
                // pause the zooming
                this.zooming = false;
                this.$container.find('.resumeZoom').show();
                $clicked.hide();
            } else if ($clicked.hasClass('resumeZoom')) {
                // resume zooming
                this.zooming = true;
                this.$container.find('.pauseZoom').show();
                $clicked.hide();
            } else {
                // - turn off zooming
                // - show the zoom button
                // - reset the graph 
                this.$container.find('.selectionContainer').hide();
                this.$container.find('.zoom').show();
                this.zooming = false;
                this.plot = $.plot(this.$graph, this.graphData, this.chartOptions);
                this._fixUpLegend();
                $clicked.hide();
                this.$container.find('.pauseZoom').hide();
                this.$container.find('.resumeZoom').hide();
            }
        },
        _plotHover: function (event, pos, item) {
            /*
             * show the tooltip when you hover over points on the graph
             */
            if (item) {
            	if (this.previousHoverPoint != item.dataIndex) {

            		this.previousHoverPoint = item.dataIndex;

            		$("#tooltip").remove();
            		var x = item.datapoint[0].toFixed(2),
                        date = this.convertDateToString(x),
                        text = 'Click to see what you ate on this date: ' + date;

                    if (this.zooming) {
                        text = '* Pause / Reset zooming to click on a date! *';
                    }
            		
                    this._showTooltip(item.pageX, item.pageY, text);
            	}
            } else {
            	$("#tooltip").remove();
            	this.previousHoverPoint = null;            
            }
        },
        _plotclick: function (event, pos, item) {
            /*
             * open new page when point is clicked
             */

            if (!this.zooming) {
	            if (item) {
                    var x = item.datapoint[0].toFixed(2),
                        date = this.convertDateToString(x, true);

                        console.log('http://www.myfitnesspal.com/food/diary?date=' +  date);
                        window.open('http://www.myfitnesspal.com/food/diary?date=' +  date, '_blank');
	    	    }
            }
        },
        _plotselecting: function (event, ranges) {
            /*
             * when selecting a range to zoom in on, show the selected date
             * range
             */
            if (this.zooming && $.type(ranges) !== 'null') {
                var from = this.convertDateToString(ranges.xaxis.from.toFixed(1)),
                    to = this.convertDateToString(ranges.xaxis.to.toFixed(1));

                this.$container.find('.selection').text(from + " to " + to);
            } else {
                // not zooming, so clear the selection
                this.plot.clearSelection();
            }
        },
        _plotselected: function (event, ranges) {
            /*
             * once an area on the graph has been selected, redraw the graph
             */

            if (this.zooming) {
                this.plot = $.plot(this.$graph, this.graphData, $.extend(true, {}, this.chartOptions, {
                    xaxis: {
                    	min: ranges.xaxis.from,
                    	max: ranges.xaxis.to
                    }
	    	    }));
                this._fixUpLegend();
            } else {
                // not zooming, so clear the selection
                this.plot.clearSelection();
            }
        },
        _showTooltip: function (x, y, contents) {
            /*
             * show the tooltip
             */
	        $('<div id="tooltip">' + contents + '</div>').css({
	    	    position: "absolute",
	    	    display: "none",
	    	    top: y + 5,
	    	    left: x + 5,
	    	    border: "1px solid #fdd",
	    	    padding: "2px",
	    	    "background-color": "#fee",
	    	    opacity: 0.80
	    	}).appendTo("body").fadeIn(200);
        }
    };

    // add jQuery
    addScript('http://code.jquery.com/jquery-1.9.0.min.js', function () {
        // add graphing library
        $(document).ready(function () {
            addScript('http://raw.github.com/flot/flot/master/jquery.flot.js', function () {
                addScript('http://raw.github.com/flot/flot/master/jquery.flot.time.js', function () {
                    addScript('http://raw.github.com/flot/flot/master/jquery.flot.selection.js', function () {
                        window.Report = new Report();
                    });
                });
            });
        });
    });
})();
