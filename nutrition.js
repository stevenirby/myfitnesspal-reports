(function () {
    
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

    var Nutritional = function () {
        this.days = 363;
        this.dates = [];

        this.segments = {
            nutrition : [
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


        // add modal markup to page
        $('body').append($('<div class="modal" style="display: none; position: fixed; z-index: 1000; top: 0;     left: 0; height: 100%; width: 100%; background: rgba( 255, 255, 255, .8 ) url(\'http://i.stack.imgur.com/FhHRx.gif\') 50% 50% no-repeat;"><h1>Generating Report Page</h1><h2>Please wait...</h2></div>'));

        this.showModal = function () {
            $('body').css('overflow', 'hidden');
            $('.modal').css('display', 'block');
        };

        this.hideModal = function () {
            $('body').css('overflow', 'auto');
            $('.modal').css('display', 'none');
        };

        this.cleanDom();
        this.showModal();
        this.createDates();
        this.generateData();
    };
    
    Nutritional.prototype.createDates = function () {
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
    };

    Nutritional.prototype.generateData = function () {
        /*
         * generate data for graphs
         */

        this.allData = {};
        var i, fields,
            x = 0, field, key,
            me = this, n; 

        //var dfds = $.Deferred();
        var dfds = [];
        for (key in this.segments) {
            if (this.segments.hasOwnProperty(key)) {
                fields = this.segments[key];
                // run through the fields (calories, sugar, fiber, etc.)
                $.each(fields, function (i, field) {
                    me.allData[field] = [];
                    dfds.push(me.fetchData(key, field).pipe(function (xml) {
                        var $xml = $(xml), value;

                        console.log('parsing date for: ' + field);
                        // get dates from first row string, and only do this once!
                        for (n = 0; n < me.dates.length; n++) {
                            value = $xml.find('row:eq(1) number:eq(' + n + ')').text();
                            me.allData[field].push([me.dates[n], value]);
                        }
                    }));
                });
            }
        }

        // wait for all the data before continuing on
        $.when.apply(null, dfds).then(function () {
            console.log('when');
            me.addGraphs();
            me.hideModal();
         });

         // TODO - what if there is an error?
    };
    
    Nutritional.prototype.fetchData = function (segment, field) {
        /*
         * asynchronously request xml from myfitnesspal
         */

        var url = 'http://www.myfitnesspal.com/reports/results/';
        //var url = 'http://localhost:1337/365.xml';
        url = url + segment + '/' + field + '/365';
        console.log(url);
        
        return $.ajax({
            type: 'GET',
            url: url,
            dataType: "xml",
            success: function (xml){
                return xml;  
            }
        });
    };
    
    Nutritional.prototype.cleanDom = function () {
        /*
         * clear the DOM of anything
         */

        $('#content').empty();
    };
    
    Nutritional.prototype.addGraphs = function () {
        /*
         * add graphs to the page
         */

        var $content = $('#content'),
            $div, $h2, i,
            key, fields, fieldsLength,
            graphStyle = 'width: 600px; height: 300px; padding: 0px; position: relative;';

        for (key in this.segments) {
            if (this.segments.hasOwnProperty(key)) {
                fields = this.segments[key];
                fieldsLength = fields.length;

                for (i = 0; i < fieldsLength; i++) {
                    $h2 = $('<h2>' + fields[i] + '</h2>');
                    $div = $('<div class="graph" style="' + graphStyle + '"></div>');

                    var d = [{
                        data : this.allData[fields[i]]
                    },
                    {
                        data : this.allData['1'],
                        yaxis: 2
                    }];

                    $.plot($div, d, {
                        xaxes: [
                            {mode: "time"}
                        ],
                        yaxes: [
                            {min: 0},
                            {position: 'right'}
                        ],
                        legend: {position : 'sw'}
                    });

                    $content.append($h2);
                    $content.append($div);
                }
            }
        }

        $content.append($div);
    };

    // add jQuery
    addScript('http://code.jquery.com/jquery-1.9.0.min.js', function () {
        // add graphing library
        $(document).ready(function () {
            addScript('http://people.iola.dk/olau/flot/jquery.flot.js', function () {
                window.Nutritional = new Nutritional();
            });
        });
    });
})();
