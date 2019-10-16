const util = require('util');

const utilities = {};

utilities.prettifyObj = function(obj) {
  try {
    // This causes error on circular objects
    return JSON.stringify(obj, null, 2);

  } catch (error) {
    // This don't, but it's uglier. Using it as a fallback
    return util.inspect(obj);
  }
};

utilities.generateCurlFromStep = function(step) {
  let curl = 'curl -i ';
  curl += step.method === 'head' ? '--head ' : '-X ' + step.method.toUpperCase() + ' ';

  Object.keys(step.headers).forEach(header => {
    curl += `-H "${header}: ${ step.headers[header] }" `;
  });

  if (step.body) curl += `-d '${ JSON.stringify(step.body) }' `;
  curl += `"${step.url}"`;

  return curl;
};

module.exports = utilities;
