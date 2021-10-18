const {
    ImagebuilderClient,
    ListImagesCommand,
    ListImageBuildVersionsCommand,
} = require('@aws-sdk/client-imagebuilder');
const {
    EC2Client, RunInstancesCommand, DescribeSecurityGroupsCommand, DescribeSubnetsCommand, DescribeAddressesCommand, AssociateAddressCommand,
} = require('@aws-sdk/client-ec2');
const { readFileSync } = require('fs');
const { join } = require('path');
const config = require('../../config');

async function run() {
    const imagebuilderClient = new ImagebuilderClient({});
    const latestImageVersionArn = await imagebuilderClient.send(new ListImagesCommand({
        filters: [
            { name: 'name', values: [config.constants.imagebuilder.names.host.imageRecipe] },
        ],
    }))
        .then((x) => x.imageVersionList.sort((a, b) => new Date(a.dateCreated).valueOf() - new Date(b.dateCreated).valueOf()))
        .then((x) => x[0].arn);
    const latestImageBuild = await imagebuilderClient.send(new ListImageBuildVersionsCommand({
        imageVersionArn: latestImageVersionArn,
    }))
        .then((x) => x.imageSummaryList.sort((a, b) => new Date(a.dateCreated).valueOf() - new Date(b.dateCreated).valueOf()))
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

    const instances = await ec2Client.send(new RunInstancesCommand({
        MinCount: 1,
        MaxCount: 1,
        ImageId: imageId,
        SecurityGroupIds: [securityGroup.GroupId],
        SubnetId: subnet.SubnetId,
        UserData: readFileSync(join(__dirname, 'startup.sh')).toString('base64'),
    })).then((x) => x.Instances[0]);

    const allocatedAddress = await ec2Client.send(new DescribeAddressesCommand({
        Filters: [
            { Name: 'tag:Name', Values: [config.constants.vpc.names.run.elastic_ip] },
        ],
    })).then((x) => x.Addresses[0]);

    ec2Client.send(new AssociateAddressCommand({
        AllocationId: allocatedAddress.AllocationId,
        InstanceId: instances.InstanceId,
    }));
}

module.exports = run;
