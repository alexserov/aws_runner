$subnets = (ConvertFrom-Json(@(aws ec2 describe-subnets --filter "Name=tag:dx-info,Values=devextreme-ga") -join "")).Subnets;
if($subnets.Length -eq 0){
    throw "No subnet found"
}

$subnetId = $subnets[0].SubnetId;
aws imagebuilder create-infrastructure-configuration `
    --cli-input-json file://ami-configurations/infrastructure.json `
    --subnet-id $subnetId

# aws imagebuilder create-image-pipeline `
#     --cli-input-json file://ami-configurations/image-pipeline.json `
#     --infrastructure-configuration-arn

