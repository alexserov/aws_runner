const {
    IAMClient, DeleteRoleCommand, DeleteRolePolicyCommand, ListRolePoliciesCommand
} = require('@aws-sdk/client-iam');

const globalConstants = require('../global');
const constants = require('./constants');

async function CleanupRole(client, roleName) {
    await client.send(new ListRolePoliciesCommand({
        RoleName: roleName
    })).then(async (response) => {
        await Promise.all(response.PolicyNames.map(async (policy) => {
            await client.send(new DeleteRolePolicyCommand({
                PolicyName: policy,
                RoleName: roleName
            }));
        }));
    }).then(async () => {
        await client.send(new DeleteRoleCommand({
            RoleName: constants.names.imagebuilder_role
        })).catch(x => {
            if (x?.Code === 'NoSuchEntity') {
                //okay
            } else {
                throw new Error('Unknown error code');
            }
        });
    });
}

async function Cleanup() {
    console.log('Cleanup');
    const client = new IAMClient();

    await CleanupRole(client, constants.names.imagebuilder_role);
}

module.exports = Cleanup;
