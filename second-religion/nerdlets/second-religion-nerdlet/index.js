import React from 'react';

import { LineChart, NerdGraphQuery, Spinner } from 'nr1';

const GET_ERROR_BUDGET = `{
  actor {
    account(id: 2230556) {
      a: nrql(query: "SELECT (1 - 0.993) * count(*) AS 'a' FROM Transaction SINCE 1 month ago") {
        results
      }
      b: nrql(query: "SELECT count(*) as 'b' FROM Transaction where error is true timeseries SINCE 1 month ago") {
        results
      }
    }
  }
}`;

// https://docs.newrelic.com/docs/new-relic-programmable-platform-introduction

export default class SecondReligionNerdletNerdlet extends React.Component {
    state = {
        objErrorBudget: [],
        objErrors: [],
        objErrorBudgetRemaining: [], //dataErrorBudget - dataErrors;
        objTrendErrors: [],
        objTrendErrorBudget: []
    }

    componentDidMount() {
        this.loadData()
    }

    async loadData() {
        const { data } = await NerdGraphQuery.query({ query: GET_ERROR_BUDGET })
        // I would like to calculate our error budget (A) over 30 days 
        //      `SELECT (1 - 0.993) * count(*) AS 'a' FROM Transaction SINCE 1 month ago`
        // , then plot a graph which subtracts B 
        //      `SELECT count(*) as 'b' FROM Transaction where error is true timeseries  SINCE 1 month ago`
        // from that on a daily/hourly/timeseries basis
        this.processData(data.actor.account.a.results[0].a, data.actor.account.b.results);
    }

    processData(dataErrorBudget, dataErrors) {
        // define objects that will be used for visualizing the data
        var objErrorBudget = [];
        var objErrors = [];
        var objErrorBudgetRemaining = []; //dataErrorBudget - dataErrors;
        var objTrendErrors = [];
        var objTrendErrorBudget = [];

        // define some helper variables
        var countEvents = 0;
        var currentErrors = 0;
        var remainingErrorBudget = dataErrorBudget;
        var currentTimestamp = dataErrors[0].endTimeSeconds;

        // loop through the timeseries buckets for requests with errors
        dataErrors.forEach(result => {
            // increase the error count
            currentErrors = currentErrors + result.b;

            // deduct it from the remaining error budget
            if (remainingErrorBudget - result.b > 0) {
                remainingErrorBudget = remainingErrorBudget - result.b;
            }
            else {
                remainingErrorBudget = 0;
            }

            // create and push new timeseries buckets 
            currentTimestamp = result.endTimeSeconds;
            var dataPointErrorBudget = { x: result.endTimeSeconds * 1000, y: dataErrorBudget };
            var dataPointErrors = { x: result.endTimeSeconds * 1000, y: currentErrors };
            var dataPointErrorBudgetRemaining = { x: result.endTimeSeconds * 1000, y: remainingErrorBudget };
            objErrorBudget.push(dataPointErrorBudget);
            objErrors.push(dataPointErrors);
            objErrorBudgetRemaining.push(dataPointErrorBudgetRemaining);

            // increase the event count
            countEvents++;
        })

        // calculate the average number of errors per event count
        // note: here we could also use some more realistic calculations such as logarithmic functions, etc.
        var avgErrs = currentErrors / countEvents;

        // how far do we want to look into the future, i.e. how many time buckets
        var trendIterations;
        for (trendIterations = 0; trendIterations < 20; trendIterations++) {
            // increase error count with average errors per bucket
            currentErrors = currentErrors + avgErrs;

            // deduct average errors from the remaining error budget
            if (remainingErrorBudget - avgErrs > 0) {
                remainingErrorBudget = remainingErrorBudget - avgErrs;
            }
            else {
                remainingErrorBudget = 0;
            }

            // create and push new timeseries buckets 
            objErrorBudget.push({ x: currentTimestamp * 1000, y: dataErrorBudget });
            objTrendErrors.push({ x: currentTimestamp * 1000, y: currentErrors });
            objTrendErrorBudget.push({ x: currentTimestamp * 1000, y: remainingErrorBudget });

            // add one future trend event per day
            currentTimestamp = currentTimestamp + (60 * 60 * 24);
        }

        // save the visualization objects in state
        this.setState({ objErrorBudget: objErrorBudget })
        this.setState({ objErrors: objErrors })
        this.setState({ objErrorBudgetRemaining: objErrorBudgetRemaining })
        this.setState({ objTrendErrors: objTrendErrors })
        this.setState({ objTrendErrorBudget: objTrendErrorBudget })
    }

    render() {
        // retrieve the visualization objects from state
        const { objErrorBudget, objErrors, objErrorBudgetRemaining, objTrendErrors, objTrendErrorBudget } = this.state;

        // show spinner if no data available yet
        if (objErrorBudget == null ||
            objErrorBudget == undefined ||
            objErrorBudget == 'undefined' ||
            objErrorBudget == '') {
            return <div style={{ padding: "12px", height: "600px" }}><Spinner /></div>
        }
        else {
            // create custom visualization object for chart
            let vizData = [
                {
                    metadata: {
                        id: 'series-1',
                        label: 'Error budget',
                        color: 'green',
                        viz: 'main',
                        unitsData: { "x": "timestamp", "y": "count" }
                    },
                    data:
                        objErrorBudget
                },
                {
                    metadata: {
                        id: 'series-2',
                        label: 'Errors',
                        color: '#000000',
                        viz: 'main',
                        unitsData: { "x": "timestamp", "y": "count" }
                    },
                    data:
                        objErrors
                },
                {
                    metadata: {
                        id: 'series-3',
                        label: 'Error Budget remaining',
                        color: '#CC00BB',
                        viz: 'main',
                        unitsData: { "x": "timestamp", "y": "count" }
                    },
                    data:
                        objErrorBudgetRemaining
                },
                {
                    metadata: {
                        id: 'series-4',
                        label: 'Trend Errors',
                        color: 'darkgrey',
                        viz: 'main',
                        unitsData: { "x": "timestamp", "y": "count" }
                    },
                    data:
                        objTrendErrors
                },
                {
                    metadata: {
                        id: 'series-5',
                        label: 'Trend Error Budget',
                        color: 'blue',
                        viz: 'main',
                        unitsData: { "x": "timestamp", "y": "count" }
                    },
                    data:
                        objTrendErrorBudget
                }
            ];

            // display the line chart with error budget, trends and all other data
            return (
                <div style={{ padding: "12px", height: "600px" }}>
                    <div><h2>Prognose Fehler-Budget</h2></div>
                    <LineChart fullWidth fullHeight data={vizData} />
                </div>
            );
        }
    }
}
