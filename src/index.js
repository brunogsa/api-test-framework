const loadTestFramework = require('./load-test-framework');
const utilities = require('./utilities');

const numOfThreads = parseInt(process.env.NUM_OF_THREADS, 10) || 1;
const numOfRepetitions = parseInt(process.env.NUM_OF_REPETITIONS, 10) || 1;
const maxTimeBeforeStartingInMs = parseInt(process.env.MAX_TIME_BEFORE_STARTING_IN_MS, 10) || 0;

loadUserDefinedTest();
const testStartedAt = Date.now();

loadTestFramework.runLoadTest({ numOfThreads, numOfRepetitions, maxTimeBeforeStartingInMs })
  .tap(
    results => printTestDuration(testStartedAt)
  )

  .then(
    results => printReport(results)
  )

  .catch(error => {
    console.error(error);
  })
;

function loadUserDefinedTest() {
  require('../test'); // eslint-disable-line
}

function computeAvgResponseTimeForTest(testData) {
  const stepsResponseTime = testData.stepsData.map(stepData => stepData.responseTime);
  return computeAvg(stepsResponseTime);
}

function computeAvgResponseTimeForTests(testsData) {
  const avgResponseTimes = testsData.map(computeAvgResponseTimeForTest);
  return computeAvg(avgResponseTimes);
}

function computeAvg(arr) {
  return arr.reduce((acc, value) => acc + value, 0) / arr.length;
}

function getStepDataWithError(testData) {
  const lastStepIndex = testData.stepsData.length - 1;
  const stepDataWithError = testData.stepsData[lastStepIndex];
  return stepDataWithError;
}

function getStepWithError(testData) {
  const stepWithError = getStepDataWithError(testData).step;
  return stepWithError;
}

function countResponseCodes(testsData) {
  const numOfEachResponseCode = {};

  testsData.forEach(testData => {
    const stepWithError = getStepDataWithError(testData);
    const statusCode = stepWithError.responseStatusCode;

    if ( !numOfEachResponseCode.hasOwnProperty('statusCode' + statusCode) ) {
      numOfEachResponseCode['statusCode' + statusCode] = 1;
      return;
    }

    numOfEachResponseCode['statusCode' + statusCode]++;
  });

  return numOfEachResponseCode;
}

function generateDistributionReportForStatusCode(testsData) {
  const numOfEachResponseCode = countResponseCodes(testsData);
  const errorCodes = Object.keys(numOfEachResponseCode).sort();

  let errorCodesMsg = '';

  errorCodes.forEach(errorCode => {
    errorCodesMsg += errorCode + ': ' + numOfEachResponseCode[errorCode] + '\n      ';
  });

  if (errorCodesMsg === '') errorCodesMsg = 'N/A';

  return errorCodesMsg;
}

function generateDistributionReportForErroredSteps(testsData) {
  const stepNamesThatFailed = testsData.map(getStepDataWithError).map(stepData => stepData.step.name);

  const numOfEachStep = stepNamesThatFailed.reduce((acc, stepName) => {
    if ( !acc.hasOwnProperty(stepName) ) {
      acc[stepName] = 1;

    } else {
      acc[stepName]++;
    }

    return acc;
  }, {});

  const stepNames = Object.keys(numOfEachStep).sort();

  let errorStepsMsg = '';

  stepNames.forEach(stepName => {
    errorStepsMsg += stepName + ': ' + numOfEachStep[stepName] + '\n      ';
  });

  if (errorStepsMsg === '') errorStepsMsg = 'N/A';

  return errorStepsMsg;
}

function printTestDuration(startedAt) {
  console.log(
    `Test Duration: ${ (Date.now() - startedAt) / 1000 } seconds`
  );
}

function printReport(results) {
  const testsThatSucceeded = results.filter(result => result.succeeded);
  const testsThatFailed = results.filter(result => !result.succeeded);

  const hasErrors = testsThatFailed.length > 0;

  if (hasErrors) {
    const firstTestThatFailed = testsThatFailed[0];
    const stepWithError = getStepWithError(firstTestThatFailed);
    const stepDataWithError = getStepDataWithError(firstTestThatFailed);

    console.log(`
      Try yourself:
      ${ utilities.generateCurlFromStep(stepWithError) }

      Should return:
      ${stepDataWithError.error}
    `);
  }

  const numOfPerformedTests = results.length;
  const numOfSuccesses = testsThatSucceeded.length;
  const numOfFailures = testsThatFailed.length;
  const errorRate = numOfFailures / numOfPerformedTests * 100;

  const avgResponseTime = {};
  avgResponseTime.all = computeAvgResponseTimeForTests(results);
  avgResponseTime.successes = computeAvgResponseTimeForTests(testsThatSucceeded) || 'N/A';
  avgResponseTime.failures = computeAvgResponseTimeForTests(testsThatFailed) || 'N/A';
  avgResponseTime.steps = computeAvgResponseTimeForEachStep(results);

  const overviewMsg = `
    --- Overview ---
    Performed Tests: ${numOfPerformedTests}
    Successes: ${numOfSuccesses}
    Failures: ${numOfFailures}
    Error Rate: ${errorRate}%
  `;

  const responseTimeMsg = `
    --- Response Time ---
    Average of All Tests: ${avgResponseTime.all} ms
    Average of Successes: ${avgResponseTime.successes} ms
    Average of Failures: ${avgResponseTime.failures} ms

    -> Per Steps:
    ${ generateResponseTimeReportForSteps(avgResponseTime.steps) }
  `;

  const stepFailureDistributionMsg = `
    --- How many failed on each Step ---
    ${ generateDistributionReportForErroredSteps(testsThatFailed) }
  `;

  const errorCodeDistributionMsg = `
    --- HTTP Status Code on Failures ---
    ${ generateDistributionReportForStatusCode(testsThatFailed) }
  `;

  const reportMsg = `
    ${overviewMsg}
    ${responseTimeMsg}
    ${stepFailureDistributionMsg}
    ${errorCodeDistributionMsg}
  `;

  console.log(reportMsg);
}

function computeAvgResponseTimeForEachStep(testsData) {
  const stepNames = testsData[0].stepsData.map(stepData => stepData.step.name);

  const executionsOfStep = {};
  const totalTimeOnStep = {};

  stepNames.forEach(stepName => {
    if ( !executionsOfStep.hasOwnProperty(stepName) ) {
      executionsOfStep[stepName] = 0;
    }
    if ( !totalTimeOnStep.hasOwnProperty(stepName) ) {
      totalTimeOnStep[stepName] = 0;
    }

    testsData.forEach(testData => {
      const currentStepOnTestData = testData.stepsData.find(stepData => stepData.step.name === stepName);

      if (currentStepOnTestData) {
        executionsOfStep[stepName]++;
        totalTimeOnStep[stepName] += currentStepOnTestData.responseTime;
      }
    });
  });

  return stepNames.reduce((acc, stepName) => {
    acc[stepName] = totalTimeOnStep[stepName] / executionsOfStep[stepName];
    return acc;
  }, {});
}

function generateResponseTimeReportForSteps(responseTimeOfSteps) {
  const stepNames = Object.keys(responseTimeOfSteps);
  let responseTimeReportOfSteps = '';

  stepNames.forEach((stepName, index) => {
    if (index > 0) responseTimeReportOfSteps += '    ';
    responseTimeReportOfSteps +=  `${stepName}: ${ responseTimeOfSteps[stepName] } ms \n`;
  });

  if (responseTimeReportOfSteps === '') responseTimeReportOfSteps = 'N/A';

  return responseTimeReportOfSteps;
}
