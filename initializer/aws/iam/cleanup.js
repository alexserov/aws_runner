const {
    IAMClient, DeleteRoleCommand, DeleteRolePolicyCommand, ListRolePoliciesCommand, RemoveRoleFromInstanceProfileCommand, DeleteInstanceProfileCommand
} = require('@aws-sdk/client-iam');

const globalConstants = require('../global');
const constants = require('./constants');

async function CleanupRole(client, roleName, profileName) {
    const catchNoEntity = x => {
        if (x?.Code === 'NoSuchEntity') {
            //okay
        } else {
            throw new Error('Unknown error code');
        }
    };

    await client.send(new RemoveRoleFromInstanceProfileCommand({
        InstanceProfileName: profileName,
        RoleName: roleName
    })).catch(catchNoEntity);
    await client.send(new DeleteInstanceProfileCommand({
        InstanceProfileName: profileName
    })).catch(catchNoEntity);
    await client.send(new ListRolePoliciesCommand({
        RoleName: roleName
    })).catch(err => {
        if (err?.Code === 'NoSuchEntity') {
            return { PolicyNames: [] };
        } else {
            throw new Error('Unknown error code');
        }
    }).then(async (response) => {
        await Promise.all(response.PolicyNames.map(async (policy) => {
            await client.send(new DeleteRolePolicyCommand({
                PolicyName: policy,
                RoleName: roleName
            }));
        }));
    })
    await client.send(new DeleteRoleCommand({
        RoleName: constants.names.imagebuilder_role
    })).catch(catchNoEntity);
}

async function Cleanup() {
    console.log('IAM Cleanup');
    const client = new IAMClient();

    await CleanupRole(client, constants.names.imagebuilder_role, constants.names.imagebuilder_profile);
}

module.exports = Cleanup;
