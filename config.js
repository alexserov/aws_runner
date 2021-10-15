module.exports = {
    region: 'eu-central-1',
    constants: {
        global: {
            tagName: 'dx-info',
            tagValue: 'devextreme-ga',
        },
        iam: {
            names: {
                imagebuilder: {
                    role: 'devextreme-ga-imagebuilder-role',
                    profile: 'devextreme-ga-imagebuilder-profile',
                },
                dockerHost: {
                    role: 'devextreme-ga-docker-host-role',
                    profile: 'devextreme-ga-docker-host-profile',
                },
                controller: {
                    role: 'devextreme-ga-controller-role',
                    profile: 'devextreme-ga-controller-profile',
                },
            },
        },
        imagebuilder: {
            names: {
                host: {
                    infrastructureConfiguration: 'devextreme-ga-infrastructure-config-host',
                    component: 'devextreme-ga-host-component-host',
                    imageRecipe: 'devextreme-ga-recipe-host',
                    imagePipeline: 'devextreme-ga-image-pipeline-host',
                    distributionConfiguration: 'devextreme-ga-distribution-config-host',
                },
                listener: {
                    infrastructureConfiguration: 'devextreme-ga-infrastructure-config-listener',
                    component: 'devextreme-ga-host-component-listener',
                    imageRecipe: 'devextreme-ga-recipe-listener',
                    imagePipeline: 'devextreme-ga-image-pipeline-listener',
                    distributionConfiguration: 'devextreme-ga-distribution-config-listener',
                },
            },
        },
        vpc: {
            names: {
                build: {
                    gateway: 'devextreme-ga-gateway-build',
                    subnet: 'devextreme-ga-subnet-build',
                    securityGroup: 'devextreme-ga-security-group-build',
                    vpc: 'devextreme-ga-vpc-build',
                    routeTable: 'devextreme-ga-routeTable-build',
                },
                run: {
                    gateway: 'devextreme-ga-gateway-run',
                    subnet: 'devextreme-ga-subnet-run',
                    securityGroup: 'devextreme-ga-security-group-run',
                    vpc: 'devextreme-ga-vpc-run',
                    routeTable: 'devextreme-ga-routeTable-run',
                    endpoint_s3: 'devextreme-ga-routeTable-run-ep-s3',
                },
            },
        },
        s3: {
            names: {
                bucket: 'devextreme-ga-configs',
            },
        },
        ecr: {
            names: {
                repository: 'aws-runner',
            },
        },
    },
    machines: [
        {
            type: 'm5.large',
            dockerInstancesCount: 4,
        },
        {
            type: 'm4.large',
            dockerInstancesCount: 4,
        },
    ],
};
