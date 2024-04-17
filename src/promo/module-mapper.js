const R = require('ramda');

// ----------------------------------------------------------------------------

function parseModuleResource(moduleResource, { featureResourceList, variantResourceList }) {
    const id = moduleResource.moduleReference.id;

    const features = 
        featureResourceList
        .filter(featureResource => featureResource.feature.parentModuleNamedReference.id === id)
        .map(featureResource => ({
            id: featureResource.featureReference.id,
            ...featureResource.feature
        }));

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

module.exports = {
    parseModuleResource,
    buildModuleResource
};