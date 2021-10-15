const {
    IAMClient, DeleteRoleCommand, DeleteRolePolicyCommand, ListRolePoliciesCommand, RemoveRoleFromInstanceProfileCommand, DeleteInstanceProfileCommand,
} = require('@aws-sdk/client-iam');

const constants = require('./constants');

async function CleanupRole(client, name, logCallback) {
    const catchNoEntity = (x) => {
        if (x?.Code === 'NoSuchEntity') {
            // okay
        } else {
            throw new Error('Unknown error code');
        }
    };

    logCallback(`\t${name}`);
    await client.send(new RemoveRoleFromInstanceProfileCommand({
        InstanceProfileName: name.profile,
        RoleName: name.role,
    })).catch(catchNoEntity);
    await client.send(new DeleteInstanceProfileCommand({
        InstanceProfileName: name.profile,
    })).catch(catchNoEntity);
    await client.send(new ListRolePoliciesCommand({
        RoleName: name.role,
    })).catch((err) => {
        if (err?.Code === 'NoSuchEntity') {
            return { PolicyNames: [] };
        }
        throw new Error('Unknown error code');
    }).then(async (response) => {
        await Promise.all(response.PolicyNames.map(async (policy) => {
            await client.send(new DeleteRolePolicyCommand({
                PolicyName: policy,
                RoleName: name.role,
            }));
        }));
    });
    await client.send(new DeleteRoleCommand({
        RoleName: name.role,
    })).catch(catchNoEntity);
}

async function Cleanup(logCallback) {
    logCallback('IAM Cleanup');
    const client = new IAMClient();

    await CleanupRole(client, constants.names.imagebuilder);
    await CleanupRole(client, constants.names.dockerHost);
    await CleanupRole(client, constants.names.controller);
}

module.exports = Cleanup;
