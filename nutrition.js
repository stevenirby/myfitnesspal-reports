/**
     Myfitnesspal Reports Bookmarklet Copyright 2013 Steven Irby

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
 *
 * @file
 * @author Steven Irby
 * @email "Steven Irby" [info@stevenirby.me]
 * @email "Moises Romero" [ezzygemini@gmail.com]
 * @since 2013
 * @version 2
 * @copyright Copyright 2013 Steven Irby
 */
// TODO - re-write time!
// - if something fails to download, try again for 2 more times, then give up,
// and show message saying, sorry didn't download
// - re-write so everything is asyncronous, so one data is downloaded, graph
// it. No waiting around for all the data to download. Lame.
// - add new default to drop-down "this week" starting from Monday.
(function () {

    /**
     * add method to Date for adding days
     * @memberof Date.prototype
     * @param days
     * @returns {Date}
     */
    Date.prototype.addDays = function(days) {
        var date = new Date(this.valueOf())
        date.setDate(date.getDate() + days);
        return date;
    };

    /**
     * @memberof Date.prototype
     * @param days
     * @returns {Date}
     */
    Date.prototype.removeDays = function(days) {
        var date = new Date(this.valueOf())
        date.setDate(date.getDate() - days);
        return date;
    };

    /**
     * add script to the page
     * @param src
     * @param cb
     */
    function addScript(src, cb) {
        var script = document.createElement('script');
        script.src = src;
        document.documentElement.appendChild(script);
        script.onload = function() {
            if (typeof(cb) === 'function') {
                cb();
            }
        };
    }

    /**
     * add script to the page
     * @param src
     * @param cb
     */
    function addLink(src, cb) {
        var link = document.createElement('link');
        link.href = src;
        link.type = "text/css";
        link.rel = "stylesheet";
        document.getElementsByTagName('head')[0].appendChild(link);
    }

    /**
     * Main Report Class
     * @constructor
     */
    function Report() {

        /**
         * Init script
         */
        this.init = function(){
            this.days = 364;
            this.dates = [];
            this.allGraphs = [];

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
            var modal = [
                    '<div class="modal"><h1>Generating Report Page</h1><h2>Please wait...</h2><h3>Downloading data for: <span></span></h3>',
                    '</div>'
                ],
                markup = [
                    '<div class="main">',
                    '   <h1>Your Progress at a Glance</h1>',
                    '   <div class="weight"><h4>Weight:</h4> <a href="#" title=""><h4 class="weightNumber"> </h4></a> <span class="arrow">&nbsp;</span>',
                    '       <sub><a href="#" title="This compares your current weight to your last weight in.">What\'s this?</a></sub>',
                    '   </div>',
                    '   <div class="calories"><h4>Net Calorie Average so far this week:</h4> <a href="#" title=""><h4 class="caloriesNumber"> </h4></a> <span class="arrow">&nbsp;</span>',
                    '       <sub><a href="#" title="This compares this weeks average with the an average from the last four weeks; before this week. This assumes you are trying to lose weight, not gain. :)">What\'s this?</a></sub>',
                    '   </div>',
                    '</div>',
                    '<hr style="width: 600px;"><br/>'
                ],
                me = this;

            $('body').append($(modal.join('')));


            this.cleanDom();

            $('#content').append($(markup.join('')));
            $( document ).tooltip();

            this.showModal();
            this.createDates();
            this.generateData();

            // wait for all the data before continuing on
            // TODO - what if there is an error?
            $.when.apply($, this.dfds).always(function () {
                me.setWeightTrend();
                me.setCarloriesTrend();
                me.addMasterGraph();
                me.addGraphs();
                me.hideModal();
                me.zoomAllGraphs();
            });

            return this;
        };

        this.showModal = function () {
            $('body').addClass('showModal');
        };

        this.hideModal = function () {
            $('body').removeClass('showModal');
            $('.main').show();
        };

        /**
         * generate list of dates for number of days
         */
        this.createDates = function () {
            var startDate,
                stopDate,
                currentDate,
                date = new Date();

            date.setDate(date.getDate() - this.days);

            startDate = date;
            stopDate = new Date();
            // set the dates to midnight, for better accuracy
            startDate.setHours(0,0,0,0);
            stopDate.setHours(0,0,0,0);

            currentDate = startDate;
            while (currentDate <= stopDate) {
                this.dates.push(currentDate.getTime());
                currentDate = currentDate.addDays(1);
            }
        };

        /**
         * generate data for graphs
         */
        this.generateData = function () {
            this.allData = {};
            var i, fields,
                x = 0, f = 0, field, key,
                me = this, n;

            // TODO - save data to local storage, if there is no new data to fetch....
            //      - not sure how to know if there is or isn't data to fetch, maybe if script is ran, within an hour of last being ran
            //        don't pull new data in?
            //      - maybe if local storage is used, I could add a message somewhere that says, clear cache or something....

            // iterate over segments nutrition, fitness, "1" (really why are they using "1"!?)
            for (key in this.segments) {
                // iterate over the fields
                if (this.segments.hasOwnProperty(key)) {
                    fields = this.segments[key];
                    // run through the fields (calories, sugar, fiber, etc.)
                    for (f = 0; f < fields.length; f++) {
                        me.allData[fields[f]] = [];
                        // push the chained function into a list of deferreds, so we can wait for them
                        // all to finsh. Of course, pass in the correct reffernces
                        me.dfds.push(me.fetchData(key, fields[f]).done($.proxy(function (fields, f, json) {
                            var data = json.data, value,
                                text = json.label;
                            $('.modal h3 span').text(text);
                            // get dates from first row string, and only do this once!
                            for (n = 0; n < me.dates.length; n++) {
                                if(!data[n] || data[n].total === undefined)
                                    continue;
                                value = data[n].total;
                                me.allData[fields[f]].push([me.dates[n], value]);
                            }
                        }, this, fields, f)));
                    }
                }
            }
        };

        /**
         * asynchronously request xml from myfitnesspal
         * @param segment
         * @param field
         * @returns {*}
         */
        this.fetchData = function (segment, field) {
            var url = 'https://www.myfitnesspal.com/reports/results/';
            url = url + segment + '/' + field + '/365.json'; // set this to 365 - weight loss data only comes in 7, 30, 90, and 365

            return $.ajax({
                type: 'GET',
                url: url,
                dataType: "json",
                success: function (json){
                    return json;
                }
            }).fail(function () {
                // TODO - retry?
            });
        };

        /**
         * clear the DOM of anything
         */
        this.cleanDom = function () {
            $('#content').empty();
        };

        /**
         * set the trending weight
         */
        this.setWeightTrend = function () {
            // first populate the progress part
            var weight = this.allData["1"].slice(-1)[0][1],
                lastWeight = 0,
                foundNumber = false,
                direction = 'down',
                color = 'green',
                i = this.allData["1"].length;

            // loop through years worth of weighins and find the last different one
            while (i-- && !foundNumber) {
                if (this.allData["1"][i][1] > 0 && this.allData["1"][i][1] !== weight) {
                    lastWeight = this.allData["1"][i][1];
                    if (lastWeight < weight) {
                        direction = 'up';
                        color = 'red';
                    }

                    foundNumber = true;
                }
            }

            var $content = $('#content'),
                tooltip = 'Was: ' + lastWeight + ' Now: ' + weight;

            $content.find('.main .weight .weightNumber').text(weight);
            $content.find('.main .weight .weightNumber').parent().attr('title', tooltip);
            $content.find('.main .weight .arrow').addClass(direction).addClass(color);
        };

        /**
         * set the calories trend:
         * - this looks at the current weeks average calorie count,
         * - against the all the previous weeks averages for the last month
         */
        this.setCarloriesTrend = function () {
            var d = new Date(),
                day = d.getDay(), // get current day 0 - 6
                thisWeeksAverage,
                lastMonthAverage,
                direction = 'up',
                color = 'red';

            // get this weeks average first
            if (day > 0) {
                thisWeeksAverage = this._getWeekAverage(d, d.removeDays(day));
                d = d.removeDays(day);
            } else {
                // since it's sunday, we want the whole week
                thisWeeksAverage = this._getWeekAverage(d, d.removeDays(7));
                d = d.removeDays(7);
            }

            // well just look at the last 28 days, so four weeks
            lastMonthAverage = this._getWeekAverage(d, d.removeDays(28));

            var direction, color;
            if (lastMonthAverage > thisWeeksAverage) {
                direction = 'down';
                color = 'green';
            }

            $('#content').find('.main .calories .caloriesNumber').text(thisWeeksAverage);

            var tooltip = 'Was: ' + lastMonthAverage + ' Now: ' + thisWeeksAverage;
            $('#content').find('.main .calories .caloriesNumber').parent().attr('title', tooltip);
            $('#content').find('.main .calories .arrow').addClass(direction).addClass(color);
        };

        /**
         * takes one or two date objects and returns the day for that range of dates
         * @param end
         * @param begin
         * @returns {number|*}
         * @private
         */
        this._getWeekAverage = function (end, begin) {
            var arr = this.allData['Net Calories'],
                from = this.dates.indexOf(begin.setHours(0,0,0,0)),
                to = this.dates.indexOf(end.setHours(0,0,0,0)),
                data = arr.slice(from, to),
                dataLength = data.length,
                i, sum = 0,
                average,
                value;

            for (i = 0; i < dataLength; i++) {
                value = parseFloat(data[i][1], 10);
                sum += value;
            }

            average = Math.round(sum / dataLength);

            if (!isNaN(average)) {
                return average;
            }
        };

        /**
         * Add the master graph which controls the zoom for all graphs
         */
        this.addMasterGraph = function () {
            this.masterGraph = new MasterGraph().init(this);
        };

        /**
         * create a new graph object for all fields
         */
        this.addGraphs = function () {
            this.allGraphs.push( new LookbackGraph().init(this) );

            var i, key, fields, fieldsLength;

            for (key in this.segments) {
                if (this.segments.hasOwnProperty(key)) {
                    fields = this.segments[key];
                    fieldsLength = fields.length;

                    for (i = 0; i < fieldsLength; i++) {
                        if (fields[i] !== '1') {
                            this.allGraphs.push(new SegmentGraph().init(this, fields[i]));
                        }
                    }
                }
            }
        };

        /**
         * zoom all graphs to specified range
         */
        this.zoomAllGraphs = function () {
            var i,
                range = this.range,
                graphsLength = this.allGraphs.length,
                graph;

            // loop though all graphs, and trigger the selected event, so graph
            // gets updated with new subset of data.
            for (i = 0; i < graphsLength; i++) {
                graph = this.allGraphs[i];

                // turn zooming mode on so plotselected does everything
                graph.zooming = true;
                graph.$graph.trigger('plotselected', [range]);
                graph.zooming = false;
            }
        };

    }


    /**
     * Base Graph
     * @constructor
     */
    function Graph(){

        /**
         * Initializes the graph
         * @returns {Graph}
         */
        this.init = function(){
            // needs to be overridden
            return this;
        };

        /**
         * Renders the graph
         * @returns {Graph}
         */
        this.graphData = function(){
            // needs to be overridden
            return this;
        }
    }

    /**
     * master graph controls zooming for all graphs
     * @constructor
     * @extends {Graph}
     */
    function MasterGraph(){
        /**
         * Initializes the graph
         * @param parent
         * @returns {MasterGraph}
         */
        this.init = function(parent){
            var markup = [
                '<div class="master">',
                '   <div class="dateRange"></div>',
                '   <div class="masterGraph"></div>',
                '   <div class="masterGraphDescription">',
                '       <h3>Click and drag - to select a range for all graphs</h3>',
                '       <select id="daySelect">',
                '           <option value="-1">Select Range</option>',
                '           <optgroup label="Days">',
                '               <option value="7">7 days</option>',
                '               <option value="14">14 days</option>',
                '               <option value="21">21 days</option>',
                '               <option value="28">28 days</option>',
                '           </optgroup>',
                '           <optgroup label="Months">',
                '               <option value="1m">1 month</option>',
                '               <option value="2m">2 month</option>',
                '               <option value="3m">3 month</option>',
                '               <option value="4m">4 month</option>',
                '               <option value="5m">5 month</option>',
                '               <option value="6m">6 month</option>',
                '           </optgroup>',
                '           <optgroup label="Year">',
                '               <option value="365">Whole year</option>',
                '           </optgroup>',
                '       </select>',
                '   </div>',
                '</div>'
            ];

            this._parent = parent;
            this.daysShown = 7; // default for how many days to show when page loads
            this.$container = $(markup.join(''));
            this.chartOptions = {
                grid: {
                    show: true,
                    aboveData: false,
                    axisMargin: 0,
                    borderWidth: 0,
                    clickable: false,
                    hoverable: false,
                    autoHighlight: false,
                    mouseActiveRadius: 50
                },
                xaxes: [
                    {mode: "time", labelWidth: 30}

                ],
                yaxes: [
                    {min: 0, show: false},
                    {show: false}
                ],
                series: {curvedLines: {active: true}},
                selection: {
                    mode: "x"
                },
                legend: {
                    show: false
                }
            };

            this.graphData();
            this.bindEvents();

            return this;
        };

        /**
         * graph the data
         */
        this.graphData = function () {
            var field = 'Net Calories';

            this.series = [{
                data : this._parent.allData[field],
                yaxis: 1
            },
                {
                    data : this._parent.allData['1'],
                    yaxis: 2
                }
            ];

            $('#content').append(this.$container);
            this.$graph = this.$container.find('.masterGraph');
            this.plot = $.plot(this.$graph, this.series, this.chartOptions);
            this.makeSelection();
            this.$container.find('#daySelect').val(this.daysShown);
            this.bindEvents();
        };

        /**
         * make a selection on the master graph for number of days shown
         */
        this.makeSelection = function () {
            var xaxis = {
                xaxis: this._getDatesFromRange(this.daysShown)
            };

            this.plot.setSelection(xaxis);
            this._parent.range = xaxis; // keep track of current data range for all graphs
            this._updateDateRange();
        };

        /**
         * update the range so user can see date range currently being shown
         * @private
         */
        this._updateDateRange = function () {
            var _from = new Date(this._parent.range.xaxis.from).setHours(0,0,0,0),
                _to = new Date(this._parent.range.xaxis.to).setHours(0,0,0,0),
                from = new Date(_from).toDateString(),
                to = new Date(_to).toDateString(),
                str = 'Selected Dates: ' + from + ' - ' + to;

            this.$container.find('.dateRange').text(str);
        };

        /**
         * take a number of days, and return the two dates
         * @param days
         * @returns {{from, to}}
         * @private
         */
        this._getDatesFromRange = function (days) {
            var now = new Date(),
                d = new Date(),
                day = d.getDay(),
                from = d.removeDays(days).setHours(0,0,0,0),
                to = now.setHours(0,0,0,0);

            // if this is set to months, then get that date instead
            if (('' + days).indexOf('m') > -1) {
                from = d.setMonth(d.getMonth() - parseInt(days.replace(/m/g, ''), 10));
                from = new Date(from).setHours(0,0,0,0);
            }

            return {from: from, to: to};
        };

        /**
         *  bind events for:
         *  - selecting the master graph
         *  - selecting a range from the drop down
         */
        this.bindEvents = function () {
            var me = this;

            this.$container.find('#daySelect').unbind('change').bind('change', function () {
                var value = $(this).val();

                if (value !== '-1') {
                    // if not a month, use the value for the days
                    me.dropdownChange = true;
                    me.daysShown = value;
                    me.makeSelection();
                    me._parent.zoomAllGraphs();
                    me.dropdownChange = false;
                }
            });

            this.$graph.bind('plotselecting', function (event, ranges) {
                if ($.type(ranges) !== 'null') {
                    me._parent.range = {
                        xaxis: {from: ranges.xaxis.from, to: ranges.xaxis.to}
                    }
                    me._updateDateRange();
                }
            });

            this.$graph.bind('plotselected', function (event, ranges, dropdown) {
                if ($.type(ranges) !== 'null') {
                    me._parent.range = {
                        xaxis: {from: ranges.xaxis.from, to: ranges.xaxis.to}
                    }
                    me._parent.zoomAllGraphs();
                    me._updateDateRange();

                    // is this being fired because of the drop down change or a chart selection?
                    // if it's not because of the drop down, then chance the drop down
                    if (!me.dropdownChange) {
                        me.$container.find('#daySelect').val(0);
                    }
                }
            });
        };
    }
    MasterGraph.prototype = new Graph();
    MasterGraph.prototype.constructor = MasterGraph;



    /**
     * Segment Graph
     * @constructor
     * @extends {Graph}
     */
    function SegmentGraph() {

        /**
         * Initializes the graph giving the ability to override the method
         * @param parent
         * @param field
         * @param   {String}    [opt_label]     The optional label (hard-coded)
         * @param   {Object}    [opt_chartOptions]  The chart options
         * @returns {SegmentGraph}
         */
        this.init = function(parent, field, opt_label, opt_chartOptions){
            var markup = [
                '<div class="graphContainer"> ',
                '    <h2></h2> <h3>Average: <span></span></h3>',
                '    <div class="selectionContainer"><p>You selected: <span class="selection"></span></p></div>',
                '    <div class="zoomContainer"><button class="zoom" type="button">Zoom in</button><a href="#" title="Click this to start zooming only for this graph. Just click and drag a region on the graph to select a custom range of dates.">What\'s this?</a></div>',
                '    <div class="zoomContainer"><button class="reportButton pauseZoom" type="button">Pause Zoom</button><a href="#" title="Click this to pause the zooming, so you can click on a date to see your diary for that day.">What\'s this?</a></div> ',
                '    <div class="zoomContainer"><button class="reportButton resumeZoom" type="button">Resume Zoom</button><a href="#" title="Click this to zoom again.">What\'s this?</a></div> ',
                '    <div class="zoomContainer"><button class="reportButton cancelZoom" type="button">Reset zoom</button><a href="#" title="Click this to go back to the default zoom. (What the main graph at the top is set to show.)">What\'s this?</a></div> ',
                '    <div class="graph"></div>',
                '    <span class="clickdata"></span>',
                '    <div class="legend"></div>',
                '</div> ',
            ];

            this._parent = parent; // lazily pass in parent
            this.field = field;
            this.zooming = false;
            this.$container = $(markup.join(''));
            this.$container.find('h2').text(opt_label || field);
            this.setAverage();
            this.previousHoverPoint = null;
            this.chartOptions = $.extend(true, {
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
                series: {curvedLines: {active: true}},
                selection: {
                    mode: "x"
                },
                legend: {
                    show: true,
                    position: 'nw',
                    container: this.$container.find('.legend'),
                    backgroundColor: null
                }
            }, opt_chartOptions);

            this.graphData();

            return this;
        };

        /**
         * get the average for the current range of data shown on graph
         * @param data
         * @returns {number|*}
         */
        this.setAverage = function (data) {
            var data = data || this._parent.allData[this.field],
                dataLength = data.length,
                i, sum = 0,
                average,
                value;

            for (i = 0; i < dataLength; i++) {
                value = parseFloat(data[i][1], 10);
                sum += value;
            }

            average = Math.round(sum / dataLength);

            if (!isNaN(average)) {
                this.$container.find('h3 span').text(average);
            }

            return average
        };

        /**
         * add graphs to the page
         * @param {Object[]}    [opt_series]
         */
        this.graphData = function (opt_series) {
            this.series = opt_series || [
                {
                    label: this.field,
                    data : this._parent.allData[this.field],
                    lines: { show: true, lineWidth: 3},
                    curvedLines: {apply:true},
                    yaxis: 1
                },
                {
                    label: 'Weight Loss',
                    data : this._parent.allData['1'],
                    lines: { show: true, lineWidth: 3},
                    curvedLines: {apply:true},
                    yaxis: 2
                }
            ];

            if (!this._parent.allData[this.field].length) {
                var $msg = ' <span>Opps! Failed to download this data. This happens because myfitnesspal took to long to send this data.</span>';
                this.$container.find('h2').after($msg);
            }
            $('#content').append(this.$container);
            this.$graph = this.$container.find('.graph');
            this.plot = $.plot(this.$graph, this.series, this.chartOptions);

            this._fixUpLegend();
            this.bindEvents();
        };

        /**
         * fix legend that breaks because of funky css on the page
         * @private
         */
        this._fixUpLegend = function () {
            this.$container.find('table').css('width', 'auto');
            this.$container.find('td').css({'border-bottom' : '0', 'vertical-align' : 'middle'});
            this.$container.find('.legendLabel').css('padding-left', '10px');
        };

        /**
         * @param dateObj
         * @param backwards
         * @returns {string}
         */
        this.convertDateToString = function (dateObj, backwards) {
            var d = new Date(parseInt(dateObj, 10)),
                month = d.getMonth() + 1,
                day = d.getDate(),
                year = d.getFullYear(),
                date = month + "-" + day + "-" + year;

            if (backwards) {
                date = year + "-" + month + "-" + day;
            }

            return date;
        };

        /**
         * bind all graph events
         */
        this.bindEvents = function () {
            var me = this;
            this.$container.find('.zoomContainer:eq(0)').show();
            this.$container.find('button').bind('click', $.proxy(me._zoomButton, me));
            this.$graph.bind('plothover', $.proxy(me._plotHover, me));
            this.$graph.bind('plotclick', $.proxy(me._plotclick, me));
            this.$graph.bind('plotselecting', $.proxy(me._plotselecting, me));
            this.$graph.bind('plotselected', $.proxy(me._plotselected, me));
        };

        /**
         * hide and show zoom buttons
         * @param event
         * @private
         */
        this._zoomButton = function (event) {
            var $clicked = $(event.currentTarget);

            if ($clicked.hasClass('zoom')) {
                // - turn on zooming
                // - hide the zoom button and show the cancel zoom button
                this.zooming = true;
                this.$container.find('.pauseZoom').show().parent().show();
                this.$container.find('.cancelZoom').show().parent().show();
                // show the selection range
                this.$container.find('.selectionContainer').show();
                $clicked.hide().parent().hide();
            } else if ($clicked.hasClass('pauseZoom')) {
                // pause the zooming
                this.zooming = false;
                this.$container.find('.resumeZoom').show().parent().show();
                $clicked.hide().parent().hide();
            } else if ($clicked.hasClass('resumeZoom')) {
                // resume zooming
                this.zooming = true;
                this.$container.find('.pauseZoom').show().parent().show();
                $clicked.hide().parent().hide();
            } else {
                // - turn off zooming
                // - show the zoom button
                // - reset the graph
                this.$container.find('.selectionContainer').hide();
                this.$container.find('.zoom').show().parent().show();
                this.zooming = false;
                this.plot = $.plot(this.$graph, this.series, this.chartOptions);
                this.setAverage();
                this._fixUpLegend();
                $clicked.hide().parent().hide();
                this.$container.find('.pauseZoom').hide().parent().hide();
                this.$container.find('.resumeZoom').hide().parent().hide();
            }
        };

        /**
         * show the tooltip when you hover over points on the graph
         * @param event
         * @param pos
         * @param item
         * @private
         */
        this._plotHover = function (event, pos, item) {
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
        };

        /**
         * open new page when point is clicked
         * @param event
         * @param pos
         * @param item
         * @private
         */
        this._plotclick = function (event, pos, item) {
            if (!this.zooming) {
                if (item) {
                    var x = item.datapoint[0].toFixed(2),
                        date = this.convertDateToString(x, true);

                    console.log('https://www.myfitnesspal.com/food/diary?date=' +  date);
                    window.open('https://www.myfitnesspal.com/food/diary?date=' +  date, '_blank');
                }
            }
        };

        /**
         * when selecting a range to zoom in on, show the selected date range
         * @param event
         * @param ranges
         * @private
         */
        this._plotselecting = function (event, ranges) {
            if (this.zooming && $.type(ranges) !== 'null') {
                var from = this.convertDateToString(ranges.xaxis.from.toFixed(1)),
                    to = this.convertDateToString(ranges.xaxis.to.toFixed(1)),
                    newData;

                this.$container.find('.selection').text(from + " to " + to);
                newData = this._getRangeOfData(ranges.xaxis.from, ranges.xaxis.to);
                this.setAverage(newData);
            } else {
                // not zooming, so clear the selection
                this.plot.clearSelection();
            }
        };

        /**
         * once an area on the graph has been selected, redraw the graph
         * @param event
         * @param ranges
         * @private
         */
        this._plotselected = function (event, ranges) {
            var newData;

            if (this.zooming) {
                this.plot = $.plot(this.$graph, this.series, $.extend(true, {}, this.chartOptions, {
                    xaxis: {
                        min: ranges.xaxis.from,
                        max: ranges.xaxis.to
                    }
                }));

                // sign... isn't that cute, its returning a random *time* in a day, where
                // the user selected! Not an exact date whole date. So get the full
                // nearest date to where they were selecting.
                newData = this._getRangeOfData(ranges.xaxis.from, ranges.xaxis.to);
                this.setAverage(newData);
                this._fixUpLegend();
            } else {
                // not zooming, so clear the selection
                this.plot.clearSelection();
            }
        };

        /**
         * take in range of and convert to dates, for range of data
         * @param axisFrom
         * @param axisTo
         * @returns {Array.<T>|string|Blob|ArrayBuffer}
         * @private
         */
        this._getRangeOfData = function (axisFrom, axisTo) {
            var from = this._parent.dates.indexOf(this._getFullDate(axisFrom)),
                to = this._parent.dates.indexOf(this._getFullDate(axisTo)),
                data = this._parent.allData[this.field].slice(from, to);

            return data;
        };

        /**
         * get the current date from some random time and date; at midnight
         * @param dateTime
         * @returns {number}
         * @private
         */
        this._getFullDate = function (dateTime) {
            var d = new Date(dateTime);
            d.setHours(0,0,0,0);
            return d.getTime();
        };

        /**
         * show the tooltip
         * @param x
         * @param y
         * @param contents
         * @private
         */
        this._showTooltip = function (x, y, contents) {
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
        };

    }
    SegmentGraph.prototype = new Graph();
    SegmentGraph.prototype.constructor = SegmentGraph;

    /**
     * Provides an extended base graph to look back on previous timelines
     * @extends {Graph}
     * @constructor
     */
    function LookbackGraph(){

        /**
         * Overrides the initialization configuration
         */
        this.init = function(parent){
            return Object.getPrototypeOf(this).init.call(this, parent, '1', 'Look back on your progress', {
                yaxes: [
                    {show:false}
                ]
            });
        };

        this.graphData = function(){

            var progressSeries = [
                    { data:[], weeksBefore:12, label:'3 months before', color:'#fefefe' },
                    { data:[], weeksBefore:4, label:'A month before', color:'#fafafa' },
                    { data:[], weeksBefore:3, label:'3 weeks before', color:'#ddd' },
                    { data:[], weeksBefore:2, label:'2 weeks before', color:'#bbb' },
                    { data:[], weeksBefore:1, label:'A week before', color:'#333' },
                    { data:[], weeksBefore:0, label:'Current progress', color:'#090', lineWidth:3 },
                ],
                progress = this._parent.allData['1'],
                min = 10000,
                mMin = Math.min,
                i, x;

            for(i = 0; i < progress.length; i++)
                min = mMin(progress[i][1], min);

            for(i = 0; i < progress.length; i++)
                for(x = 0; x < progressSeries.length; x++)
                    progressSeries[x].data.push([ progress[i][0], ( progress[i - progressSeries[x].weeksBefore * 7 ] || [] )[1] || min ]);

            return Object.getPrototypeOf(this).graphData.call(this, progressSeries.map(function(item){
                return {
                    data: item.data,
                    curvedLines: { apply:true },
                    lines: { show:true, lineWidth:item.lineWidth || 1 },
                    label: item.label,
                    yaxis: 2,
                    color: item.color
                };
            }));
        };

        /**
         * show the tooltip when you hover over points on the graph
         * @param event
         * @param pos
         * @param item
         * @private
         */
        this._plotHover = function (event, pos, item) {
            if (item) {
                if (this.previousHoverPoint != item.dataIndex) {
                    this.previousHoverPoint = item.dataIndex;
                    $("#tooltip").remove();
                    var text = item.datapoint[1];
                    if (this.zooming)
                        text = '* Pause / Reset zooming to click on a date! *';
                    this._showTooltip(item.pageX, item.pageY, text);
                }
            } else {
                $("#tooltip").remove();
                this.previousHoverPoint = null;
            }
        };

        /**
         * Simply override with an empty function. We don't need a click here.
         * @private
         */
        this._plotclick = function () {};

    }
    LookbackGraph.prototype = new SegmentGraph();
    LookbackGraph.prototype.constructor = LookbackGraph;


    addLink('https://www.stevenirby.me/wp-content/uploads/2013/02/style.css');
    // figureout a better way to do the css, since github is setting a bad mine type
    // addLink('http://raw.github.com/stevenirby/myfitnesspal-reports/master/css/style.css');
    addLink('https://code.jquery.com/ui/1.10.1/themes/base/jquery-ui.css');

    // add jQuery
    addScript('https://code.jquery.com/jquery-1.9.0.min.js', function () {
        addScript('https://code.jquery.com/ui/1.10.1/jquery-ui.js', function () {
            // add graphing library
            $(document).ready(function () {
                addScript('https://cdn.jsdelivr.net/gh/flot/flot/jquery.flot.min.js', function () {
                    addScript('https://cdn.jsdelivr.net/gh/flot/flot/jquery.flot.time.js', function () {
                        addScript('https://cdn.jsdelivr.net/gh/flot/flot@master/source/jquery.flot.selection.js', function () {
                            window.Report = new Report().init();
                        });
                    });
                });
            });
        });
    });
})();
