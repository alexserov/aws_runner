function DefineVpcNames(suffix) {
    return {
        gateway: `devextreme-ga-gateway-${suffix}`,
        subnet: `devextreme-ga-subnet-${suffix}`,
        securityGroup: `devextreme-ga-security-group-${suffix}`,
        vpc: `devextreme-ga-vpc-${suffix}`,
        routeTable: `devextreme-ga-routeTable-${suffix}`
    }
}
function DefineEndpoints(suffixes) {
    const result = {};
    suffixes.forEach(x => {
        result[`endpoint_${x}`] = `devextreme-ga-vpc-endpoint-${x}`
    });
    return result;
}

module.exports = {
    names: {
        build: {
            ...DefineVpcNames('build'),
        },
        run: {
            ...DefineVpcNames('run'),
            endpoint_s3: `devextreme-ga-routeTable-run-ep-s3`
        }
    }
};
