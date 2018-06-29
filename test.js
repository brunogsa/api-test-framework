const loadTestFramework = require('./src/load-test-framework');

/*
 * Test Data / Configs
 */

const baseUrl = 'https://www.google.com';

/*
 * Load Test Steps
 */

loadTestFramework.addStep({
  name: 'Google Page Loads',

  method: 'get',
  url: baseUrl,

  expectedResponseCode: 200,
});
