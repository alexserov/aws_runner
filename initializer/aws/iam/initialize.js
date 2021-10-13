const {
    IAMClient, CreateRoleCommand,
} = require('@aws-sdk/client-iam');
const globalConstants = require('../global');
const constants = require('./constants');

async function Initialize() {
    console.log('IAM Initialization');
    
    const client = new IAMClient();

    // client.send(new CreateRoleCommand({
    //     RoleName: constants.names.imagebuilder_role,
    //     AssumeRolePolicyDocument: 'file://imagebuilder-trust-policy.json',
    //     Tags: globalConstants.getTagsObject(constants.names.imagebuilder_role)
    // })).then(async response => {
    //     const role = response.Role;

    //     await client 
    // });
}

module.exports = Initialize;
