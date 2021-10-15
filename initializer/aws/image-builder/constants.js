const config = {
    names: {
        host: {
            infrastructureConfiguration: '',
            component: '',
            imageRecipe: '',
            imagePipeline: '',
            distributionConfiguration: '',
        },
        listener: {
            infrastructureConfiguration: '',
            component: '',
            imageRecipe: '',
            imagePipeline: '',
            distributionConfiguration: '',
        },
    },
    // eslint-disable-next-line no-unused-vars
    apply(_externalConfig) { },
};

const apply = (externalConfig) => Object.assign(config, externalConfig);
config.apply = apply;

module.exports = config;
