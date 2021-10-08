const {
    EC2Client,
    DescribeInternetGatewaysCommand,
    DetachInternetGatewayCommand,
    DeleteInternetGatewayCommand,
    CreateTagsCommand,
    DescribeSubnetsCommand,
    DeleteSubnetCommand,
    DescribeSecurityGroupsCommand,
    DeleteSecurityGroupCommand,
    DescribeVpcsCommand,
    DeleteVpcCommand,
    CreateVpcCommand,
    CreateInternetGatewayCommand,
    AttachInternetGatewayCommand,
    CreateSubnetCommand,
    CreateSecurityGroupCommand,
    AuthorizeSecurityGroupEgressCommand
} = require('@aws-sdk/client-ec2');
const {
    constants: globalConstants
} = require('./global');

const constants = {
    names: {
        gateway: 'devextreme-ga-gateway-0',
        subnet: 'devextreme-ga-subnet-0',
        securityGroup: 'devextreme-ga-security-group',
        vpc: 'devextreme-ga-vpc-0'
    }
};

async function Cleanup() {
    console.log('VPC Cleanup');
    const client = new EC2Client();
    // # Cleanup
    // # Stages (all points below applies to resources with the 'dx-info':'devextreme-ga' tag):
    // # --> 1 List all internet gateways, detach it from vpc and then remove
    // # --> 2 Remove subnets
    // # --> 3 Remove security groups
    // # --> 4 Remove VPCs
    
    const filterSettings = {
        Filters: [
            { Name: `tag:${globalConstants.tagName}`, Values: [globalConstants.tagValue] }
        ]
    };

    console.log('\tRemoving Internet gateway');
    const describeGatewaysResponse = await client.send(new DescribeInternetGatewaysCommand(filterSettings));
    describeGatewaysResponse.InternetGateways?.forEach(async x => {
        if (x.Attachments) {
            x.Attachments.forEach(async att => {
                await client.send(new DetachInternetGatewayCommand({
                    InternetGatewayId: x.InternetGatewayId,
                    VpcId: att.VpcId
                }))
            });
        }
        await client.send(new DeleteInternetGatewayCommand({
            InternetGatewayId: x.InternetGatewayId
        }));
    });

    console.log('\tRemoving subnets');
    const describeSubnetsResponse = await client.send(new DescribeSubnetsCommand(filterSettings));
    describeSubnetsResponse.Subnets?.forEach(async x => {
        await client.send(new DeleteSubnetCommand({
            SubnetId: x.SubnetId
        }));
    });

    console.log('\tRemoving security groups');
    const describeGroupsResponse = await client.send(new DescribeSecurityGroupsCommand(filterSettings));
    describeGroupsResponse.SecurityGroups?.forEach(async x => {
        await client.send(new DeleteSecurityGroupCommand({
            GroupId: x.GroupId
        }));
    });

    console.log('\tRemoving VPCs');
    const describeVpcsResponse = await client.send(new DescribeVpcsCommand(filterSettings));
    describeVpcsResponse.Vpcs?.forEach(async x => {
        await client.send(new DeleteVpcCommand({
            VpcId: x.VpcId
        }));
    });
}

async function Initialize() {
    console.log('VPC Initialization');
    async function SetResourceName(client, resourceId, resourceName) {
        await client.send(new CreateTagsCommand({
            Resources: [resourceId],
            Tags: [
                { Key: 'Name', Value: resourceName },
                { Key: globalConstants.tagName, Value: globalConstants.tagValue }
            ]
        }));
    }

    const client = new EC2Client();
    // # https://eu-central-1.console.aws.amazon.com/vpc/home
    console.log('\tCreating VPC')
    const createVpcResponse = await client.send(new CreateVpcCommand({
        CidrBlock: '10.0.0.0/16'
    }));

    const vpcId = createVpcResponse.Vpc.VpcId;
    await SetResourceName(client, vpcId, constants.names.vpc);

    // # https://eu-central-1.console.aws.amazon.com/vpc/home#igws:
    console.log('\tCreating Interntet gateway');
    const createInternetGatewayResponse = await client.send(new CreateInternetGatewayCommand({}));
    const internetGatewayId = createInternetGatewayResponse.InternetGateway.InternetGatewayId;
    await SetResourceName(client, internetGatewayId, constants.names.gateway);

    await client.send(new AttachInternetGatewayCommand({
        InternetGatewayId: internetGatewayId,
        VpcId: vpcId
    }));
    // # https://eu-central-1.console.aws.amazon.com/vpc/home#subnets:
    console.log('\tCreating subnet');
    const createSubnetResponse = await client.send(new CreateSubnetCommand({
        VpcId: vpcId,
        CidrBlock: '10.0.1.0/16'
    }))
    SetResourceName(client, createSubnetResponse.Subnet.SubnetId, constants.names.subnet)

    // # https://eu-central-1.console.aws.amazon.com/vpc/home#securityGroups:
    console.log('\tCreating security group');
    const createSecurityGroupResponse = await client.send(new CreateSecurityGroupCommand({
        GroupName: constants.names.securityGroup,
        Description: 'Security group for devextreme Gitub Actions',
        VpcId: vpcId
    }));
    const securityGroupId = createSecurityGroupResponse.GroupId;
    SetResourceName(client, securityGroupId, constants.names.securityGroup)

    await client.send(new AuthorizeSecurityGroupEgressCommand({
        GroupId: securityGroupId,
        IpPermissions: [
            {
                IpProtocol: 'tcp',
                ToPort: 22,
                FromPort: 22,
                IpRanges: [
                    { CidrIp: '0.0.0.0/0' }
                ]
            }
        ]
    }));
}

module.exports = {
    Cleanup,
    Initialize,
    constants
}
