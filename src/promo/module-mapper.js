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
        ...featureResource.feature,
        domain: featureResource.feature.domainNamedReference
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

function mergeModule(existingModule, deltaModule) {
    const features = mergeModuleFeatures(existingModule, deltaModule);
    const variants = mergeModuleVariants(existingModule, deltaModule);

    return {
        ...existingModule,
        ...deltaModule,
        features,
        variants
    };
}

// ----------------------------------------------------------------------------

function mergeModuleFeatures(existingModule, deltaModule) {
    let features = R.clone(existingModule.features);

    deltaModule.features.forEach(deltaFeature => {
        const existingFeatureIndex = features.findIndex(f => f.name === deltaFeature.name);
    
        if (existingFeatureIndex > -1) {
            const existingFeature = features[existingFeatureIndex];
            const mergedFeature = {
                ...existingFeature,
                ...deltaFeature
            };
            features[existingFeatureIndex] = mergedFeature;
        } else {
            features.push(deltaFeature);
        }
    });

    return features;
}

// ----------------------------------------------------------------------------

function mergeModuleVariants(existingModule, deltaModule) {
    
    function mergeVariant(existingVariant, deltaVariant) {
        let values = existingVariant.values;

        deltaVariant.values.forEach(deltaValue => {
            const existingValueIndex = values.findIndex(vv => vv.feature.name === deltaValue.feature?.name)

            if (existingValueIndex > -1) {
                const existingValue = values[existingValueIndex];
                const mergedValue = {
                    ...existingValue,
                    ...deltaValue
                }
                values[existingValueIndex] = mergedValue;
            } else {
                values.push(deltaValue);
            }
        });

        return {
            ...existingVariant,
            ...deltaVariant,
            values
        };
    }
    
    let variants = R.clone(existingModule.variants);

    deltaModule.variants.forEach(deltaVariant => {
        const existingVariantIndex = variants.findIndex(v => v.name === deltaVariant.name);
    
        if (existingVariantIndex > -1) {
            const existingVariant = variants[existingVariantIndex];
            const mergedVariant = mergeVariant(existingVariant, deltaVariant);
            variants[existingVariantIndex] = mergedVariant;
        } else {
            variants.push(deltaVariant);
        }
    });

    return variants;
}
// ----------------------------------------------------------------------------

module.exports = {
    parseModuleResource,
    parseFeatureResource,
    buildModuleResource,
    buildGlobalFeatureResource,
    mergeModule
};