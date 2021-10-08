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
} = require('@aws-sdk/client-imagebuilder');
const {
    constants: globalConstants
} = require('../global');

const constants = require('./constants');

async function Cleanup() {
    console.log('AMI Cleanup');
    const client = new ImagebuilderClient();
// ################################
    console.log('\tRemoving image pipelines');
// # https://eu-central-1.console.aws.amazon.com/imagebuilder/home#/pipelines
// ################################
    const listImagePipelinesResponse = await client.send(new ListImagePipelinesCommand({}));
    listImagePipelinesResponse.imagePipelineList?.forEach(async x => {
        if (x.tags && x.tags[globalConstants.tagName] === globalConstants.tagValue) {
            await client.send(new DeleteImagePipelineCommand({
                imagePipelineArn: x.arn
            }));
        }
    });
// ################################
    console.log('\tRemoving image recipes');
// # https://eu-central-1.console.aws.amazon.com/imagebuilder/home#/imageRecipes
// ################################
    const listImageRecipesResponse = await client.send(new ListImageRecipesCommand({}));
    listImageRecipesResponse.imageRecipeSummaryList?.forEach(async x => {
        if (x.tags && x.tags[globalConstants.tagName] === globalConstants.tagValue) {
            await client.send(new DeleteImageRecipeCommand({
                imageRecipeArn: x.arn
            }));
       }
    });

// ################################
    console.log('\tRemoving components');
// # https://eu-central-1.console.aws.amazon.com/imagebuilder/home#/components
// ################################
    const listComponentsResponse = await client.send(new ListComponentsCommand({}));
    const componentNames = [
        constants.names.host.component,
        constants.names.listener.component
    ];
    listComponentsResponse.componentVersionList?.forEach(async x => {
        // TODO: list tags commands throws a server error even if tag exists
        if (componentNames.includes(x.name)) {
            const listComponentBuildVersionsResponse = await client.send(new ListComponentBuildVersionsCommand({
                componentVersionArn: x.arn
            }));
            listComponentBuildVersionsResponse.componentSummaryList?.forEach(async z => {
                await client.send(new DeleteComponentCommand({
                    componentBuildVersionArn: z.arn
                }));
            });
        }
    });
// ################################
    console.log('\tRemoving infrastructure configs');
// # https://eu-central-1.console.aws.amazon.com/imagebuilder/home#/infraConfigurations
// ################################
    const listInfrastructureConfigurationsResponse = await client.send(new ListInfrastructureConfigurationsCommand({}));
    listInfrastructureConfigurationsResponse.infrastructureConfigurationSummaryList?.forEach(async x => {
        if (x.tags && x.tags[globalConstants.tagName] === globalConstants.tagValue) {
            await client.send(new DeleteInfrastructureConfigurationCommand({
                infrastructureConfigurationArn: x.arn
            }));
        }
    });
}

module.exports = Cleanup;
