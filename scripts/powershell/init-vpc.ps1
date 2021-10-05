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

foreach ($currVpc in (ConvertFrom-Json(@(aws ec2 describe-internet-gateways) -join "")).InternetGateways) {
    $tag = $currVpc.Tags | Where-Object { $_.Key -eq "dx-info" };
    if($tag -and $tag.Value -eq "devextreme-ga"){
        if($currVpc.Attachments){
            foreach ($att in $currVpc.Attachments) {
                aws ec2 detach-internet-gateway `
                    --internet-gateway-id $currVpc.InternetGatewayId `
                    --vpc-id $att.VpcId
            }
        }
        aws ec2 delete-internet-gateway --internet-gateway-id $currVpc.InternetGatewayId
    }
}
foreach ($currVpc in (ConvertFrom-Json(@(aws ec2 describe-vpcs) -join "")).Vpcs) {
    $tag = $currVpc.Tags | Where-Object { $_.Key -eq "dx-info" };
    if($tag -and $tag.Value -eq "devextreme-ga"){
        aws ec2 delete-vpc --vpc-id $currVpc.VpcId
    }
}

# https://eu-central-1.console.aws.amazon.com/vpc/home
$vpcInfo = aws ec2 create-vpc `
    --cidr-block 10.0.0.0/16

$vpcInfo = ConvertFrom-Json($vpcInfo -join "")

SetResourceName $vpcInfo.Vpc.VpcId "devextreme-ga-vpc-0"

# https://eu-central-1.console.aws.amazon.com/vpc/home#igws:
$gatewayId = (ConvertFrom-Json(@(
    aws ec2 create-internet-gateway
) -join "")).InternetGateway.InternetGatewayId

SetResourceName $gatewayId "devextreme-ga-gateway-0"

aws ec2 attach-internet-gateway `
    --internet-gateway-id $gatewayId `
    --vpc-id $vpcInfo.Vpc.VpcId
