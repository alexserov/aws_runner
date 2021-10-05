Write-Output "Removing infrastructure configurations"
foreach ($current in (ConvertFrom-Json(@(aws imagebuilder list-infrastructure-configurations) -join "")).infrastructureConfigurationSummaryList) {
    if($current.tags -and $current.tags."dx-info" -eq "devextreme-ga"){
        aws imagebuilder delete-infrastructure-configuration --infrastructure-configuration-arn $current.arn
    }    
}

$subnets = (ConvertFrom-Json(@(aws ec2 describe-subnets --filter "Name=tag:dx-info,Values=devextreme-ga") -join "")).Subnets;
if($subnets.Length -eq 0){
    throw "No subnet found"
}

$securityGroups = (ConvertFrom-Json(@(aws ec2 describe-security-groups --filter "Name=tag:dx-info,Values=devextreme-ga") -join "")).SecurityGroups;
if($securityGroups.Length -eq 0){
    throw "No subnet found"
}

$subnetId = $subnets[0].SubnetId;
$imageConfigArn = (ConvertFrom-Json(@(
    aws imagebuilder create-infrastructure-configuration `
        --cli-input-json file://ami-configurations/infrastructure.json `
        --subnet-id $subnetId `
        --security-group-ids @(($securityGroups | ForEach-Object {$_.GroupId}) -join ' ') `
) -join "")).infrastructureConfigurationArn;

$imageRecipeArn = (ConvertFrom-Json(@(
    aws imagebuilder create-infrastructure-configuration `
        --cli-input-json file://ami-configurations/image-recipe.json `
        --semantic-version @(Get-Date -Format "yyyy.MM.dd")
) -join "")).imageRecipeArn;

aws imagebuilder create-image-pipeline `
    --cli-input-json file://ami-configurations/image-pipeline.json `
    --infrastructure-configuration-arn = $imageConfigArn `
    --image-recipe-arn $imageRecipeArn

