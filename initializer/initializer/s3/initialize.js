const {
    S3Client,
    CreateBucketCommand,
    PutBucketTaggingCommand,
    PutObjectCommand,
} = require('@aws-sdk/client-s3');
const { readFileSync } = require('fs');
const glob = require('glob');
const path = require('path');

const globalConstants = require('../global');
const constants = require('./constants');

async function uploadRootFolder(client, bucketSubdir, folderName) {
    const rootFolder = path.resolve(__dirname, '../../../');
    const fileNames = await new Promise((resolve) => {
        glob(
            path.join(rootFolder, folderName, '**/*'),
            (err, files) => {
                resolve(files.filter((x) => !x.includes('node_modules')));
            },
        );
    });

    await Promise.all(fileNames.map((x) => client.send(new PutObjectCommand({
        Bucket: constants.names.bucket,
        Key: path.normalize(`${bucketSubdir}/${path.relative(rootFolder, x)}`).replace(/\\/g, '/'),
        Body: readFileSync(x).toString(),
    }))));
}
async function uploadRootFile(client, bucketSubdir, fileName) {
    const rootFolder = path.resolve(__dirname, '../../../');
    await client.send(new PutObjectCommand({
        Bucket: constants.names.bucket,
        Key: `${bucketSubdir}/${fileName}`,
        Body: readFileSync(path.join(rootFolder, fileName)).toString(),
    }));
}

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

    await uploadRootFolder(client, 'controller', 'controller-internal');
    await uploadRootFolder(client, 'controller', 'controller-public');
    await uploadRootFile(client, 'controller', 'config.js');

    await uploadRootFolder(client, 'docker-host', 'docker-host');
    await uploadRootFile(client, 'docker-host', 'config.js');
}

module.exports = Initialize;
