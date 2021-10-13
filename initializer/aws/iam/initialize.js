const {
    IAMClient, CreateRoleCommand, PutRolePolicyCommand, CreateInstanceProfileCommand, AddRoleToInstanceProfileCommand,
} = require('@aws-sdk/client-iam');
const { readdirSync, readFileSync } = require('fs');
const { join, basename } = require('path');
const globalConstants = require('../global');
const constants = require('./constants');

async function InitializeRole(client, roleName, profileName, folder) {
    await client.send(new CreateRoleCommand({
        RoleName: roleName,
        AssumeRolePolicyDocument: readFileSync(join(__dirname, 'data', folder, 'trust-policy.json')).toString(),
        Tags: globalConstants.getTagsArray(roleName),
    })).then(async (response) => {
        const role = response.Role;

        await Promise.all(readdirSync(join(__dirname, 'data', folder)).map(async (fullPolicyFileNameWithExtension) => {
            const policyFileName = basename(fullPolicyFileNameWithExtension, '.json');
            if (policyFileName === 'trust-policy')
                return;

            await client.send(new PutRolePolicyCommand({
                RoleName: role.RoleName,
                PolicyDocument: readFileSync(join(__dirname, 'data', folder, `${policyFileName}.json`)).toString(),
                PolicyName: `devextreme-ga-policy-${policyFileName}`
            }));
        }));
    });
    await client.send(new CreateInstanceProfileCommand({
        InstanceProfileName: profileName,
        Path: '/',
        Tags: globalConstants.getTagsArray(roleName),
    }));

    await client.send(new AddRoleToInstanceProfileCommand({
        InstanceProfileName: profileName,
        RoleName: roleName
    }));
}

async function Initialize() {
    console.log('IAM Initialization');
    
    const client = new IAMClient();

    await InitializeRole(client, constants.names.imagebuilder_role, constants.names.imagebuilder_profile, 'imagebuilder');
}

module.exports = Initialize;
