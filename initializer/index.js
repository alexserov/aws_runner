const vpc = require('./aws/vpc');
const s3 = require('./aws/s3');
const imagebuilder = require('./aws/image-builder');
const iam = require('./aws/iam');
const globalConstants = require('./aws/global');

async function Cleanup() {
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
}

function Apply(config) {
    globalConstants.region = config.region;
    globalConstants.tagValue = config.tagValue;
    globalConstants.tagName = config.tagName;

    imagebuilder.constants.apply(config);
    s3.constants.apply(config);
    vpc.constants.apply(config);
    iam.constants.apply(config);
}

module.exports = async function main(config) {
    Apply(config);
    await Cleanup();
    await Initialize();
};
