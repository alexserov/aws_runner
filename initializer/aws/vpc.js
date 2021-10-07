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

async function Cleanup() {
    const client = new EC2Client();
    // # Cleanup
    // # Stages (all points below applies to resources with the 'dx-info':'devextreme-ga' tag):
    // # --> 1 List all internet gateways, detach it from vpc and then remove
    // # --> 2 Remove subnets
    // # --> 3 Remove security groups
    // # --> 4 Remove VPCs
    
    const filterSettings = {
        Filters: [
            { Name: 'tag:dx-info', Values: ['devextreme-ga'] }
        ]
    };

    console.log('Removing Internet gateway');
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

    console.log('Removing subnets');
    const describeSubnetsResponse = await client.send(new DescribeSubnetsCommand(filterSettings));
    describeSubnetsResponse.Subnets?.forEach(async x => {
        await client.send(new DeleteSubnetCommand({
            SubnetId: x.SubnetId
        }));
    });

    console.log('Removing security groups');
    const describeGroupsResponse = await client.send(new DescribeSecurityGroupsCommand(filterSettings));
    describeGroupsResponse.SecurityGroups?.forEach(async x => {
        await client.send(new DeleteSecurityGroupCommand({
            GroupId: x.GroupId
        }));
    });

    console.log('Removing VPCs');
    const describeVpcsResponse = await client.send(new DescribeVpcsCommand(filterSettings));
    describeVpcsResponse.Vpcs?.forEach(async x => {
        await client.send(new DeleteVpcCommand({
            VpcId: x.VpcId
        }));
    });
}

async function Initialize() {
    async function SetResourceName(client, resourceId, resourceName) {
        await client.send(new CreateTagsCommand({
            Resources: [resourceId],
            Tags: [
                { Key: 'Name', Value: resourceName },
                { Key: 'dx-info', Value: 'devextreme-ga' }
            ]
        }));
    }

    const client = new EC2Client();
    // # https://eu-central-1.console.aws.amazon.com/vpc/home
    console.log('Creating VPC')
    const createVpcResponse = await client.send(new CreateVpcCommand({
        CidrBlock: '10.0.0.0/16'
    }));

    const vpcId = createVpcResponse.Vpc.VpcId;
    await SetResourceName(client, vpcId, 'devextreme-ga-vpc-0');

    // # https://eu-central-1.console.aws.amazon.com/vpc/home#igws:
    console.log('Creating Interntet gateway');
    const createInternetGatewayResponse = await client.send(new CreateInternetGatewayCommand({}));
    const internetGatewayId = createInternetGatewayResponse.InternetGateway.InternetGatewayId;
    await SetResourceName(client, internetGatewayId, 'devextreme-ga-gateway-0');

    await client.send(new AttachInternetGatewayCommand({
        InternetGatewayId: internetGatewayId,
        VpcId: vpcId
    }));
    // # https://eu-central-1.console.aws.amazon.com/vpc/home#subnets:
    console.log('Creating subnet');
    const createSubnetResponse = await client.send(new CreateSubnetCommand({
        VpcId: vpcId,
        CidrBlock: '10.0.1.0/16'
    }))
    SetResourceName(client, createSubnetResponse.Subnet.SubnetId, 'devextreme-ga-subnet-0')

    // # https://eu-central-1.console.aws.amazon.com/vpc/home#securityGroups:
    console.log('Creating security group');
    const createSecurityGroupResponse = await client.send(new CreateSecurityGroupCommand({
        GroupName: 'devextreme-ga-security-group',
        Description: 'Security group for devextreme Gitub Actions',
        VpcId: vpcId
    }));
    const securityGroupId = createSecurityGroupResponse.GroupId;
    SetResourceName(client, securityGroupId, 'devextreme-ga-security-group')

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
    Initialize
}
