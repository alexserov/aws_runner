const config = {
    secretsId: '',
    names: {
        imagebuilder: {
            role: '',
            profile: '',
        },
        dockerHost: {
            role: '',
            profile: '',
        },
        controller: {
            role: '',
            profile: '',
        },
    },
    // eslint-disable-next-line no-unused-vars
    apply(_externalConfig) { },
};

const apply = (externalConfig) => Object.assign(config, externalConfig);
config.apply = apply;

module.exports = config;
