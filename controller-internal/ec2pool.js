const { EC2Client, RunInstancesCommand, AssociateInstanceEventWindowCommand, RequestSpotInstancesCommand, DescribeSpotPriceHistoryCommand } = require('@aws-sdk/client-ec2');
const { ImagebuilderClient, ListImageBuildVersionsCommand, ListImagesCommand, GetImageCommand } = require('@aws-sdk/client-imagebuilder');

class EC2Pool {
    requestedCount = 0;
    actualCount = 0;
    dockerImagesCount = 8;
    maxInstanceCount = 10;
    actionQueue = [];
    instanceStack = [];

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

        if (this.requestedCount > this.actualCount) {
            await this.tryRunInstance();
            return;
        }
        if (this.actualCount >= this.requestedCount + this.dockerImagesCount) {
            await this.tryTerminateInstance();
            return;
        }
    }

    async tryRunInstance() {
        if (this.instanceStack.length === this.maxInstanceCount)
            return;
        const instancesCount = await this.runInstance();
        this.actualCount += instancesCount * this.dockerImagesCount;
    }
    async tryTerminateInstance() {
        this.actualCount -= this.dockerImagesCount;
        const terminationCandidate = this.instanceStack.pop();
        if (!terminationCandidate)
            return;
    }
    async runInstance() {
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
            InstanceTypes: ['m5.large'],
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
                InstanceType: 'm5.large',
            }
        }));
    }
}

module.exports = EC2Pool;
