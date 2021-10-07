const vpc = require('./aws/vpc');
const s3 = require('./aws/s3');
const ami = require('./aws/ami');

async function Cleanup() {
    await vpc.Cleanup();
    await s3.Cleanup();
    await ami.Cleanup();
}
async function Initialize() {
    await vpc.Initialize();
    await s3.Initialize();
    await ami.Initialize();
}
async function main() {
    await ami.Cleanup();
    await ami.Initialize();
}

main();
