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
            endpoint_s3: '',
            elastic_ip: '',
        },
    },
    ports: {
        controllerPublic: 1337,
        controllerPrivate: 31337,
    },
    // eslint-disable-next-line no-unused-vars
    apply(_externalConfig) { },
};

const apply = (externalConfig) => Object.assign(config, externalConfig);
config.apply = apply;

module.exports = config;
