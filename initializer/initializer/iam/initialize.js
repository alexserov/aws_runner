const {
    IAMClient, CreateRoleCommand, PutRolePolicyCommand, CreateInstanceProfileCommand, AddRoleToInstanceProfileCommand,
} = require('@aws-sdk/client-iam');
const {
    SecretsManagerClient, GetSecretValueCommand,
} = require('@aws-sdk/client-secrets-manager');

const { readdirSync, readFileSync } = require('fs');
const { join, basename } = require('path');
const globalConstants = require('../global');
const constants = require('./constants');

function performReplacements(data, replacements) {
    if (!replacements) {
        return data;
    }
    let result = data;
    Object.keys(replacements).forEach((x) => {
        result = result.replace(x, replacements[x]);
    });
    return result;
}

async function InitializeRole(client, name, folder, replacements, logCallback) {
    logCallback(`\tRole:(${name.role})`);

    await client.send(new CreateRoleCommand({
        RoleName: name.role,
        AssumeRolePolicyDocument: readFileSync(join(__dirname, 'data', folder, 'trust-policy.json')).toString(),
        Tags: globalConstants.getTagsArray(name.role),
    })).then(async (response) => {
        const role = response.Role;

        await Promise.all(readdirSync(join(__dirname, 'data', folder)).map(async (fullPolicyFileNameWithExtension) => {
            const policyFileName = basename(fullPolicyFileNameWithExtension, '.json');
            if (policyFileName === 'trust-policy') return;

            await client.send(new PutRolePolicyCommand({
                RoleName: role.RoleName,
                PolicyDocument: performReplacements(readFileSync(join(__dirname, 'data', folder, `${policyFileName}.json`)).toString(), replacements),
                PolicyName: `devextreme-ga-policy-${policyFileName}`,
            }));
        }));
    });
    logCallback(`\tProfile:(${name.profile})`);
    await client.send(new CreateInstanceProfileCommand({
        InstanceProfileName: name.profile,
        Path: '/',
        Tags: globalConstants.getTagsArray(name.role),
    }));

    await client.send(new AddRoleToInstanceProfileCommand({
        InstanceProfileName: name.profile,
        RoleName: name.role,
    }));
}

async function Initialize(logCallback) {
    logCallback('IAM Initialization');

    const client = new IAMClient();
    const smClient = new SecretsManagerClient();

    const secret = await smClient.send(new GetSecretValueCommand({
        SecretId: constants.secretId,
    }));

    await InitializeRole(client, constants.names.imagebuilder, 'imagebuilder', null, logCallback);
    await InitializeRole(client, constants.names.dockerHost, 'docker-host', null, logCallback);
    await InitializeRole(client, constants.names.controller, 'controller', {
        AWS_SECRETMANAGER_RESOURCE_NAME: secret.ARN,
    }, logCallback);
}

module.exports = Initialize;
