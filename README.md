## Getting Started

Ensure your Node and NPM versions are compatible:

```shell
→ node -v
v8.9.4

→ npm -v
5.6.0
```

Then:

2.  Run `npm install`
2.  Update file `test.js` with your Load Test details
3.  Run `[NUM_OF_THREADS= NUM_OF_REPETITIONS= MAX_TIME_BEFORE_STARTING_IN_MS=] npm start`

## Concepts

- Each test in composed by many steps
- Each step is a HTTP(S) request

## Environment Variables

- `NUM_OF_THREADS` - The number of tests threads to execute in parallel
- `NUM_OF_REPETITIONS` - After those threads finish, should we run it again?
- `MAX_TIME_BEFORE_STARTING_IN_MS` - Each thread starts after a random time. You can configure it

All environment variables are optional.

## Programming `test.js`

1.  Require `load-test-framework.js`
2.  Invoke its method `addStep` one or more times
3.  Remember: Your load test is composed by many steps that are ran one after another

Overview of method `addStep`:

```javascript
/**
 * Your load test is composed by one or more steps.
 * Call this method one or more time.
 *
 * @param {object} testParams
 *
 * @param {string} testParams.name
 * @param {string} testParams.method Must be a valid HTTP verb, in lower case
 * @param {object} testParams.headers Key is header name, Value is header value
 * @param {string} testParams.url IP + Port + Route. Protocol is optional
 * @param {number} testParams.expectedResponseCode A valid HTTP Response Code
 *
 * @param {boolean} [testParams.isHttps=false]
 * @param {object} [testParams.body] The data you're sending in the body, if any
 * @param {function} [testParams.assertionFunction] Receives `res` as parameter from Axios. You can assert its res.body
 * @param {number} [testParams.sleepBeforeNextStepInMs=0]
 *
 * @throws {Error} If provided parameters are invalid
 */
loadTestFramework.addStep = function({
  name,

  isHttps = false,

  method,
  url,
  body,
  headers = {},

  expectedResponseCode,
  assertionFunction = defaultAssertionFunction,

  sleepBeforeNextStepInMs = 0,

}) {
  // XXX: You can check the implementation at src/load-test-framework.js
};
```

Example of a valid `test.js`:

```javascript
const loadTestFramework = require('./src/load-test-framework');

const apiBaseUrl = 'http://localhost:8082/api';
const validEventId = 1;

loadTestFramework.addStep({
  name: 'Get Event Details',

  method: 'get',
  url: `${apiBaseUrl}/events/detail/${validEventId}`,

  expectedResponseCode: 200,
  sleepBeforeNextStepInMs: 1000,
});

// Add one or more steps here, if you want
```

## Extending the Report

1.  Once you have your load test defined, just invoke `loadTestFramework.runLoadTest` to retrieve its results
2.  The results are processed at `src/index.js`

Understanding method `runLoadTest`:

```javascript
/**
 * Run the load test you defined.
 *
 * @param {object} [suiteParams]
 *
 * @param {number} [suiteParams.numOfThreads=64]
 * @param {number} [suiteParams.numOfRepetitions=1]
 * @param {number} [suiteParams.maxTimeBeforeStartingInMs=8000]
 *
 * @throws {Error} If provided parameters are invalid
 *
 * @returns {Promise.< Array.<TestData>, Error >} testsData
 *
 * @typedef  {object} TestData
 * @property {string} id
 * @property {Array.<StepData>} stepsData
 * @property {boolean} succeeded
 * @property {string} error
 *
 * @typedef  {object} StepData
 * @property {number} responseTime In ms
 * @property {number} responseStatusCode
 * @property {boolean} succeeded
 * @property {string} error
 * @property {object} step The provided params to method loadTestFramework.addStep
 */
loadTestFramework.runLoadTest = function({
  numOfThreads = 64,
  numOfRepetitions = 1,
  maxTimeBeforeStartingInMs = 8000,

}) {
  // XXX: You can check the implementation at src/load-test-framework.js
};
```
