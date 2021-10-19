const {
    EC2Client,
    RequestSpotInstancesCommand,
    DescribeSpotPriceHistoryCommand,
    CreateTagsCommand,
    TerminateInstancesCommand,
    DescribeSpotInstanceRequestsCommand,
    DescribeSecurityGroupsCommand,
    DescribeSubnetsCommand,
    CancelSpotInstanceRequestsCommand,
} = require('@aws-sdk/client-ec2');
const {
    ImagebuilderClient, ListImageBuildVersionsCommand, ListImagesCommand,
} = require('@aws-sdk/client-imagebuilder');
const { readFileSync } = require('fs');
const { join } = require('path');
const config = require('../config');

class EC2Pool {
    constructor() {
        this.requestedCount = 0;
        this.actualCount = 0;
        this.maxPricePerHour = 0.05;
        this.currentPricePerHour = 0;
        this.actionQueue = [];
        this.instanceStack = [];
        this.lastInstanceId = 0;
        setInterval(this.processQueue.bind(this), 1 * 1000);
    }

    increaseLoad() {
        this.actionQueue += 1;
    }

    decreaseLoad() {
        this.actionQueue -= 1;
    }

    async processQueue() {
        if (!this.actionQueue) return;
        this.requestedCount += this.actionQueue;
        this.actionQueue = 0;

        await this.tryRunInstanceIfNeeded();
        await this.tryTerminateInstanceIfNeeded();
    }

    async tryRunInstanceIfNeeded() {
        const instanceCandidates = config.machines;
        let index = 0;
        while (this.requestedCount > this.actualCount) {
            if (index >= instanceCandidates.length) { break; }
            // eslint-disable-next-line no-await-in-loop
            const instancesCount = await this.runInstance(instanceCandidates[index]);
            this.actualCount += instancesCount * instanceCandidates[index].dockerInstancesCount;
            index++;
        }
    }

    async tryTerminateInstanceIfNeeded() {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            if (!this.instanceStack.length) {
                return;
            }

            const { dockerInstancesCount } = this.instanceStack[this.instanceStack.length - 1];
            if (this.requestedCount + dockerInstancesCount <= this.actualCount) {
                break;
            }
            const instancesToTerminate = Math.floor((this.actualCount - this.requestedCount) / this.dockerInstancesCount);
            if (instancesToTerminate) {
                // eslint-disable-next-line no-await-in-loop
                await Promise.all(new Array(instancesToTerminate).map(this.terminateInstance()));
            } else {
                return;
            }
        }
    }

    async terminateInstance() {
        const lastInstance = this.instanceStack.pop();
        if (!lastInstance) { return; }
        const ec2Client = new EC2Client({});

        await ec2Client.send(new TerminateInstancesCommand({
            InstanceIds: [lastInstance],
        }));
    }

    // eslint-disable-next-line class-methods-use-this
    patchUserData(data, instanceMetadata) {
        const replacements = {
            REPO_FULLNAME_PLACEHOLDER: config.repository.name,
            WORKERS_COUNT_PLACEHOLDER: instanceMetadata.dockerInstancesCount,
            WORKERS_LABEL_PLACEHOLDER: instanceMetadata.label,
            AWS_ACCOUNT_ID_PLACEHOLDER: process.env.EC2_ACCOUNT,
            AWS_REGION_PLACEHOLDER: process.env.EC2_REGION,
            DOCKER_REPO_NAME_PLACEHOLDER: config.constants.ecr.names.repository,
            CONTROLLER_ADDRESS_PLACEHOLDER: process.env.CONTROLLER_ADDRESS,
        };
        let result = data;
        Object.keys(data).forEach((x) => {
            result = result.replace(x, replacements[x]);
        });

        return Buffer.from(result).toString('base64');
    }

    async runInstance(instanceMetadata) {
        // TODO remove copy-pasted code in /initializer/runner/index.js
        const imagebuilderClient = new ImagebuilderClient({});
        const latestImageVersionArn = await imagebuilderClient.send(new ListImagesCommand({
            filters: [
                { name: 'name', values: [config.constants.imagebuilder.names.host.imageRecipe] },
            ],
        }))
            .then((x) => x.imageVersionList.sort((a, b) => new Date(b.dateCreated).valueOf() - new Date(a.dateCreated).valueOf()))
            .then((x) => x[0].arn);
        const latestImageBuild = await imagebuilderClient.send(new ListImageBuildVersionsCommand({
            imageVersionArn: latestImageVersionArn,
        }))
            .then((x) => x.imageSummaryList.sort((a, b) => new Date(b.dateCreated).valueOf() - new Date(a.dateCreated).valueOf()))
            .then((x) => x[0]);

        const imageId = latestImageBuild.outputResources.amis[0].image;
        const ec2Client = new EC2Client({});

        const securityGroup = await ec2Client.send(new DescribeSecurityGroupsCommand({
            Filters: [
                { Name: 'tag:Name', Values: [config.constants.vpc.names.run.securityGroup] },
            ],

        })).then((x) => x.SecurityGroups[0]);

        const subnet = await ec2Client.send(new DescribeSubnetsCommand({
            Filters: [
                { Name: 'tag:Name', Values: [config.constants.vpc.names.run.subnet] },
            ],
        })).then((x) => x.Subnets[0]);

        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const spotPrices = await ec2Client.send(new DescribeSpotPriceHistoryCommand({
            InstanceTypes: [instanceMetadata.type],
            ProductDescriptions: ['Linux/UNIX (Amazon VPC)'],
            StartTime: yesterday,
            EndTime: today,
        })).then((x) => {
            const prices = x.SpotPriceHistory.map((s) => +s.SpotPrice);
            return {
                min: Math.min(...prices),
                avg: prices.reduce((p, c) => p + c, 0) / prices.length,
                max: Math.max(...prices),
            };
        });
        if (this.currentPricePerHour + spotPrices.max > this.maxPricePerHour) { return 0; }
        const response = await ec2Client.send(new RequestSpotInstancesCommand({
            ImageId: imageId,
            SpotPrice: spotPrices.max,
            InstanceCount: Math.ceil((this.requestedCount - this.actualCount) / instanceMetadata.dockerInstancesCount),
            Type: 'one-time',
            LaunchSpecification: {
                SecurityGroupIds: [securityGroup.GroupId],
                SubnetId: subnet.SubnetId,
                ImageId: imageId,
                UserData: this.patchUserData(readFileSync(join(__dirname, 'docker-host.sh')).toString(), instanceMetadata),
                IamInstanceProfile: {
                    Name: config.constants.iam.names.dockerHost.profile,
                },
                InstanceType: instanceMetadata.type,
            },
            TagSpecifications: [
                {
                    ResourceType: 'spot-instances-request',
                    Tags: [{
                        Key: config.constants.global.tagName,
                        Value: config.constants.global.tagValue,
                    }],
                },
            ],
        }));
        let requestInfos = response.SpotInstanceRequests;
        while (requestInfos.find((x) => !x.InstanceId)) {
            const ids = requestInfos.map((x) => x.SpotInstanceRequestId);
            // eslint-disable-next-line no-await-in-loop
            requestInfos = await new Promise((resolve) => setTimeout(resolve, 10000))
                .then(() => ec2Client.send(new DescribeSpotInstanceRequestsCommand({
                    SpotInstanceRequestIds: ids,
                })))
                .then((x) => x.SpotInstanceRequests);
            requestInfos = requestInfos.filter((x) => x.Status.Code !== 'capacity-not-available');

            const unavailableRequestInfos = requestInfos.filter((x) => x.Status.Code === 'capacity-not-available');
            // eslint-disable-next-line no-await-in-loop
            await ec2Client.send(new CancelSpotInstanceRequestsCommand({
                SpotInstanceRequestIds: unavailableRequestInfos.map((x) => x.SpotInstanceRequestId),
            }));
        }
        if (!requestInfos.length) { return 0; }
        await Promise.all(requestInfos.map((x) => x.InstanceId).map(async (instance, index) => {
            await ec2Client.send(new CreateTagsCommand({
                Resources: [instance],
                Tags: [
                    { Key: 'Name', Value: `${config.constants.ec2.names.instancePrefix}-${this.lastInstanceId + index}` },
                    { Key: config.constants.global.tagName, Value: config.constants.global.tagValue },
                ],
            }));
        }));
        this.lastInstanceId += requestInfos.length;

        const result = requestInfos.map((x) => ({
            id: x.InstanceId,
            price: +x.SpotPrice,
            dockerInstancesCount: instanceMetadata.dockerInstancesCount,
        }));
        this.instanceStack.push(result);
        this.currentPricePerHour += result.map((x) => x.price).reduce((l, r) => l + r, 0);
        return requestInfos.length;
    }
}

module.exports = EC2Pool;
