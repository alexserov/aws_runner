const vpc = require('./aws/vpc');
const s3 = require('./aws/s3');
const ami = require('./aws/ami');

async function Cleanup() {
    await ami.Cleanup();
    await s3.Cleanup();
    await vpc.Cleanup();
}
async function Initialize() {
    await vpc.Initialize();
    await s3.Initialize();
    await ami.Initialize();
}
async function main() {
    await Cleanup();
    await Initialize();
}

main();
