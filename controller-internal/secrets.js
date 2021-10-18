const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const axios = require('axios');

class Secrets {
    constructor(repository, secretArn) {
        this.repository = repository;
        this.secretArn = secretArn;
        this.token = {
            value: '',
            expires: new Date(),
        };
    }

    async getGithubToken() {
        const client = new SecretsManagerClient({});
        const secretString = await client.send(new GetSecretValueCommand({
            SecretId: this.secretArn,
        })).then((x) => x.SecretString);
        const secretValue = JSON.parse(secretString);
        return secretValue.github;
    }

    async getTokenImpl(endpointPart, currentToken) {
        const now = new Date();
        now.setMinutes(now.getMinutes() + 1);
        if (now > currentToken.expires) {
            const requestUrl = this.repository.isOrganization
                ? `https://api.github.com/orgs/${this.repository.name}/actions/runners/${endpointPart}`
                : `https://api.github.com/repos/${this.repository.name}/actions/runners/${endpointPart}`;

            const response = await axios({
                url: requestUrl,
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${await this.getGithubToken()}`,
                },
            });
            if (response.status >= 200 && response.status < 300) {
                return {
                    value: response.data.token,
                    expires: response.data.expires_at,
                };
            }
        }
        return currentToken.value;
    }

    async getRegistrationToken() {
        const newToken = await this.getTokenImpl('registration-token', this.token);
        this.token.value = newToken.value;
        this.token.expires = newToken.expires;
        return this.token.value;
    }

    async getRemoveToken() {
        const result = { expires: new Date() };
        await this.getTokenImpl('remove-token', result);
        return result.value;
    }
}

module.exports = Secrets;
