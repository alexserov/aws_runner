const {
    S3Client,
    CreateBucketCommand,
    PutBucketTaggingCommand,
} = require('@aws-sdk/client-s3');

const globalConstants = require('../global');
const constants = require('./constants');

async function Initialize(logCallback) {
    logCallback('S3 Initialization');
    const client = new S3Client();

    await client.send(new CreateBucketCommand({
        ACL: 'private',
        Bucket: constants.names.bucket,
        CreateBucketConfiguration: {
            LocationConstraint: globalConstants.region,
        },
        ObjectLockEnabledForBucket: true,
    }));

    await client.send(new PutBucketTaggingCommand({
        Bucket: constants.names.bucket,
        Tagging: {
            TagSet: [
                {
                    Key: 'Name',
                    Value: constants.names.bucket,
                },
                {
                    Key: globalConstants.tagName,
                    Value: globalConstants.tagValue,
                },
            ],
        },
    }));
}

module.exports = Initialize;
