// eslint-disable-next-line no-unused-vars
const config = {
    names: {
        build: {
            gateway: '',
            subnet: '',
            securityGroup: '',
            vpc: '',
            routeTable: '',
        },
        run: {
            gateway: '',
            subnet: '',
            securityGroup: '',
            vpc: '',
            routeTable: '',
        },
    },
    // eslint-disable-next-line no-unused-vars
    apply(_externalConfig) { },
};

const apply = (externalConfig) => Object.assign(config, externalConfig);
config.apply = apply;

module.exports = config;