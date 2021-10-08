const {
    ImagebuilderClient,
    CreateInfrastructureConfigurationCommand,
    TagResourceCommand,
    CreateComponentCommand,
    CreateImageRecipeCommand,
    CreateImagePipelineCommand,
} = require('@aws-sdk/client-imagebuilder');
const {
    EC2Client, DescribeSubnetsCommand, DescribeSecurityGroupsCommand
} = require('@aws-sdk/client-ec2')
const { readFileSync } = require('fs');
const path = require('path');
const {
    constants: globalConstants
} = require('../global');
const {
    constants: s3Constants
} = require('../s3');
const constants = require('./constants');

async function InitializeImage(options) {
    console.log(`AMI Initialization: ${options.suffix}`);
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
        name: options.names.infrastructureConfiguration,
        description: `Infrastructure config for DevExtreme Github Actions runner ${options.suffix}`,
        instanceTypes: [
            options.instanceType
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
    await TagResource(client, infrastructureConfiguration.infrastructureConfigurationArn, options.names.infrastructureConfiguration)

// ################################
    console.log('\tCreate component');
// # https://eu-central-1.console.aws.amazon.com/imagebuilder/home#/components
// ################################
    const component = await client.send(new CreateComponentCommand({
        name: options.names.component,
        description: `Initialization routines for GA runner ${options.suffix} machines`,
        changeDescription: 'Initial version',
        platform: 'Linux',
        supportedOsVersions: [
            'Ubuntu 20'
        ],
        data: readFileSync(path.join(__dirname, `../data/${options.componentYaml}`)).toString(),
        semanticVersion: today
    }));
    await TagResource(client, component.componentBuildVersionArn, options.names.component);

// ################################
    console.log('\tCreate image recipe');
// # https://eu-central-1.console.aws.amazon.com/imagebuilder/home#/imageRecipes
// ################################
    const imageRecipe = await client.send(new CreateImageRecipeCommand({
        name: options.names.imageRecipe,
        description: `Recipe for devextreme github actions runner ${options.suffix}`,
        components: [
            ...options.publicComponents,
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
    await TagResource(client, imageRecipe.imageRecipeArn, options.names.imageRecipe);

// ################################
    console.log('\tCreate image pipeline')
// # https://eu-central-1.console.aws.amazon.com/imagebuilder/home#/pipelines
// ################################
    const imagePipeline = await client.send(new CreateImagePipelineCommand({
        name: options.names.imagePipeline,
        description: `Image pipeline for DevExtreme Github Actions runner ${options.suffix}`,
        enhancedImageMetadataEnabled: true,
        infrastructureConfigurationArn: infrastructureConfiguration.infrastructureConfigurationArn,
        imageRecipeArn: imageRecipe.imageRecipeArn,
        status: 'ENABLED',
    }));
    await TagResource(client, imagePipeline.imagePipelineArn, options.names.imagePipeline);
}

async function Initialize() {
    await InitializeImage({
        suffix: 'host',
        names: constants.names['host'],
        instanceType: 'm5.large',
        componentYaml: 'host-component.yaml',
        publicComponents: [
            { componentArn: 'arn:aws:imagebuilder:eu-central-1:aws:component/docker-ce-ubuntu/1.0.0/1' },
            { componentArn: 'arn:aws:imagebuilder:eu-central-1:aws:component/nodejs-12-lts-linux/1.0.1/1' }
        ]
    });
    await InitializeImage({
        suffix: 'listener',
        names: constants.names['listener'],
        instanceType: 't2.nano',
        componentYaml: 'controller-component.yaml',
        publicComponents: []
    });
}

module.exports = Initialize;