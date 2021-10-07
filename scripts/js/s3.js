const {
    S3Client,
    DeleteBucketCommand,
    CreateBucketCommand,
    ListObjectVersionsCommand,
    ListBucketsCommand,
    PutBucketTaggingCommand,
    DeleteObjectCommand
} = require('@aws-sdk/client-s3')

async function Cleanup() {
    const client = new S3Client();

    const buckets = await client.send(new ListBucketsCommand({ }));
    if (!buckets.Buckets?.map(x => x.Name)?.includes('devextreme-ga-configs'))
        return;
    
    const versions = await client.send(new ListObjectVersionsCommand({
        Bucket: 'devextreme-ga-configs',
    }));
    if (versions.Versions) {
        await Promise.all(versions.Versions.map(x => client.send(new DeleteObjectCommand({
            Bucket: 'devextreme-ga-configs',
            Key: x.Key,
            VersionId: x.VersionId
        }))));
    }

    await client.send(new DeleteBucketCommand({
        Bucket: 'devextreme-ga-configs',
    }))
}

async function Initialize() {
    // # TODO: manage access
    const client = new S3Client();

    await client.send(new CreateBucketCommand({
        ACL: 'private',
        Bucket: 'devextreme-ga-configs',
        CreateBucketConfiguration: {
            LocationConstraint: 'eu-central-1'
        },
        ObjectLockEnabledForBucket: true
    }));

    await client.send(new PutBucketTaggingCommand({
        Bucket: 'devextreme-ga-configs',
        Tagging: {
            TagSet: [
                {
                    Key: 'Name',
                    Value: 'devextreme-ga-configs'
                },
                {
                    Key: 'dx-info',
                    Value: 'devextreme-ga'
                }
            ]
        }
    }));
}

module.exports = {
    Cleanup,
    Initialize
}
