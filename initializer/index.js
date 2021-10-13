const vpc = require('./aws/vpc');
const s3 = require('./aws/s3');
const imagebuilder = require('./aws/image-builder');
const ec2 = require('./aws/ec2');
const iam = require('./aws/iam');

async function Cleanup() {
    await ec2.Cleanup();
    await imagebuilder.Cleanup();
    await s3.Cleanup();
    await vpc.Cleanup();
    await iam.Cleanup();
}
async function Initialize() {
    await iam.Initialize();
    await vpc.Initialize();
    await s3.Initialize();
    await imagebuilder.Initialize();
    await ec2.Initialize();
}
async function main() {
    await Cleanup();
    await Initialize();
}

main();
