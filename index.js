const { spawn, execSync } = require('child_process');
const { platform } = require('os');
const path = require('path');
const { initialize, rebuild, run } = require('./initializer/index');
const config = require('./config');

async function main() {
    prepareConfig();
    await buildDocker();
    await initialize(config, logCallback);
    // await rebuild(config, logCallback);
    // await startListener();
}

function prepareConfig() {
    const identity = JSON.parse(execSync('aws sts get-caller-identity').toString());
    config.AWS_ACCOUNT_ID = identity.Account;
}

async function buildDocker() {
    const dockerOptions = {
        cwd: path.join(__dirname, 'docker'),
        env: {
            ...process.env,
            AWS_ACCOUNT_ID: config.AWS_ACCOUNT_ID,
            AWS_REGION: config.region,
            DOCKER_REPO_NAME: config.constants.ecr.names.repository,
        },
        shell: platform() === 'win32' ? 'cmd.exe' : '/bin/bash',
    };

    logCallback('Building docker images');
    await spawnCommand(
        'docker compose build --progress plain',
        dockerOptions,
        logCallback,
    );

    logCallback('AWS Login');
    if (platform() === 'win32') {
        await spawnCommand(
            `(Get-ECRLoginCommand).Password | docker login --username AWS --password-stdin ${config.AWS_ACCOUNT_ID}.dkr.ecr.${config.region}.amazonaws.com`,
            { shell: 'powershell.exe' },
            logCallback,
        );
    } else {
        await spawnCommand(
            `aws ecr get-login-password --region ${config.region} | docker login --username AWS --password-stdin ${config.AWS_ACCOUNT_ID}.dkr.ecr.${config.region}.amazonaws.com`,
            { shell: '/bin/bash' },
            logCallback,
        );
    }

    logCallback('Push');

    await spawnCommand(
        'docker compose push',
        dockerOptions,
        logCallback,
    );
}
async function spawnCommand(command, options, log) {
    await new Promise((resolve) => {
        const ls = spawn(command, { ...options, windowsHide: true });
        ls.stdout.on('data', (data) => log(`\t${data.toString()}`));
        ls.stderr.on('data', (data) => log(`\t${data.toString()}`));
        ls.on('exit', (code) => {
            log(`\tchild process exited with code ${code.toString()}`);
            resolve();
        });
    });
}

async function startListener() {
    await run(config, logCallback);
}

function logCallback(...args) {
    let date = args[0];
    let message = args[1];
    if (!message) {
        message = date;
        date = new Date();
    }
    if (/^[\t\n\s]*$/.test(message)) { return; }
    message = message.replace(/\\n/g, `\\n[${date}]: \\t`);
    // eslint-disable-next-line no-console
    console.log(`[${date}]: ${message}`);
}

main();
