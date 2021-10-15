const { spawn, execSync } = require('child_process');
const { platform } = require('os');
const { initialize, rebuild } = require('./initializer/index');
const config = require('./config');
const { join } = require('path');

async function main() {
    prepareConfig();
    await buildDocker();
    // await initialize(config, logCallback);
    // await rebuild(config, logCallback);
    // await startListener();
}

function prepareConfig() {
    const identity = JSON.parse(execSync('aws sts get-caller-identity').toString());
    config.AWS_ACCOUNT_ID = identity.Account;
}

async function buildDocker() {
    let command;
    let options;
    logCallback('Building docker images');
    if (platform() === 'win32') {
        command = './build.ps1';
        options = { shell: 'powershell.exe' };
    } else {
        command = './build.sh';
        options = { shell: '/bin/bash' };
    }
    options.env = {
        AWS_ACCOUNT_ID: config.AWS_ACCOUNT_ID,
        AWS_REGION: config.region,
        DOCKER_REPO_NAME: config.constants.ecr.names.repository,
    };

    await spawnCommand(command, options, logCallback);
}
async function spawnCommand(command, options, log) {
    await new Promise((resolve) => {
        const ls = spawn(command, options);
        ls.stdout.on('data', (data) => log(`\t${data.toString()}`));
        ls.stderr.on('data', (data) => log(`\t${data.toString()}`));
        ls.on('exit', (code) => {
            log(`\tchild process exited with code ${code.toString()}`);
            resolve();
        });
    });
}

async function startListener() {
    logCallback('not implemented');
}

function logCallback(...args) {
    let date = args[0];
    let message = args[1];
    if (!message) {
        message = date;
        date = new Date();
    }
    if (/^[\t\n\s]*$/.test(message))
        return;
    // eslint-disable-next-line no-console
    console.log(`[${date}]: ${message}`);
}

main();
