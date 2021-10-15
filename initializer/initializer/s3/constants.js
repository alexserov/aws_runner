const config = {
    names: {
        bucket: '',
    },
    // eslint-disable-next-line no-unused-vars
    apply(_externalConfig) { },
};

const apply = (externalConfig) => Object.assign(config, externalConfig);
config.apply = apply;

module.exports = config;
