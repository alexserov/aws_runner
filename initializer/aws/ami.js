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
    CreateInfrastructureConfigurationCommand,
    TagResourceCommand,
    CreateComponentCommand,
    CreateImageRecipeCommand,
    CreateImagePipelineCommand,
    ListComponentBuildVersionsCommand,
} = require('@aws-sdk/client-imagebuilder');
const {
    EC2Client, DescribeSubnetsCommand, DescribeSecurityGroupsCommand, Tag
} = require('@aws-sdk/client-ec2')
const { readFileSync } = require('fs');
const path = require('path');
const {
    constants: globalConstants
} = require('./global');
const {
    constants: s3Constants
} = require('./s3');

const constants = {
    names: {
        infrastructureConfiguration: 'devextreme-ga-infrastructure-config',
        component: 'devextreme-ga-host-component',
        imageRecipe: 'devextreme-ga-recipe',
        imagePipeline: 'devextreme-ga-image-pipeline'
    }
};

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
        constants.names.component
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
async function Initialize() {
    console.log('AMI Initialization');
    async function TagResource(client, resource, name) {
        await client.send(new TagResourceCommand({
            resourceArn: resource,
            tags: {
                Name: name,
                [globalConstants.tagName]: globalConstants.tagValue
            }
        }));
    }
    const client = new ImagebuilderClient();
    const ec2Client = new EC2Client();
    
    const todayValue = new Date();
    const today = `${todayValue.getFullYear()}.${('0'+todayValue.getMonth()).slice(-2)}.${('0'+todayValue.getDate()).slice(-2)}`;

// ################################
    console.log('\tCreate infrastructure config');
// # https://eu-central-1.console.aws.amazon.com/imagebuilder/home#/infraConfigurations
// ################################
    const ec2FilterSettings = {
        Filters: [
            { Name: `tag:${globalConstants.tagName}`, Values: [globalConstants.tagValue] }
        ]
    };
    const subnets = (await ec2Client.send(new DescribeSubnetsCommand(ec2FilterSettings))).Subnets;
    if (!subnets || !subnets.length)
        throw new Error('No subnet found');
    const securityGroups = (await ec2Client.send(new DescribeSecurityGroupsCommand(ec2FilterSettings))).SecurityGroups;
    if (!securityGroups || !securityGroups.length)
        throw new Error('No security groups found');
    
    const infrastructureConfiguration = await client.send(new CreateInfrastructureConfigurationCommand({
        name: constants.names.infrastructureConfiguration,
        description: 'Infrastructure config for DevExtreme Github Actions runner host',
        instanceTypes: [
            'm5.large'
        ],
        instanceProfileName: 'EC2InstanceProfileForImageBuilder',
        logging: {
            s3Logs: {
                s3BucketName: s3Constants.names.bucket,
                s3KeyPrefix: 'dxga'
            }
        },
        subnetId: subnets[0].SubnetId,
        securityGroupIds: securityGroups.map(x=>x.GroupId),
        terminateInstanceOnFailure: true,
    }));
    await TagResource(client, infrastructureConfiguration.infrastructureConfigurationArn, constants.names.infrastructureConfiguration)

// ################################
    console.log('\tCreate component');
// # https://eu-central-1.console.aws.amazon.com/imagebuilder/home#/components
// ################################
    const component = await client.send(new CreateComponentCommand({
        name: constants.names.component,
        description: 'Initialization routines for GA runner host machines',
        changeDescription: 'Initial version',
        platform: 'Linux',
        supportedOsVersions: [
            'Ubuntu 20'
        ],
        data: readFileSync(path.join(__dirname, 'data/host-component.yaml')).toString(),
        semanticVersion: today
    }));
    await TagResource(client, component.componentBuildVersionArn, constants.names.component);

// ################################
    console.log('\tCreate image recipe');
// # https://eu-central-1.console.aws.amazon.com/imagebuilder/home#/imageRecipes
// ################################
    const imageRecipe = await client.send(new CreateImageRecipeCommand({
        name: constants.names.imageRecipe,
        description: 'Recipe for devextreme github actions runner host',
        components: [
            { componentArn: 'arn:aws:imagebuilder:eu-central-1:aws:component/docker-ce-ubuntu/1.0.0/1' },
            { componentArn: 'arn:aws:imagebuilder:eu-central-1:aws:component/nodejs-12-lts-linux/1.0.1/1' },
            { componentArn: component.componentBuildVersionArn }
        ],
        parentImage: 'arn:aws:imagebuilder:eu-central-1:aws:image/ubuntu-server-20-lts-x86/x.x.x',
        semanticVersion: today,
        blockDeviceMappings: [
            {
                deviceName: '/dev/sda1',
                ebs: {
                    encrypted: false,
                    deleteOnTermination: true,
                    iops: 100,
                    volumeSize: 8,
                    volumeType: 'gp2'
                }
            }
        ],
        workingDirectory: '/tmp',
        additionalInstanceConfiguration: {
            systemsManagerAgent: {
                uninstallAfterBuild: false
            }
        }
    }));
    await TagResource(client, imageRecipe.imageRecipeArn, constants.names.imageRecipe);

// ################################
    console.log('\tCreate image pipeline')
// # https://eu-central-1.console.aws.amazon.com/imagebuilder/home#/pipelines
// ################################
    const imagePipeline = await client.send(new CreateImagePipelineCommand({
        name: constants.names.imagePipeline,
        description: 'Image pipeline for DevExtreme Github Actions runner host',
        enhancedImageMetadataEnabled: true,
        infrastructureConfigurationArn: infrastructureConfiguration.infrastructureConfigurationArn,
        imageRecipeArn: imageRecipe.imageRecipeArn,
        status: 'ENABLED',
    }));
    await TagResource(client, imagePipeline.imagePipelineArn, constants.names.imagePipeline);
}

module.exports = {
    Cleanup,
    Initialize,
    constants
}
