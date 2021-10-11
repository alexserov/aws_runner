const {
    EC2Client,
    DescribeInternetGatewaysCommand,
    DetachInternetGatewayCommand,
    DeleteInternetGatewayCommand,
    DescribeSubnetsCommand,
    DeleteSubnetCommand,
    DescribeSecurityGroupsCommand,
    DeleteSecurityGroupCommand,
    DescribeVpcsCommand,
    DeleteVpcCommand,
    DescribeRouteTablesCommand,
    DeleteRouteCommand,
    DeleteRouteTableCommand,
    DisassociateRouteTableCommand,
    DeleteVpcEndpointsCommand,
    DescribeVpcEndpointsCommand} = require('@aws-sdk/client-ec2');
const {
    constants: globalConstants
} = require('../global');




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

    console.log('\tRemoving VPC endpoints');
    const describeVpcEndpointsResponse = await client.send(new DescribeVpcEndpointsCommand(filterSettings));
    await Promise.all(describeVpcEndpointsResponse.VpcEndpoints?.map(async x => {
        await client.send(new DeleteVpcEndpointsCommand({
            VpcEndpointIds: [x.VpcEndpointId]
        }));
        for (let i = 0; i < 12; i++) {
            const deletionResponse = await client.send(new DescribeVpcEndpointsCommand({
                VpcEndpointIds: [x.VpcEndpointId]
            }));
            if (deletionResponse.VpcEndpoints && deletionResponse.VpcEndpoints.length) {
                await new Promise(r => setTimeout(r, 10000));
                console.log(`\t\twaiting (${i} of 12`);
            }
        }
    }));

    console.log('\tRemoving Route tables');

    const describeRouteTablesResponse = await client.send(new DescribeRouteTablesCommand(filterSettings));
    
    await Promise.all(describeRouteTablesResponse.RouteTables?.map(async x => {
        await Promise.all(x.Associations.map(async r => {
            await client.send(new DisassociateRouteTableCommand({
                AssociationId: r.RouteTableAssociationId
            })).catch(() => {
                //do nothing
            });
        }));
        await Promise.all(x.Routes.map(async r => {
            await client.send(new DeleteRouteCommand({
                RouteTableId: x.RouteTableId,
                DestinationCidrBlock: r.DestinationCidrBlock
            })).catch(() => {
                //do nothing
            });
        }));
        await new Promise(r => setTimeout(r, 5000));
        await client.send(new DeleteRouteTableCommand({
            RouteTableId: x.RouteTableId
        }));
    }));

    console.log('\tRemoving Internet gateway');
    const describeGatewaysResponse = await client.send(new DescribeInternetGatewaysCommand(filterSettings));
    await Promise.all(describeGatewaysResponse.InternetGateways?.map(async x => {
        if (x.Attachments) {
            await Promise.all(x.Attachments.map(async att => {
                await client.send(new DetachInternetGatewayCommand({
                    InternetGatewayId: x.InternetGatewayId,
                    VpcId: att.VpcId
                }))
            }));
        }
        await client.send(new DeleteInternetGatewayCommand({
            InternetGatewayId: x.InternetGatewayId
        }));
    }));

    console.log('\tRemoving subnets');
    const describeSubnetsResponse = await client.send(new DescribeSubnetsCommand(filterSettings));
    await Promise.all(describeSubnetsResponse.Subnets?.map(async x => {
        await client.send(new DeleteSubnetCommand({
            SubnetId: x.SubnetId
        }));
    }));

    console.log('\tRemoving security groups');
    const describeGroupsResponse = await client.send(new DescribeSecurityGroupsCommand(filterSettings));
    await Promise.all(describeGroupsResponse.SecurityGroups?.map(async x => {
        await client.send(new DeleteSecurityGroupCommand({
            GroupId: x.GroupId
        }));
    }));

    console.log('\tRemoving VPCs');
    const describeVpcsResponse = await client.send(new DescribeVpcsCommand(filterSettings));
    await Promise.all(describeVpcsResponse.Vpcs?.map(async x => {
        for (let i = 0; i < 5; i++) {
            const deleteVpcResponse = await client.send(new DeleteVpcCommand({
                VpcId: x.VpcId
            })).then(() => true).catch(() => false);
            if (deleteVpcResponse) {
                return;
            }
            await new Promise(r => setTimeout(r, 5000));
        }
    }));
}

module.exports = Cleanup;
