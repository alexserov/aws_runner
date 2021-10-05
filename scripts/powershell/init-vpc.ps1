function SetResourceName($resourceId, $resourceName) {
    aws ec2 create-tags `
        --resources $resourceId `
        --tags "[
            {'Key':'Name','Value':'$resourceName'},
            {'Key':'dx-info','Value':'devextreme-ga'}
        ]".Replace("'", "\""");
}

# Cleanup
# Stages:
# 1 List all internet gateways, if it has 'dx-info':'devextreme-ga' tag, detach it from vpc and then remove
# 2 List all VPCs, remove if it has 'dx-info':'devextreme-ga' tag

foreach ($current in (ConvertFrom-Json(@(aws ec2 describe-internet-gateways --filter "Name=tag:dx-info,Values=devextreme-ga") -join "")).InternetGateways) { 
    if($current.Attachments){
        foreach ($att in $current.Attachments) {
            aws ec2 detach-internet-gateway `
                --internet-gateway-id $current.InternetGatewayId `
                --vpc-id $att.VpcId
        }
    }
    aws ec2 delete-internet-gateway --internet-gateway-id $current.InternetGatewayId
}
foreach ($current in (ConvertFrom-Json(@(aws ec2 describe-subnets --filter "Name=tag:dx-info,Values=devextreme-ga") -join "")).Vpcs) {
    aws ec2 delete-subnet --vpc-id $current.SubnetId
}
foreach ($current in (ConvertFrom-Json(@(aws ec2 describe-vpcs --filter "Name=tag:dx-info,Values=devextreme-ga") -join "")).Vpcs) {
    aws ec2 delete-vpc --vpc-id $current.VpcId
}

# https://eu-central-1.console.aws.amazon.com/vpc/home
$vpcInfo = aws ec2 create-vpc `
    --cidr-block 10.0.0.0/16

$vpcId = (ConvertFrom-Json($vpcInfo -join "")).Vpc.VpcId

SetResourceName $vpcId "devextreme-ga-vpc-0"

# https://eu-central-1.console.aws.amazon.com/vpc/home#igws:
$gatewayId = (ConvertFrom-Json(@(
    aws ec2 create-internet-gateway
) -join "")).InternetGateway.InternetGatewayId

SetResourceName $gatewayId "devextreme-ga-gateway-0"

aws ec2 attach-internet-gateway `
    --internet-gateway-id $gatewayId `
    --vpc-id $vpcId

$subnetInfo = (ConvertFrom-Json(@(
    aws ec2 create-subnet `
        --vpc-id $vpcId `
        --cidr-block 10.0.1.0/16
) -join "")).Subnet

SetResourceName $subnetInfo.SubnetId "devextreme-ga-subnet-0"
