const {
    IAMClient, CreateRoleCommand, PutRolePolicyCommand,
} = require('@aws-sdk/client-iam');
const { readdirSync, readFileSync } = require('fs');
const { join, basename } = require('path');
const globalConstants = require('../global');
const constants = require('./constants');

function InitializeRole(client, name, folder) {
    client.send(new CreateRoleCommand({
        RoleName: name,
        AssumeRolePolicyDocument: readFileSync(join(__dirname, 'data', folder, 'trust-policy.json')).toString(),
        Tags: globalConstants.getTagsArray(name),
    })).then(async (response) => {
        const role = response.Role;

        await Promise.all(readdirSync(join(__dirname, 'data', folder)).map(async (fullPolicyFileNameWithExtension) => {
            const policyFileName = basename(fullPolicyFileNameWithExtension, '.json');
            if (policyFileName === 'trust-policy')
                return;

            await client.send(new PutRolePolicyCommand({
                RoleName: role.RoleName,
                PolicyDocument: readFileSync(join(__dirname, data, folder, `${policyFileName}.json`)).toString(),
                PolicyName: `devextreme-ga-policy-${policyFileName}`
            }));
        }));
    });
}

async function Initialize() {
    console.log('IAM Initialization');
    
    const client = new IAMClient();

    InitializeRole(client, constants.names.imagebuilder_role, 'imagebuilder');
}

module.exports = Initialize;
