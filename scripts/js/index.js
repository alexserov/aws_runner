const vpc = require('./vpc');
const s3 = require('./s3');

async function Cleanup() {
    await vpc.Cleanup();
    await s3.Cleanup();
}
async function Initialize() {
    await vpc.Initialize();
    await s3.Initialize();
}
async function main() {
    await s3.Cleanup();
    await s3.Initialize();
}

main();
