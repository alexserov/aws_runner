const {
  EC2Client,
} = require('@aws-sdk/client-ec2');
const globalConstants = require('../global');
const constants = require('./constants');

async function Initialize() {
  console.log('Initialization');
  const client = new EC2Client();
}

module.exports = Initialize;
