/* eslint-disable no-await-in-loop */
const {
    ImagebuilderClient, StartImagePipelineExecutionCommand, ListImagePipelinesCommand, GetImageCommand,
} = require('@aws-sdk/client-imagebuilder');
const {
    CloudWatchLogsClient,
    GetLogEventsCommand,
} = require('@aws-sdk/client-cloudwatch-logs');

module.exports = async function rebuild(config, logCallback) {
    const client = new ImagebuilderClient({});
    const pipelines = await client.send(new ListImagePipelinesCommand({}))
        .then((x) => x.imagePipelineList)
        .then((x) => x.filter((z) => z.tags[config.constants.global.tagName] === config.constants.global.tagValue));

    const buildVersions = await Promise.all(pipelines.map((x) => client.send(new StartImagePipelineExecutionCommand({
        imagePipelineArn: x.arn,
    })).then((r) => r.imageBuildVersionArn)));

    const lastLogTimes = {};

    const cloudWatchClient = new CloudWatchLogsClient({});

    while (true) {
        const buildVersionInfos = await Promise
            .all(buildVersions.map((x) => client.send(new GetImageCommand({
                imageBuildVersionArn: x,
            }))))
            .then((x) => x.map((z) => z.image));
        if (!buildVersionInfos.filter((x) => !x.outputResources.amis.length).length) {
            break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10000));

        await buildVersionInfos.map(async (info, index) => {
            const { name } = info;
            const lastLogTime = lastLogTimes[name] ?? new Date().valueOf();

            const logs = await cloudWatchClient.send(new GetLogEventsCommand({
                logGroupName: `/aws/imagebuilder/${name}`,
                logStreamName: info.version,
                startTime: lastLogTime,
                startFromHead: true,
            }))
                .then((x) => x.events)
                .catch(() => []);
            if (!logs.length) {
                lastLogTimes[name] = new Date().valueOf();
            } else {
                logs.forEach((x) => {
                    logCallback(new Date(x.timestamp), `[IMG#${index}] ${x.message}`);
                    lastLogTimes[name] = x.timestamp;
                });
            }
        });
    }
};
