const R = require('ramda');

// ----------------------------------------------------------------------------

function parseModuleResource(moduleResource, { featureResourceList, variantResourceList }) {
    const id = moduleResource.moduleReference.id;

    const features = 
        featureResourceList
        .filter(featureResource => featureResource.feature.parentModuleNamedReference.id === id)
        .map(parseFeatureResource);

    const variants = 
        variantResourceList
        .filter(variantResource => variantResource.variant.parentModuleNamedReference.id === id)
        .map(variantResource => {
            const variantValues = 
                variantResource.variant.variantValueList
                .map(variantValue => ({
                    ... variantValue,
                    feature: variantValue.featureNamedReference
                }));
            
             return {
                id: variantResource.variantReference.id,
                ...variantResource.variant,
                values: variantValues
            }
        });      
       
    
    return {
        id: moduleResource.moduleReference.id, 
        ...moduleResource.module,
        features,
        variants
    };
}

// ----------------------------------------------------------------------------

function parseFeatureResource(featureResource) {
    return {
        id: featureResource.featureReference.id,
        ...featureResource.feature
    };
}

// ----------------------------------------------------------------------------

function buildModuleResource(module, promoContext) {
    const resource = {
        module: R.omit(['features', 'variants'], module),
        featureList: (module.features || []).map(f => ({
            ...f,
            parentModuleNamedReference: { name: module.name },
            domainNamedReference: f.domain || { name: 'String' }
        })),
        variantList: (module.variants || []).map(v => ({
            ...v,
            status: v.status || 'Active',
            parentModuleNamedReference: { name: module.name },
            variantValueList: (v.values || []).map(vv => ({
                featureNamedReference: { name: vv.feature.name },
                value: vv.value
            }))
        }))
    };

    return resource;
}

// ----------------------------------------------------------------------------

function buildGlobalFeatureResource(feature, promoContext) {
    return {
        feature: {
            ...feature,
            domainNamedReference: feature.domain || { name: 'String' }
        }
    };
}

// ----------------------------------------------------------------------------

module.exports = {
    parseModuleResource,
    parseFeatureResource,
    buildModuleResource,
    buildGlobalFeatureResource
};