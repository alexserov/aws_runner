const {
    S3Client,
    DeleteBucketCommand,
    ListObjectVersionsCommand,
    ListBucketsCommand,
    DeleteObjectCommand,
} = require('@aws-sdk/client-s3');

const constants = require('./constants');

async function Cleanup(logCallback) {
    logCallback('S3 Cleanup');
    const client = new S3Client();

    const buckets = await client.send(new ListBucketsCommand({}));
    if (!buckets.Buckets?.map((x) => x.Name)?.includes(constants.names.bucket)) return;

    await client.send(new ListObjectVersionsCommand({
        Bucket: constants.names.bucket,
    })).then(async (versions) => {
        if (versions.DeleteMarkers) {
            await Promise.all(versions.DeleteMarkers.map((x) => client.send(new DeleteObjectCommand({
                Bucket: constants.names.bucket,
                Key: x.Key,
                VersionId: x.VersionId,
            }))));
        }
    });
    await client.send(new ListObjectVersionsCommand({
        Bucket: constants.names.bucket,
    })).then(async (versions) => {
        if (versions.Versions) {
            await Promise.all(versions.Versions.map((x) => client.send(new DeleteObjectCommand({
                Bucket: constants.names.bucket,
                Key: x.Key,
                VersionId: x.VersionId,
            }))));
        }
    });

    await client.send(new DeleteBucketCommand({
        Bucket: constants.names.bucket,
    }));
}

module.exports = Cleanup;
