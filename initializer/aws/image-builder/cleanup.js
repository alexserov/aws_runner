const {
    ImagebuilderClient,
    ListImageRecipesCommand,
    DeleteImageRecipeCommand,
    ListComponentsCommand,
    DeleteComponentCommand,
    ListImagePipelinesCommand,
    DeleteImagePipelineCommand,
    ListInfrastructureConfigurationsCommand,
    DeleteInfrastructureConfigurationCommand,
    ListComponentBuildVersionsCommand,
    ListDistributionConfigurationsCommand,
    DeleteDistributionConfigurationCommand,
} = require('@aws-sdk/client-imagebuilder');

const globalConstants = require('../global');
const constants = require('./constants');

async function Cleanup() {
    console.log('AMI Cleanup');
    const client = new ImagebuilderClient();
    // ################################
    console.log('\tRemoving image pipelines');
    // # https://eu-central-1.console.aws.amazon.com/imagebuilder/home#/pipelines
    // ################################
    const listImagePipelinesResponse = await client.send(new ListImagePipelinesCommand({}));
    await Promise.all(listImagePipelinesResponse.imagePipelineList?.map(async (x) => {
        if (x.tags && x.tags[globalConstants.tagName] === globalConstants.tagValue) {
            await client.send(new DeleteImagePipelineCommand({
                imagePipelineArn: x.arn,
            }));
        }
    }));
    // ################################
    console.log('\tRemoving image recipes');
    // # https://eu-central-1.console.aws.amazon.com/imagebuilder/home#/imageRecipes
    // ################################
    const listImageRecipesResponse = await client.send(new ListImageRecipesCommand({}));
    await Promise.all(listImageRecipesResponse.imageRecipeSummaryList?.map(async (x) => {
        if (x.tags && x.tags[globalConstants.tagName] === globalConstants.tagValue) {
            await client.send(new DeleteImageRecipeCommand({
                imageRecipeArn: x.arn,
            }));
        }
    }));

    // ################################
    console.log('\tRemoving components');
    // # https://eu-central-1.console.aws.amazon.com/imagebuilder/home#/components
    // ################################
    const listComponentsResponse = await client.send(new ListComponentsCommand({}));
    const componentNames = [
        constants.names.host.component,
        constants.names.listener.component,
    ];
    await Promise.all(listComponentsResponse.componentVersionList?.map(async (x) => {
    // TODO: list tags commands throws a server error even if tag exists
        if (componentNames.includes(x.name)) {
            const listComponentBuildVersionsResponse = await client.send(new ListComponentBuildVersionsCommand({
                componentVersionArn: x.arn,
            }));
            await Promise.all(listComponentBuildVersionsResponse.componentSummaryList?.map(async (z) => {
                await client.send(new DeleteComponentCommand({
                    componentBuildVersionArn: z.arn,
                }));
            }));
        }
    }));
    // ################################
    console.log('\tRemoving infrastructure configs');
    // # https://eu-central-1.console.aws.amazon.com/imagebuilder/home#/infraConfigurations
    // ################################
    const listInfrastructureConfigurationsResponse = await client.send(new ListInfrastructureConfigurationsCommand({}));
    await Promise.all(listInfrastructureConfigurationsResponse.infrastructureConfigurationSummaryList?.map(async (x) => {
        if (x.tags && x.tags[globalConstants.tagName] === globalConstants.tagValue) {
            await client.send(new DeleteInfrastructureConfigurationCommand({
                infrastructureConfigurationArn: x.arn,
            }));
        }
    }));
    // ################################
    console.log('\tRemoving distribution configs');
    // ################################
    const listDistributionConfigurationsResponse = await client.send(new ListDistributionConfigurationsCommand({}));
    await Promise.all(listDistributionConfigurationsResponse.distributionConfigurationSummaryList?.map(async (x) => {
        if (x.tags && x.tags[globalConstants.tagName] === globalConstants.tagValue) {
            await client.send(new DeleteDistributionConfigurationCommand({
                distributionConfigurationArn: x.arn,
            }));
        }
    }));
}

module.exports = Cleanup;
