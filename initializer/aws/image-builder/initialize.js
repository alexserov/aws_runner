const {
    ImagebuilderClient,
    CreateInfrastructureConfigurationCommand,
    TagResourceCommand,
    CreateComponentCommand,
    CreateImageRecipeCommand,
    CreateImagePipelineCommand,
    CreateDistributionConfigurationCommand,
} = require('@aws-sdk/client-imagebuilder');
const {
    IAMClient,
    GetRoleCommand,
} = require('@aws-sdk/client-iam')
const {
    EC2Client, DescribeSubnetsCommand, DescribeSecurityGroupsCommand, DescribeVpcsCommand
} = require('@aws-sdk/client-ec2')
const { readFileSync } = require('fs');
const path = require('path');

const globalConstants = require('../global');
const {
    constants: vpcConstants
} = require('../vpc');
const {
    constants: s3Constants
} = require('../s3');
const constants = require('./constants');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

async function TagResource(client, resource, name) {
    await client.send(new TagResourceCommand({
        resourceArn: resource,
        tags: {
            Name: name,
            [globalConstants.tagName]: globalConstants.tagValue
        }
    }));
}

async function InitializeImage(options) {
    console.log(`AMI Initialization: ${options.suffix}`);

    const client = new ImagebuilderClient();
    const ec2Client = new EC2Client();
    
    const todayValue = new Date();
    const today = `${todayValue.getFullYear()}.${('0'+todayValue.getMonth()).slice(-2)}.${('0'+todayValue.getDate()).slice(-2)}`;

// ################################
    console.log('\tCreate infrastructure config');
// # https://eu-central-1.console.aws.amazon.com/imagebuilder/home#/infraConfigurations
// ################################
    
    const defaultVpc = await ec2Client.send(new DescribeVpcsCommand({})).then(x => (x.Vpcs || []).filter(x => x.IsDefault)[0]?.VpcId);
    if (!defaultVpc) {
        throw new Error('No default VPC found');
    }
    const subnetId = await ec2Client.send(new DescribeSubnetsCommand({})).then(x => x.Subnets.filter(s => s.VpcId === defaultVpc)[0]?.SubnetId);
    if (!subnetId)
        throw new Error('No default subnet found');
    
    const securityGroupId = await ec2Client.send(new DescribeSecurityGroupsCommand({})).then(x => x.SecurityGroups.filter(g=>g.VpcId === defaultVpc)[0]?.GroupId);
    if (!securityGroupId)
        throw new Error('No default security group found');
    
    const infrastructureConfiguration = await client.send(new CreateInfrastructureConfigurationCommand({
        name: options.names.infrastructureConfiguration,
        description: `Infrastructure config for DevExtreme Github Actions runner ${options.suffix}`,
        instanceProfileName: 'EC2InstanceProfileForImageBuilder',
        subnetId: subnetId,
        securityGroupIds: [securityGroupId],
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
                    volumeSize: 8,
                    volumeType: 'gp2'
                }
            }
        ],
        workingDirectory: '/tmp',
        additionalInstanceConfiguration: {
            systemsManagerAgent: {
                uninstallAfterBuild: false,
            }
        }
    }));
    await TagResource(client, imageRecipe.imageRecipeArn, options.names.imageRecipe);

// ################################
    console.log('\tCreate distribution configuration')
// ################################
    const createDistributionConfigurationResponse = await client.send(new CreateDistributionConfigurationCommand({
        name: options.names.distributionConfiguration,
        distributions: [
            {
                region: globalConstants.region,
                amiDistributionConfiguration: {}
            }
        ]
    }));
    await TagResource(client, createDistributionConfigurationResponse.distributionConfigurationArn, options.names.distributionConfiguration);

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
        distributionConfigurationArn: createDistributionConfigurationResponse.distributionConfigurationArn,
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
    const s3Client = new S3Client();
    const iamClient = new IAMClient();

    const role = await iamClient.send(new GetRoleCommand({
        RoleName: 'EC2InstanceProfileForImageBuilder'
    })).then(x => x.Role.Arn);
    let config = readFileSync(path.join(__dirname, '../data/cli-config')).toString();
    config = config.replace('ROLE_ARN_VALUE', role).replace('REGION_VALUE', globalConstants.region);
    await s3Client.send(new PutObjectCommand({
        Bucket: s3Constants.names.bucket,
        Key: 'aws-cli/config',
        Body: config,
    }))
}

module.exports = Initialize;
