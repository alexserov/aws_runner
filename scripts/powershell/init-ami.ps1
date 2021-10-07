function TagResource($resourceArn) {
    aws imagebuilder tag-resource --resource-arn $resourceArn --tags "dx-info=devextreme-ga"
}

#region Cleanup
################################

################################
Write-Output "Removing image recipes"
# https://eu-central-1.console.aws.amazon.com/imagebuilder/home#/imageRecipes
################################
foreach ($current in (ConvertFrom-Json(@(aws imagebuilder list-image-recipes) -join "")).imageRecipeSummaryList) {
    if($current.tags -and $current.tags."dx-info" -eq "devextreme-ga"){
        aws imagebuilder delete-image-recipe --image-recipe-arn $current.arn
    }    
}

################################
Write-Output "Removing components"
# https://eu-central-1.console.aws.amazon.com/imagebuilder/home#/components
################################
foreach ($current in (ConvertFrom-Json(@(aws imagebuilder list-components) -join "")).componentVersionList) {
    $tags = (ConvertFrom-Json(@(aws imagebuilder list-tags-for-resource --resource-id $current.arn) -join "")).tags;
    if($tags -and $tags."dx-info" -eq "devextreme-ga"){
        aws imagebuilder delete-component --component-arn $current.arn
    }    
}
aws s3 rm s3://devextreme-ga-configs/host-component.yaml

################################
Write-Output "Removing image pipelines"
# https://eu-central-1.console.aws.amazon.com/imagebuilder/home#/pipelines
################################
foreach ($current in (ConvertFrom-Json(@(aws imagebuilder list-image-pipelines) -join "")).imagePipelineList) {
    $tags = (ConvertFrom-Json(@(aws imagebuilder list-tags-for-resource --resource-arn $current.arn) -join "")).tags;
    if($tags -and $tags."dx-info" -eq "devextreme-ga"){
        aws imagebuilder delete-image-pipeline --image-pipeline-arn $current.arn
    }
}
################################
Write-Output "Removing infrastructure configs"
# https://eu-central-1.console.aws.amazon.com/imagebuilder/home#/infraConfigurations
################################
foreach ($current in (ConvertFrom-Json(@(aws imagebuilder list-infrastructure-configurations) -join "")).infrastructureConfigurationSummaryList) {
    $tags = (ConvertFrom-Json(@(aws imagebuilder list-tags-for-resource --resource-arn $current.arn) -join "")).tags;
    if($tags -and $tags."dx-info" -eq "devextreme-ga"){
        aws imagebuilder delete-infrastructure-configuration --infrastructure-configuration-arn $current.arn
    }    
}
#endregion

#region Creation
################################

$today=@(Get-Date -Format "yyyy.MM.dd");

################################
Write-Output "Create infrastructure config"
# https://eu-central-1.console.aws.amazon.com/imagebuilder/home#/infraConfigurations
################################
$subnets = (ConvertFrom-Json(@(aws ec2 describe-subnets --filter "Name=tag:dx-info,Values=devextreme-ga") -join "")).Subnets;
if($subnets.Length -eq 0){
    throw "No subnet found"
}
$securityGroups = (ConvertFrom-Json(@(aws ec2 describe-security-groups --filter "Name=tag:dx-info,Values=devextreme-ga") -join "")).SecurityGroups;
if($securityGroups.Length -eq 0){
    throw "No security groups found"
}
$subnetId = $subnets[0].SubnetId;
$imageConfigArn = (ConvertFrom-Json(@(
    aws imagebuilder create-infrastructure-configuration `
        --cli-input-json file://ami-configurations/host-infrastructure.json `
        --subnet-id $subnetId `
        --security-group-ids @(($securityGroups | ForEach-Object {$_.GroupId}) -join ' ') `
) -join "")).infrastructureConfigurationArn;
TagResource $imageConfigArn

################################
Write-Output "Create component"
# https://eu-central-1.console.aws.amazon.com/imagebuilder/home#/components
################################
aws s3 cp ./ami-configurations/host-component.yaml s3://devextreme-ga-configs
$componentArn = (ConvertFrom-Json(@(
    aws imagebuilder create-component `
        --cli-input-json file://ami-configurations/host-component.json `
        --semantic-version $today
) -join "")).componentBuildVersionArn;
TagResource $componentArn

################################
Write-Output "Create image recipe"
# https://eu-central-1.console.aws.amazon.com/imagebuilder/home#/imageRecipes
################################
$imageRecipeArn = (ConvertFrom-Json(@(
    aws imagebuilder create-image-recipe `
        --cli-input-json file://ami-configurations/host-image-recipe.json `
        --semantic-version $today
) -join "")).imageRecipeArn;
TagResource $imageRecipeArn

################################
Write-Output "Create image pipeline"
# https://eu-central-1.console.aws.amazon.com/imagebuilder/home#/pipelines
################################
$imagePipelineArn = (ConvertFrom-Json(@(
    aws imagebuilder create-image-pipeline `
        --cli-input-json file://ami-configurations/host-image-pipeline.json `
        --infrastructure-configuration-arn = $imageConfigArn `
        --image-recipe-arn $imageRecipeArn
) -join "")).imagePipelineArn;
TagResource $imagePipelineArn
#endregion
