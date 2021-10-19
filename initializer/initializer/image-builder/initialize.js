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
} = require('@aws-sdk/client-iam');
const {
    EC2Client, DescribeSubnetsCommand, DescribeSecurityGroupsCommand, DescribeVpcsCommand,
} = require('@aws-sdk/client-ec2');
const { readFileSync } = require('fs');
const path = require('path');

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const globalConstants = require('../global');
const { constants: s3Constants } = require('../s3');
const constants = require('./constants');
const { constants: iamConstants } = require('../iam');

async function TagResource(client, resource, name) {
    await client.send(new TagResourceCommand({
        resourceArn: resource,
        tags: {
            Name: name,
            [globalConstants.tagName]: globalConstants.tagValue,
        },
    }));
}

async function InitializeImage(options, logCallback) {
    logCallback(`AMI Initialization: ${options.suffix}`);

    const client = new ImagebuilderClient();
    const ec2Client = new EC2Client();

    const todayValue = new Date();
    const today = `${todayValue.getFullYear()}.${(`0${todayValue.getMonth()}`).slice(-2)}.${(`0${todayValue.getDate()}`).slice(-2)}`;

    // ################################
    logCallback('\tCreate infrastructure config');
    // # https://eu-central-1.console.aws.amazon.com/imagebuilder/home#/infraConfigurations
    // ################################

    const defaultVpc = await ec2Client.send(new DescribeVpcsCommand({})).then((x) => (x.Vpcs || []).filter((v) => v.IsDefault)[0]?.VpcId);
    if (!defaultVpc) {
        throw new Error('No default VPC found');
    }
    const subnetId = await ec2Client.send(new DescribeSubnetsCommand({})).then((x) => x.Subnets.filter((s) => s.VpcId === defaultVpc)[0]?.SubnetId);
    if (!subnetId) throw new Error('No default subnet found');

    const securityGroupId = await ec2Client.send(new DescribeSecurityGroupsCommand({})).then((x) => x.SecurityGroups.filter((g) => g.VpcId === defaultVpc)[0]?.GroupId);
    if (!securityGroupId) throw new Error('No default security group found');

    const infrastructureConfiguration = await client.send(new CreateInfrastructureConfigurationCommand({
        name: options.names.infrastructureConfiguration,
        description: `Infrastructure config for DevExtreme Github Actions runner ${options.suffix}`,
        instanceProfileName: iamConstants.names.imagebuilder.profile,
        subnetId,
        securityGroupIds: [securityGroupId],
        terminateInstanceOnFailure: true,
    }));
    await TagResource(client, infrastructureConfiguration.infrastructureConfigurationArn, options.names.infrastructureConfiguration);

    // ################################
    logCallback('\tCreate component');
    // # https://eu-central-1.console.aws.amazon.com/imagebuilder/home#/components
    // ################################
    const component = await client.send(new CreateComponentCommand({
        name: options.names.component,
        description: `Initialization routines for GA runner ${options.suffix} machines`,
        changeDescription: 'Initial version',
        platform: 'Linux',
        supportedOsVersions: [
            'Ubuntu 20',
        ],
        data: readFileSync(path.join(__dirname, `data/${options.componentYaml}`)).toString(),
        semanticVersion: today,
    }));
    await TagResource(client, component.componentBuildVersionArn, options.names.component);

    // ################################
    logCallback('\tCreate image recipe');
    // # https://eu-central-1.console.aws.amazon.com/imagebuilder/home#/imageRecipes
    // ################################
    const imageRecipe = await client.send(new CreateImageRecipeCommand({
        name: options.names.imageRecipe,
        description: `Recipe for devextreme github actions runner ${options.suffix}`,
        components: [
            ...options.publicComponents,
            { componentArn: component.componentBuildVersionArn },
        ],
        parentImage: 'arn:aws:imagebuilder:eu-central-1:aws:image/ubuntu-server-20-lts-x86/x.x.x',
        semanticVersion: '1.0.0',
        blockDeviceMappings: [
            {
                deviceName: '/dev/sda1',
                ebs: {
                    encrypted: false,
                    deleteOnTermination: true,
                    volumeSize: 8,
                    volumeType: 'gp2',
                },
            },
        ],
        workingDirectory: '/tmp',
        additionalInstanceConfiguration: {
            systemsManagerAgent: {
                uninstallAfterBuild: false,
            },
        },
    }));
    await TagResource(client, imageRecipe.imageRecipeArn, options.names.imageRecipe);

    // ################################
    logCallback('\tCreate distribution configuration');
    // ################################
    const createDistributionConfigurationResponse = await client.send(new CreateDistributionConfigurationCommand({
        name: options.names.distributionConfiguration,
        distributions: [
            {
                region: globalConstants.region,
                amiDistributionConfiguration: {},
            },
        ],
    }));
    await TagResource(client, createDistributionConfigurationResponse.distributionConfigurationArn, options.names.distributionConfiguration);

    // ################################
    logCallback('\tCreate image pipeline');
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
async function PrepareConfigs(roleName, subdir, logCallback) {
    const s3Client = new S3Client();
    const iamClient = new IAMClient();

    logCallback(`\tConfiguring role for ${roleName}`);

    const controllerRole = await iamClient.send(new GetRoleCommand({
        RoleName: roleName,
    })).then((x) => x.Role.Arn);

    let config = readFileSync(path.join(__dirname, 'data/cli-config')).toString();
    config = config.replace('ROLE_ARN_VALUE', controllerRole).replace('REGION_VALUE', globalConstants.region);
    await s3Client.send(new PutObjectCommand({
        Bucket: s3Constants.names.bucket,
        Key: `${subdir}/aws-cli/config`,
        Body: config,
    }));
}

async function Initialize(logCallback) {
    await InitializeImage({
        suffix: 'host',
        names: constants.names.host,
        componentYaml: 'host-component.yaml',
        publicComponents: [
            { componentArn: 'arn:aws:imagebuilder:eu-central-1:aws:component/docker-ce-ubuntu/1.0.0/1' },
            { componentArn: 'arn:aws:imagebuilder:eu-central-1:aws:component/nodejs-12-lts-linux/1.0.1/1' },
        ],
    }, logCallback);
    await PrepareConfigs(iamConstants.names.dockerHost.role, 'docker-host', logCallback);

    await InitializeImage({
        suffix: 'listener',
        names: constants.names.listener,
        componentYaml: 'controller-component.yaml',
        publicComponents: [
            { componentArn: 'arn:aws:imagebuilder:eu-central-1:aws:component/nodejs-12-lts-linux/1.0.1/1' },
        ],
    }, logCallback);
    await PrepareConfigs(iamConstants.names.controller.role, 'controller', logCallback);
}

module.exports = Initialize;
