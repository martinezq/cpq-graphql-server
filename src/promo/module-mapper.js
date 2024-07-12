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
                    feature: {
                        ...variantValue.featureNamedReference,
                        domain: featureResourceList.find(f => f.featureReference.id === variantValue.featureNamedReference.id)?.feature?.domainNamedReference // TODO very slow (full scan), fix me
                    }
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
            ...R.omit(['domain'], f),
            parentModuleNamedReference: module,
            domainNamedReference: f.domain || { name: 'String' }
        })),
        variantList: (module.variants || []).map(v => ({
            ...R.omit(['values'], v),
            status: v.status || 'Active',
            parentModuleNamedReference: module,
            variantValueList: (v.values || []).map(vv => ({
                featureNamedReference: vv.feature,
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

function mergeModule(existingModule, deltaModule, deltaUpdate = false) {
    const features = mergeModuleFeatures(existingModule, deltaModule, deltaUpdate);
    const variants = mergeModuleVariants(existingModule, deltaModule, deltaUpdate);

    return {
        ...existingModule,
        ...deltaModule,
        features,
        variants
    };
}

// ----------------------------------------------------------------------------

const mapByName = (list) => R.mapObjIndexed((v, k) => v[0], R.groupBy(R.prop('name'), list));

// ----------------------------------------------------------------------------

function mergeModuleFeatures(existingModule, deltaModule, deltaUpdate = false) {
    let existingFeaturesByName = existingModule ? mapByName(existingModule.features) : {};
    
    let features = {
        ...(deltaUpdate ? existingFeaturesByName : {})
    };

    deltaModule.features?.forEach(deltaFeature => {
        const existingFeature = existingFeaturesByName[deltaFeature.name];
        
        if (existingFeature) {
            features[deltaFeature.name] = { ...existingFeature, ...deltaFeature };
        } else {
            features[deltaFeature.name] = deltaFeature;
        }
    });

    return R.values(features);
}

// ----------------------------------------------------------------------------

function mergeModuleVariants(existingModule, deltaModule, deltaUpdate = false) {
    
    const mapByFeatureName = (list) => R.mapObjIndexed((v, k) => v[0], R.groupBy(x => x.feature.name, list));

    function mergeVariant(existingVariant, deltaVariant, deltaUpdate = false) {
        let existingValuesByFeatureName = mapByFeatureName(existingVariant.values);
        
        let values = {
            ...(deltaUpdate ? existingValuesByFeatureName : {})
        };

        deltaVariant.values?.forEach(deltaValue => {
            const existingValue = existingValuesByFeatureName[deltaValue.feature.name];

            if (existingValue) {
                values[deltaValue.feature.name] = { 
                    ...existingValue, 
                    ...deltaValue,
                    // feature: {
                    //     ...existingValue.feature,
                    //     ...deltaValue.feature
                    // }
                };
            } else {
                values[deltaValue.feature.name] = deltaValue;
            }
        });

        return {
            ...existingVariant,
            ...deltaVariant,
            values: R.values(values)
        };
    }
    
    let existingVariantsByName = existingModule ? mapByName(existingModule.variants) : {};
    
    let variants = {
        ...(deltaUpdate ? existingVariantsByName : {})
    };

    deltaModule.variants?.forEach(deltaVariant => {
        const existingVariant = existingVariantsByName[deltaVariant.name];
    
        if (existingVariant) {
            variants[deltaVariant.name] = mergeVariant(existingVariant, deltaVariant, deltaUpdate);
        } else {
            variants[deltaVariant.name] = deltaVariant;
        }
    });

    return R.values(variants);
}
// ----------------------------------------------------------------------------

module.exports = {
    parseModuleResource,
    parseFeatureResource,
    buildModuleResource,
    buildGlobalFeatureResource,
    mergeModule
};