const Promise = require('bluebird');
const axios = require('axios');
const expect = require('chai').expect;
const generateUid = require('uuid/v4');
const sleep = require('sleep-promise');
const getRandomIntUntil = require('random-int');

const loadTestFramework = {
  steps: [],
};

/**
 * Your load test is composed by one or more steps.
 * Call this method one or more time.
 *
 * @param {object} testParams
 *
 * @param {string} testParams.name
 * @param {string} testParams.method Must be a valid HTTP verb, in lower case
 * @param {string} testParams.url IP + Port + Route. Protocol is optional
 * @param {number} testParams.expectedResponseCode A valid HTTP Response Code
 *
 * @param {boolean} [testParams.isHttps=false]
 * @param {object | string} [testParams.body] The data you're sending in the body, if any
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
  body = null,
  headers = {},

  expectedResponseCode,
  assertionFunction = defaultAssertionFunction,

  sleepBeforeNextStepInMs = 0,

}) {
  if (!name) {
    throw new Error('Parameter "name" must be provided');
  }

  if (!method) {
    throw new Error('Parameter "method" must be provided');
  }

  if (!url) {
    throw new Error('Parameter "url" must be provided');
  }

  if (sleepBeforeNextStepInMs < 0) {
    throw new Error('Parameter "sleepBeforeNextStepInMs" must be greather than  or equal 0');
  }

  const normalizedUrl = normalizeUrl({
    url,
    protocol: isHttps ? 'https' : 'http',
  });

  if (!expectedResponseCode || expectedResponseCode < 100 || expectedResponseCode >= 600) {
    throw new Error('Parameter "expectedResponseCode" must be provided and be a valid HTTP Response Code');
  }

  const allowedMethods = [
    'get',
    'head',
    'post',
    'put',
    'patch',
    'delete',
  ];

  const isValidMethod = allowedMethods.find(allowedMethod => allowedMethod === method);

  if (!isValidMethod) {
    throw new Error('Parameter "method" must be a valid HTTP Verb in lower case');
  }

  const jsonHeaders = {
    'Content-Type': 'application/json',
    'Accept-Type': 'application/json',
  };

  this.steps.push({
    name,
    isHttps,
    method,
    url: normalizedUrl,
    body,
    headers: Object.assign(jsonHeaders, headers),
    expectedResponseCode,
    assertionFunction,
    sleepBeforeNextStepInMs,
  });
};

/**
 * Run the load test you defined.
 *
 * @param {object} [suiteParams]
 *
 * @param {number} [suiteParams.numOfThreads=1]
 * @param {number} [suiteParams.numOfRepetitions=1]
 * @param {number} [suiteParams.maxTimeBeforeStartingInMs=0]
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

  currentRepetition = 1,
  testDataAccumulator = [],

}) {
  if (!numOfThreads || numOfThreads < 1) {
    throw new Error('Parameter "numOfThreads" must be provided and greather than 0');
  }
  if (!numOfRepetitions || numOfRepetitions < 1) {
    throw new Error('Parameter "numOfRepetitions" must be provided and greather than 0');
  }
  if (maxTimeBeforeStartingInMs === null || maxTimeBeforeStartingInMs === undefined || maxTimeBeforeStartingInMs < 0) {
    throw new Error('Parameter "maxTimeBeforeStartingInMs" must be provided and greather than or equal 0');
  }

  if (currentRepetition > numOfRepetitions) {
    return Promise.resolve(testDataAccumulator);
  }

  console.log(`Starting Repetition ${currentRepetition} / ${numOfRepetitions}`);
  const testThreads = [];

  for (let i = 0; i < numOfThreads; i++) {
    const timeBeforeStarting = getRandomIntUntil(maxTimeBeforeStartingInMs);

    testThreads.push(
      sleep(timeBeforeStarting).then(() => runTest(this.steps) )
    );
  }

  return Promise.all(testThreads)
    .tap(
      testsData => addFieldRepetition(testsData, currentRepetition)
    )

    .then(testsData => {
      return loadTestFramework.runLoadTest({
        numOfThreads,
        numOfRepetitions,
        maxTimeBeforeStartingInMs,

        currentRepetition: currentRepetition + 1,
        testDataAccumulator: testDataAccumulator.concat(testsData),
      });
    })
  ;
};

function runTest(steps) {
  if (steps.length < 1) {
    return Promise.reject(
      new Error('Received no Steps to compose a Test')
    );
  }

  const testData = {
    id: generateUid(),
    stepsData: [],
    succeeded: true,
    error: null,
  };

  console.log(`Starting test ${testData.id} ...`);

  const testPromise = steps.reduce((testPromise, step) => {
    return testPromise.then(() => {

      return runStep(step)
        .tap(
          stepData => storeStepData(testData, stepData)
        )

        .then(
          stepData => abortTestIfNecessary(stepData)
        )

        .then(
          () => sleep(step.sleepBeforeNextStepInMs)
        )
      ;

    });
  }, Promise.resolve());

  return testPromise
    .catch(error => {
      testData.succeeded = false;
      testData.error = `Test "${testData.i}" failed: ${error}`;

      return Promise.resolve(testData);
    })

    .then(() => {
      console.log(`Finished test ${testData.id}`);
      return Promise.resolve(testData);
    })
  ;
}

function openHttpRequest(sameParamsAxiosAccept) {
  if (!sameParamsAxiosAccept.data) delete sameParamsAxiosAccept.data;

  const promise = new Promise((resolve, reject) => {
    axios(sameParamsAxiosAccept)
      .then(resolve)

      .catch(
        error => resolve(error.response)
      )
    ;
  });

  return promise;
}

function runStep(step) {
  if (!step) {
    throw new Error('No Step provided');
  }

  const timeBeforeStep = Date.now();

  const stepData = {
    responseTime: null,
    responseStatusCode: null,
    succeeded: true,
    error: null,
    step: Object.assign({}, step),
  };

  return openHttpRequest({
    method: step.method,
    url: step.url,
    data: step.body,
    headers: step.headers,

  }).tap(res => {
    stepData.responseTime = computeElapsedTime(timeBeforeStep);
    stepData.responseStatusCode = res ? res.status : null;

  }).then(
    res => assertStatusCode(res, step.expectedResponseCode)

  ).then(
    res => applyUserAssertions(res, step.assertionFunction)

  )
    .catch(error => {
      stepData.succeeded = false;
      stepData.error = `Step "${step.name}" failed: ${error}`;

      return Promise.resolve(stepData);

    })
    .then(res => {
      return Promise.resolve(stepData);
    });
}

function normalizeUrl({ url, protocol }) {
  const hasProtocol = url.indexOf('http') !== -1;
  return hasProtocol ? url : protocol + '://' + url;
}

function computeElapsedTime(time) {
  return Date.now() - time;
}

function assertStatusCode(res, expectedStatusCode) {
  try {
    expect(res).to.exist;
    expect(res.status).to.be.equal(expectedStatusCode);

  } catch (error) {
    const body = res ? JSON.stringify(res.data) : null;

    return Promise.reject(
      new Error(`Got errors asserting the Status Code: ${error} -> Received body: ${body}`)
    );
  }

  return Promise.resolve(res);
}

function applyUserAssertions(res, assertionFunction) {
  try {
    assertionFunction(res);

  } catch (error) {
    const body = res ? JSON.stringify(res.data) : null;

    return Promise.reject(
      new Error(`Got errors asserting Response: ${error} -> Received body: ${body}`)
    );
  }

  return Promise.resolve(res);
}

function defaultAssertionFunction(res) {
  expect(res).to.exist;
  expect(res).to.have.property('data');
}

function addFieldRepetition(testsData, repetitionIndex) {
  testsData.forEach(testData => {
    testData.repetition = repetitionIndex;
  });
}

function storeStepData(testData, stepData) {
  testData.stepsData.push(stepData);
}

function abortTestIfNecessary(stepData) {
  if (stepData.succeeded) return Promise.resolve();

  return Promise.reject(
    new Error(`Aborting Test due a step error: ${stepData.error}`)
  );
}

module.exports = loadTestFramework;
