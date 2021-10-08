function DefineImageNames(suffix) {
    return {
        infrastructureConfiguration: `devextreme-ga-infrastructure-config-${suffix}`,
        component: `devextreme-ga-host-component-${suffix}`,
        imageRecipe: `devextreme-ga-recipe-${suffix}`,
        imagePipeline: `devextreme-ga-image-pipeline-${suffix}`
    }
}
module.exports = {
    names: {
        host: DefineImageNames('host'),
        listener: DefineImageNames('listener')
    }
};
