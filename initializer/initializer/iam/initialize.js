const {
    IAMClient, CreateRoleCommand, PutRolePolicyCommand, CreateInstanceProfileCommand, AddRoleToInstanceProfileCommand,
} = require('@aws-sdk/client-iam');
const { readdirSync, readFileSync } = require('fs');
const { join, basename } = require('path');
const globalConstants = require('../global');
const constants = require('./constants');

async function InitializeRole(client, name, folder, logCallback) {
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
                PolicyDocument: readFileSync(join(__dirname, 'data', folder, `${policyFileName}.json`)).toString(),
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

    await InitializeRole(client, constants.names.imagebuilder, 'imagebuilder', logCallback);
    await InitializeRole(client, constants.names.dockerHost, 'docker-host', logCallback);
    await InitializeRole(client, constants.names.controller, 'controller', logCallback);
}

module.exports = Initialize;
