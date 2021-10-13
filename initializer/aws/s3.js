const {
    S3Client,
    DeleteBucketCommand,
    CreateBucketCommand,
    ListObjectVersionsCommand,
    ListBucketsCommand,
    PutBucketTaggingCommand,
    DeleteObjectCommand
} = require('@aws-sdk/client-s3')
const {
    constants: globalConstants
} = require('./global');

const constants = {
    names: {
        bucket: 'devextreme-ga-configs'
    }
};

async function Cleanup() {
    console.log('S3 Cleanup');
    const client = new S3Client();

    const buckets = await client.send(new ListBucketsCommand({ }));
    if (!buckets.Buckets?.map(x => x.Name)?.includes(constants.names.bucket))
        return;
    
    await client.send(new ListObjectVersionsCommand({
        Bucket: constants.names.bucket,
    })).then(async versions => {
        if (versions.DeleteMarkers) {
            await Promise.all(versions.DeleteMarkers.map(x => client.send(new DeleteObjectCommand({
                Bucket: constants.names.bucket,
                Key: x.Key,
                VersionId: x.VersionId
            }))));
        }
    });
    await client.send(new ListObjectVersionsCommand({
        Bucket: constants.names.bucket,
    })).then(async versions => {
        if (versions.Versions) {
            await Promise.all(versions.Versions.map(x => client.send(new DeleteObjectCommand({
                Bucket: constants.names.bucket,
                Key: x.Key,
                VersionId: x.VersionId
            }))));
        }
    });

    await client.send(new DeleteBucketCommand({
        Bucket: constants.names.bucket,
    }))
}

async function Initialize() {
    console.log('S3 Initialization');
    // # TODO: manage access
    const client = new S3Client();

    await client.send(new CreateBucketCommand({
        ACL: 'private',
        Bucket: constants.names.bucket,
        CreateBucketConfiguration: {
            LocationConstraint: globalConstants.region
        },
        ObjectLockEnabledForBucket: true
    }));

    await client.send(new PutBucketTaggingCommand({
        Bucket: constants.names.bucket,
        Tagging: {
            TagSet: [
                {
                    Key: 'Name',
                    Value: constants.names.bucket
                },
                {
                    Key: globalConstants.tagName,
                    Value: globalConstants.tagValue
                }
            ]
        }
    }));
}

module.exports = {
    Cleanup,
    Initialize,
    constants
}
