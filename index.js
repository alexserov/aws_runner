const { exec } = require('child_process');
const { promisify } = require('util');
const { platform } = require('os');
const initializer = require('./initializer/index');
const config = require('./config');

async function main() {
    await buildDocker();
    await initializer(config);
}

async function buildDocker() {
    if (platform() === 'win32') {
        await promisify(exec)('./build.ps1', { shell: 'powershell.exe' });
    } else {
        await promisify(exec)('./build.sh', { shell: '/bin/bash' });
    }
}

main();
