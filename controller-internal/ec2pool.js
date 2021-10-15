const { EC2Client, RunInstancesCommand, AssociateInstanceEventWindowCommand, RequestSpotInstancesCommand, DescribeSpotPriceHistoryCommand, ModifyInstanceAttributeCommand, CreateTagsCommand, TerminateInstancesCommand, DescribeSpotInstanceRequestsCommand } = require('@aws-sdk/client-ec2');
const { ImagebuilderClient, ListImageBuildVersionsCommand, ListImagesCommand, GetImageCommand, TagResourceCommand } = require('@aws-sdk/client-imagebuilder');
const { request } = require('express');

class EC2Pool {
    requestedCount = 0;
    actualCount = 0;
    dockerImagesCount = 1;
    maxPricePerHour = 0.05;
    currentPricePerHour = 0;
    actionQueue = [];
    instanceStack = [];
    lastInstanceId = 0;

    constructor() {
        setInterval(this.processQueue.bind(this), 1 * 1000);
    }

    increaseLoad() {
        this.actionQueue.push(1);
    }
    decreaseLoad() {
        this.actionQueue.push(-1);
    }
    async processQueue() {
        if (!this.actionQueue.length)
            return;
        const delta = this.actionQueue.reduce((p, q) => p + q, 0);
        this.requestedCount += delta;
        this.actionQueue.length = 0;

        
        await this.tryRunInstanceIfNeeded();

        if (this.actualCount >= this.requestedCount + this.dockerImagesCount) {
            await this.tryTerminateInstance();
            return;
        }
    }

    async tryRunInstanceIfNeeded() {
        const instanceCandidates = ['m5.large', 'm4.large'];
        let index = 0;
        while (this.requestedCount > this.actualCount) {
            if (index >= instanceCandidates.length)
                break;
            const instancesCount = await this.runInstance(instanceCandidates[index]);
            this.actualCount += instancesCount * this.dockerImagesCount;
            index++;
        }
    }
    async tryTerminateInstance() {
        const instancesToTerminate = Math.floor((this.actualCount - this.requestedCount) / this.dockerImagesCount);
        for (let i = 0; i < instancesToTerminate; i++) {
            await this.terminateInstance();
        }
    }
    async terminateInstance() {
        const lastInstance = this.instanceStack.pop();
        if (!lastInstance)
            return;
        const ec2Client = new EC2Client({});

        await ec2Client.send(new TerminateInstancesCommand({
            InstanceIds: [lastInstance]
        }));
    }
    async runInstance(instanceType) {
        const imagebuilderClient = new ImagebuilderClient({});
        const latestImageVersionArn = await imagebuilderClient.send(new ListImagesCommand({
            filters: [
                { name: 'name', values: ['devextreme-ga-recipe-host'] }
            ]
        }))
            .then(x => x.imageVersionList.sort((a, b) => new Date(a.dateCreated).valueOf() - new Date(b.dateCreated).valueOf()))
            .then(x => x[0].arn);
        const latestImageBuild = await imagebuilderClient.send(new ListImageBuildVersionsCommand({
            imageVersionArn: latestImageVersionArn
        }))
            .then(x => x.imageSummaryList.sort((a, b) => new Date(a.dateCreated).valueOf() - new Date(b.dateCreated).valueOf()))
            .then(x => x[0]);
        

        const imageId = latestImageBuild.outputResources.amis[0].image;
        const ec2Client = new EC2Client({});

        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const spotPrices = await ec2Client.send(new DescribeSpotPriceHistoryCommand({
            InstanceTypes: [instanceType],
            ProductDescriptions: ['Linux/UNIX (Amazon VPC)'],
            StartTime: yesterday,
            EndTime: today,
        })).then(x => {
            const prices = x.SpotPriceHistory.map(x => +x.SpotPrice);
            return {
                min: Math.min(...prices),
                avg: prices.reduce((p, c) => p + c, 0) / prices.length,
                max: Math.max(...prices)
            };
        });
        if (this.currentPricePerHour + spotPrices.max > this.maxPricePerHour)
            return 0;
        const response = await ec2Client.send(new RequestSpotInstancesCommand({
            ImageId: imageId,
            SpotPrice: spotPrices.max,
            InstanceCount: Math.ceil((this.requestedCount - this.actualCount) / this.dockerImagesCount),
            Type: 'one-time',
            LaunchSpecification: {
                ImageId: imageId,
                IamInstanceProfile: {
                    Name: 'devextreme-ga-docker-host-profile'
                },
                InstanceType: instanceType,
            },
            TagSpecifications: [
                {
                    ResourceType: 'spot-instances-request',
                    Tags: [{
                        Key: 'dx-info',
                        Value: 'devextreme-ga'
                    }]
                }
            ]
        }));
        let requestInfos = response.SpotInstanceRequests;
        while (requestInfos.find(x => !x.InstanceId)) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            requestInfos = await ec2Client.send(new DescribeSpotInstanceRequestsCommand({
                SpotInstanceRequestIds: requestInfos.map(x => x.SpotInstanceRequestId)
            })).then(x => x.SpotInstanceRequests);
            requestInfos = requestInfos.filter(x => x.Status.Code !== 'capacity-not-available');
        }
        if (!requestInfos.length)
            return 0;
        await Promise.all(requestInfos.map(x => x.InstanceId).map(async (instance, index) => {
            await ec2Client.send(new CreateTagsCommand({
                Resources: [instance],
                Tags: [
                    { Key: 'Name', Value: `devextreme-ga-runner-instance-${this.lastInstanceId+index}` },
                    { Key: 'dx-info', Value: 'devextreme-ga' }
                ]
            }))
        }));
        this.lastInstanceId += requestInfos.length;

        const result = requestInfos.map(x => ({
            id: x.InstanceId,
            price: +x.SpotPrice
        }));
        this.instanceStack.push(result);
        this.currentPricePerHour += result.map(x => x.price).reduce((l, r) => l + r, 0);
        return requestInfos.length;
    }
}

module.exports = EC2Pool;
