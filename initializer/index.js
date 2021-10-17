const vpc = require('./initializer/vpc');
const s3 = require('./initializer/s3');
const imagebuilder = require('./initializer/image-builder');
const iam = require('./initializer/iam');
const globalConstants = require('./initializer/global');
const builder = require('./builder');
const runner = require('./runner');

async function Cleanup(logCallback) {
    await imagebuilder.Cleanup(logCallback);
    await s3.Cleanup(logCallback);
    await vpc.Cleanup(logCallback);
    await iam.Cleanup(logCallback);
}
async function Initialize(logCallback) {
    await iam.Initialize(logCallback);
    await vpc.Initialize(logCallback);
    await s3.Initialize(logCallback);
    await imagebuilder.Initialize(logCallback);
}

function Apply(config) {
    globalConstants.region = config.region;
    globalConstants.tagValue = config.constants.global.tagValue;
    globalConstants.tagName = config.constants.global.tagName;

    imagebuilder.constants.apply(config.constants.imagebuilder);
    s3.constants.apply(config.constants.s3);
    vpc.constants.apply(config.constants.vpc);
    iam.constants.apply(config.constants.iam);
}

module.exports = {
    async initialize(config, logCallback) {
        Apply(config);
        await Cleanup(logCallback);
        await Initialize(logCallback);
    },
    async rebuild(config, logCallback) {
        await builder(config, logCallback);
    },
    async run(config, logCallback) {
        await runner(config, logCallback);
    },
};
