function DefineVpcNames(suffix) {
    return {
        gateway: `devextreme-ga-gateway-${suffix}`,
        subnet: `devextreme-ga-subnet-${suffix}`,
        securityGroup: `devextreme-ga-security-group-${suffix}`,
        vpc: `devextreme-ga-vpc-${suffix}`,
        routeTable: `devextreme-ga-routeTable-${suffix}`
    }
}
module.exports = {
    names: {
        build: {
            ...DefineVpcNames('build'),
            endpoint: 'devextreme-ga-vpc-endpoint-build'
        },
        run: DefineVpcNames('run')
    }
};
