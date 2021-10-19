const {
    ImagebuilderClient,
    ListImagesCommand,
    ListImageBuildVersionsCommand,
} = require('@aws-sdk/client-imagebuilder');
const {
    EC2Client,
    RunInstancesCommand,
    DescribeSecurityGroupsCommand,
    DescribeSubnetsCommand,
    DescribeAddressesCommand,
    AssociateAddressCommand,
    DescribeInstancesCommand,
    AssociateIamInstanceProfileCommand,
} = require('@aws-sdk/client-ec2');
const { readFileSync } = require('fs');
const { join } = require('path');

async function run(config, logCallback) {
    logCallback('Starting listener');
    const imagebuilderClient = new ImagebuilderClient({});
    const latestImageVersionArn = await imagebuilderClient.send(new ListImagesCommand({
        filters: [
            { name: 'name', values: [config.constants.imagebuilder.names.listener.imageRecipe] },
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
    logCallback(`\t Image: ${imageId}`);

    const ec2Client = new EC2Client({});

    const securityGroup = await ec2Client.send(new DescribeSecurityGroupsCommand({
        Filters: [
            { Name: 'tag:Name', Values: [config.constants.vpc.names.run.securityGroup] },
        ],

    })).then((x) => x.SecurityGroups[0]);
    logCallback(`\t Security group: ${securityGroup.GroupName} (${securityGroup.GroupId})`);

    const subnet = await ec2Client.send(new DescribeSubnetsCommand({
        Filters: [
            { Name: 'tag:Name', Values: [config.constants.vpc.names.run.subnet] },
        ],
    })).then((x) => x.Subnets[0]);
    logCallback(`\t Subnet: ${subnet.SubnetArn}`);

    let instance = await ec2Client.send(new RunInstancesCommand({
        MinCount: 1,
        MaxCount: 1,
        ImageId: imageId,
        SecurityGroupIds: [securityGroup.GroupId],
        SubnetId: subnet.SubnetId,
        UserData: readFileSync(join(__dirname, 'startup.sh')).toString('base64'),
    })).then((x) => x.Instances[0]);

    logCallback('\t ******************');
    logCallback(`\t Instance: ${instance.InstanceId}`);

    let notify = true;
    // eslint-disable-next-line no-bitwise
    while ((instance.State.Code & 16) !== 16) {
        if (notify) {
            logCallback('\t Waiting for instance initialization...');
            notify = false;
        }
        // code 16 is 'running'

        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 10 * 1000));
        // eslint-disable-next-line no-await-in-loop
        instance = await ec2Client.send(new DescribeInstancesCommand({
            InstanceIds: [instance.InstanceId],
        })).then((x) => x.Reservations[0].Instances[0]);
    }
    const allocatedAddress = await ec2Client.send(new DescribeAddressesCommand({
        Filters: [
            { Name: 'tag:Name', Values: [config.constants.vpc.names.run.elastic_ip] },
        ],
    })).then((x) => x.Addresses[0]);

    ec2Client.send(new AssociateAddressCommand({
        AllocationId: allocatedAddress.AllocationId,
        InstanceId: instance.InstanceId,
    }));
    logCallback(`\t Instance IP: ${allocatedAddress.PublicIp}`);

    await ec2Client.send(new AssociateIamInstanceProfileCommand({
        InstanceId: instance.InstanceId,
        IamInstanceProfile: {
            Name: config.constants.iam.names.controller.profile,
        },
    }));
}

module.exports = run;
