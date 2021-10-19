const {
    EC2Client,
    CreateTagsCommand,
    CreateVpcCommand,
    CreateInternetGatewayCommand,
    AttachInternetGatewayCommand,
    CreateSubnetCommand,
    CreateSecurityGroupCommand,
    AuthorizeSecurityGroupIngressCommand,
    CreateRouteTableCommand,
    CreateRouteCommand,
    AssociateRouteTableCommand,
    ModifyVpcAttributeCommand,
    CreateVpcEndpointCommand,
    DescribeVpcsCommand,
    CreateDefaultVpcCommand,
    AllocateAddressCommand,
    DescribeAddressesCommand,
} = require('@aws-sdk/client-ec2');

const globalConstants = require('../global');
const constants = require('./constants');

async function SetResourceName(client, resourceId, resourceName) {
    await client.send(new CreateTagsCommand({
        Resources: [resourceId],
        Tags: [
            { Key: 'Name', Value: resourceName },
            { Key: globalConstants.tagName, Value: globalConstants.tagValue },
        ],
    }));
}

async function InitializeVPC(options, logCallback) {
    logCallback('VPC Initialization');

    const client = new EC2Client();
    // # https://eu-central-1.console.aws.amazon.com/vpc/home
    logCallback('\tCreating VPC');
    const createVpcResponse = await client.send(new CreateVpcCommand({
        CidrBlock: options.cidr,

    }));

    const vpcId = createVpcResponse.Vpc.VpcId;
    await SetResourceName(client, vpcId, options.names.vpc);

    // # https://eu-central-1.console.aws.amazon.com/vpc/home#igws:
    logCallback('\tCreating Interntet gateway');
    const createInternetGatewayResponse = await client.send(new CreateInternetGatewayCommand({}));
    const internetGatewayId = createInternetGatewayResponse.InternetGateway.InternetGatewayId;
    await SetResourceName(client, internetGatewayId, options.names.gateway);

    await client.send(new AttachInternetGatewayCommand({
        InternetGatewayId: internetGatewayId,
        VpcId: vpcId,
    }));
    // # https://eu-central-1.console.aws.amazon.com/vpc/home#subnets:
    logCallback('\tCreating subnet');
    const createSubnetResponse = await client.send(new CreateSubnetCommand({
        VpcId: vpcId,
        CidrBlock: options.cidr,
    }));
    const subnetId = createSubnetResponse.Subnet.SubnetId;
    SetResourceName(client, subnetId, options.names.subnet);

    // # https://eu-central-1.console.aws.amazon.com/vpc/home#securityGroups:
    logCallback('\tCreating security group');
    const createSecurityGroupResponse = await client.send(new CreateSecurityGroupCommand({
        GroupName: options.names.securityGroup,
        Description: 'Security group for devextreme Gitub Actions',
        VpcId: vpcId,
    }));
    const securityGroupId = createSecurityGroupResponse.GroupId;
    SetResourceName(client, securityGroupId, options.names.securityGroup);

    const createRouteTableResponse = await client.send(new CreateRouteTableCommand({
        VpcId: vpcId,
    }));
    const routeTableId = createRouteTableResponse.RouteTable.RouteTableId;
    await SetResourceName(client, routeTableId, options.names.routeTable);

    await client.send(new CreateRouteCommand({
        RouteTableId: routeTableId,
        DestinationCidrBlock: '0.0.0.0/0',
        GatewayId: internetGatewayId,
    }));

    await client.send(new AssociateRouteTableCommand({
        SubnetId: subnetId,
        RouteTableId: routeTableId,
    }));

    return {
        vpcId,
        internetGatewayId,
        subnetId,
        securityGroupId,
        routeTableId,
    };
}
async function Initialize(logCallback) {
    const run = await InitializeVPC({
        names: constants.names.run,
        cidr: '10.0.0.0/16',
    }, logCallback);
    const client = new EC2Client();
    await client.send(new DescribeVpcsCommand({})).then(async (response) => {
        const defaultVpcs = response.Vpcs.filter((x) => x.IsDefault);
        if (!defaultVpcs || !defaultVpcs.length) {
            await client.send(new CreateDefaultVpcCommand());
        }
    });
    await client.send(new ModifyVpcAttributeCommand({
        VpcId: run.vpcId,
        EnableDnsSupport: {
            Value: true,
        },
    }));

    await client.send(new CreateVpcEndpointCommand({
        VpcId: run.vpcId,
        ServiceName: `com.amazonaws.${globalConstants.region}.s3`,
        VpcEndpointType: 'Gateway',
    }))
        .then((x) => x.VpcEndpoint.VpcEndpointId)
        .then((x) => SetResourceName(client, x, constants.names.run.endpoint_s3));

    await client.send(new AuthorizeSecurityGroupIngressCommand({
        GroupId: run.securityGroupId,
        IpPermissions: [
            {
                IpProtocol: 'tcp',
                ToPort: constants.ports.controllerPublic,
                FromPort: constants.ports.controllerPublic,
                IpRanges: [
                    { CidrIp: '0.0.0.0/0' },
                ],
            },
            {
                IpProtocol: 'tcp',
                ToPort: 443,
                FromPort: 443,
                IpRanges: [
                    { CidrIp: '0.0.0.0/0' },
                ],
            },
            {
                IpProtocol: '-1',
                UserIdGroupPairs: [
                    { GroupId: run.securityGroupId, VpcId: run.vpcId },
                ],
            },
        ],
    }));

    const allocatedAddresses = await client.send(new DescribeAddressesCommand({
        Filters: [
            { Name: `tag:${globalConstants.tagName}`, Values: [globalConstants.tagValue] },
        ],
    })).then((x) => x.Addresses);
    if (!allocatedAddresses.length) {
        const allocated = await client.send(new AllocateAddressCommand({

        }));
        await SetResourceName(client, allocated.AllocationId, constants.names.run.elastic_ip);
    }
}

module.exports = Initialize;
