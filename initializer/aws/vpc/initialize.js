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
    UpdateSecurityGroupRuleDescriptionsIngressCommand,
    DescribeVpcEndpointsCommand,
} = require('@aws-sdk/client-ec2');
const {
    constants: globalConstants
} = require('../global');
const constants = require('./constants');

async function SetResourceName(client, resourceId, resourceName) {
    await client.send(new CreateTagsCommand({
        Resources: [resourceId],
        Tags: [
            { Key: 'Name', Value: resourceName },
            { Key: globalConstants.tagName, Value: globalConstants.tagValue }
        ]
    }));
}

async function InitializeVPC(options) {
    console.log('VPC Initialization');

    const client = new EC2Client();
    // # https://eu-central-1.console.aws.amazon.com/vpc/home
    console.log('\tCreating VPC')
    const createVpcResponse = await client.send(new CreateVpcCommand({
        CidrBlock: options.cidr,

    }));

    const vpcId = createVpcResponse.Vpc.VpcId;
    await SetResourceName(client, vpcId, options.names.vpc);

    // # https://eu-central-1.console.aws.amazon.com/vpc/home#igws:
    console.log('\tCreating Interntet gateway');
    const createInternetGatewayResponse = await client.send(new CreateInternetGatewayCommand({}));
    const internetGatewayId = createInternetGatewayResponse.InternetGateway.InternetGatewayId;
    await SetResourceName(client, internetGatewayId, options.names.gateway);

    await client.send(new AttachInternetGatewayCommand({
        InternetGatewayId: internetGatewayId,
        VpcId: vpcId
    }));
    // # https://eu-central-1.console.aws.amazon.com/vpc/home#subnets:
    console.log('\tCreating subnet');
    const createSubnetResponse = await client.send(new CreateSubnetCommand({
        VpcId: vpcId,
        CidrBlock: options.cidr
    }))
    const subnetId = createSubnetResponse.Subnet.SubnetId;
    SetResourceName(client, subnetId, options.names.subnet)

    // # https://eu-central-1.console.aws.amazon.com/vpc/home#securityGroups:
    console.log('\tCreating security group');
    const createSecurityGroupResponse = await client.send(new CreateSecurityGroupCommand({
        GroupName: options.names.securityGroup,
        Description: 'Security group for devextreme Gitub Actions',
        VpcId: vpcId
    }));
    const securityGroupId = createSecurityGroupResponse.GroupId;
    SetResourceName(client, securityGroupId, options.names.securityGroup)

    await client.send(new AuthorizeSecurityGroupIngressCommand({
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

    const createRouteTableResponse = await client.send(new CreateRouteTableCommand({
        VpcId: vpcId,
    }));
    const routeTableId = createRouteTableResponse.RouteTable.RouteTableId;
    await SetResourceName(client, routeTableId, options.names.routeTable);

    const createRouteResponse = await client.send(new CreateRouteCommand({
        RouteTableId: routeTableId,
        DestinationCidrBlock: '0.0.0.0/0',
        GatewayId: internetGatewayId
    }));

    const associateRouteTableResponse = await client.send(new AssociateRouteTableCommand({
        SubnetId: subnetId,
        RouteTableId: routeTableId
    }));

    return {
        vpcId,
        internetGatewayId,
        subnetId,
        securityGroupId,
        routeTableId
    }
}
async function Initialize() {
    const build = await InitializeVPC({
        names: constants.names.build,
        cidr: '172.31.0.0/16'
    });
    const run = await InitializeVPC({
        names: constants.names.run,
        cidr: '10.0.0.0/16'
    });
    //TODO pass client as arg to functions above
    const client = new EC2Client();
    const modifyVpcAttributeResponse1 = await client.send(new ModifyVpcAttributeCommand({
        VpcId: build.vpcId,
        EnableDnsSupport: {
            Value: true
        }
    }));
    const modifyVpcAttributeResponse2 = await client.send(new ModifyVpcAttributeCommand({
        VpcId: build.vpcId,
        EnableDnsHostnames: {
            Value: true
        }
    }));
    await client.send(new AuthorizeSecurityGroupIngressCommand({
        GroupId: build.securityGroupId,
        IpPermissions: [
            {
                IpProtocol: 'tcp',
                ToPort: 443,
                FromPort: 443,
                IpRanges: [
                    { CidrIp: '0.0.0.0/0' },
                    { CidrIp: '172.31.0.0/16' }
                ]
            }
        ]
    }));
    const endpointIds = await Promise.all(constants.endpointSuffixes.map(async service => {
        const createVpcEndpointResponse = await client.send(new CreateVpcEndpointCommand({
            VpcId: build.vpcId,
            ServiceName: `com.amazonaws.${globalConstants.region}.${service}`,
            SubnetIds: [build.subnetId],
            SecurityGroupIds: [build.securityGroupId],
            PrivateDnsEnabled: true,
            VpcEndpointType: 'Interface',
        }));
        const id = createVpcEndpointResponse.VpcEndpoint.VpcEndpointId
        SetResourceName(client, createVpcEndpointResponse.VpcEndpoint.VpcEndpointId, constants.names.build[`endpoint_${service}`]);
        return id;
    }));
    for (let i = 0; i < 30; i++){
        const describeVpcEndpointsResponse = await client.send(new DescribeVpcEndpointsCommand({
            VpcEndpointIds: endpointIds
        }));
        const allInitialized = describeVpcEndpointsResponse.VpcEndpoints.every(x => x.State === 'available');
        if (!allInitialized) {
            await new Promise(r => setTimeout(r, 30000));
            console.log(`\t\twaiting for endpoint initialization (${i} of 30)`);
        }
    }
}

module.exports = Initialize;
