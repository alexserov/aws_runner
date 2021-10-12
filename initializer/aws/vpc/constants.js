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

const endpointSuffixes = [
    'imagebuilder',
    'ssm',
    'ec2messages',
    'ssmmessages',
    'logs',
    'events',
];
module.exports = {
    endpointSuffixes,
    names: {
        build: {
            ...DefineVpcNames('build'),
            ...DefineEndpoints(endpointSuffixes)
        },
        run: DefineVpcNames('run')
    }
};
