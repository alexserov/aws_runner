function SetResourceName($resourceId, $resourceName) {
    aws ec2 create-tags `
        --resources $resourceId `
        --tags "[
            {'Key':'Name','Value':'$resourceName'},
            {'Key':'dx-info','Value':'devextreme-ga'}
        ]".Replace("'", "\""");
}

# Cleanup
# Stages (all points below applies to resources with the 'dx-info':'devextreme-ga' tag):
# --> 1 List all internet gateways, detach it from vpc and then remove
# --> 2 Remove subnets
# --> 3 Remove security groups
# --> 4 Remove VPCs

Write-Output "Removing Internet gateway"
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
Write-Output "Removing subnets"
foreach ($current in (ConvertFrom-Json(@(aws ec2 describe-subnets --filter "Name=tag:dx-info,Values=devextreme-ga") -join "")).Subnets) {
    aws ec2 delete-subnet --subnet-id $current.SubnetId
}
Write-Output "Removing security groups"
foreach ($current in (ConvertFrom-Json(@(aws ec2 describe-security-groups --filter "Name=tag:dx-info,Values=devextreme-ga") -join "")).SecurityGroups) {
    aws ec2 delete-security-group --group-id $current.GroupId
}
Write-Output "Removing VPCs"
foreach ($current in (ConvertFrom-Json(@(aws ec2 describe-vpcs --filter "Name=tag:dx-info,Values=devextreme-ga") -join "")).Vpcs) {
    aws ec2 delete-vpc --vpc-id $current.VpcId
}

# https://eu-central-1.console.aws.amazon.com/vpc/home
Write-Output "Creating VPC"
$vpcInfo = aws ec2 create-vpc `
    --cidr-block 10.0.0.0/16

$vpcId = (ConvertFrom-Json($vpcInfo -join "")).Vpc.VpcId

SetResourceName $vpcId "devextreme-ga-vpc-0"

# https://eu-central-1.console.aws.amazon.com/vpc/home#igws:
Write-Output "Creating Interntet gateway"
$gatewayId = (ConvertFrom-Json(@(
    aws ec2 create-internet-gateway
) -join "")).InternetGateway.InternetGatewayId

SetResourceName $gatewayId "devextreme-ga-gateway-0"

aws ec2 attach-internet-gateway `
    --internet-gateway-id $gatewayId `
    --vpc-id $vpcId

# https://eu-central-1.console.aws.amazon.com/vpc/home#subnets:
Write-Output "Creating subnet"
$subnetInfo = (ConvertFrom-Json(@(
    aws ec2 create-subnet `
        --vpc-id $vpcId `
        --cidr-block 10.0.1.0/16
) -join "")).Subnet

SetResourceName $subnetInfo.SubnetId "devextreme-ga-subnet-0"

# https://eu-central-1.console.aws.amazon.com/vpc/home#securityGroups:
Write-Output "Creating security group"
$securityGroupId = (ConvertFrom-Json(@(
    aws ec2 create-security-group `
        --group-name devextreme-ga-security-group `
        --description "Security group for devextreme Gitub Actions" `
        --vpc-id $vpcId
) -join "")).GroupId

SetResourceName $securityGroupId "devextreme-ga-security-group"

$rulesOutput = (ConvertFrom-Json(@(
    aws ec2 authorize-security-group-egress `
        --group-id $securityGroupId `
        --protocol tcp `
        --port 22 `
        --cidr 0.0.0.0/0
) -join ""))
