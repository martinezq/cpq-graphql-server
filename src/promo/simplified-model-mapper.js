const R = require('ramda');

const prefix = '';

function convertSimplifiedModel(model) {

    const completedModel = completeModel(model);

    const domains = completedModel.domains.map(domain => ({
        name: domainName(domain.name),
        description: domain.name,
        type: domain.type,
        enumElementList: domain.values?.map(v => ({
            name: domainElementName(v),
            description: v
        })),
        booleanYes: domain.type === 'Boolean' ? { name: 'Yes' } : undefined,
        booleanNo: domain.type === 'Boolean' ? { name: 'No' } : undefined,
        integerRange: domain.type === "Integer" ? { min: 0, max: 1000000 } : undefined,
        floatRange: domain.type === "Float" ? { min: 0, max: 1000000 } : undefined,
        valueType: undefined
    }));

    const modules = completedModel.modules.map(module => ({
        name: moduleName(module.name),
        description: module.name,
        features: module.features.map(feature => ({
            name: featureName(feature.name),
            description: feature.name,
            domain: { name: domainName(feature.domain.name) }
        })),
        variants: module.variants.map(variant => ({
            name: variantName(variant.name),
            description: variant.name,
            values: (variant?.values?.map(value => ({
                feature: { name: featureName(value.feature) },
                value: value.values?.map(domainElementName)?.join('; ') || 'unspecified'
            })) || []).concat(variant.isNonStandard ? [{
                feature: { name: 'isNonStandard'},
                value: 'Yes'
            }] : [])
        }))
    }));

    const assemblies = completedModel.assemblies.map(assembly => ({
        name: assemblyName(assembly.name),
        description: assembly.name,
        positions: assembly.positions.map(position => ({
            name: positionName(position.name),
            description: position.name,
            type: position.type,
            module: position.type === 'Module' || position.type === 'Options' ? { name: moduleName(position.moduleName ) } : undefined,
            assembly: position.type === 'Assembly' ? { name: assemblyName(position.assemblyName ) }: undefined
        })),
        attributes: assembly.attributes.map(attribute => ({
            name: attributeName(attribute.name),
            description: attribute.name,
            domain: { name: domainName(attribute.name) },
            io: true,
            aggregationStrategy: attribute.aggregation,
            aggregateList: attribute.aggregateList.map(item => ({
                position: { name: positionName(item.position) },
                feature: item.feature ? { name: featureName(item.feature) } : undefined,
                attribute: item.attribute ? { name: attributeName(item.attribute) } : undefined
            }))
        }))
    }))

    const globalFeatures = completedModel.globalFeatures.map(feature => ({
        name: featureName(feature.name),
        description: feature.name,
        domain: { name: domainName(feature.name) },
        initialValue: 'unspecified'
    }));

    return {
        globalFeatures,
        assemblies,
        modules,
        domains
    }

}

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

function completeModel(model) {
    const needs = scanForNeeds(model);

    const domains = completeDomains(needs.domains);
    const modules = completeModules(needs.modules);
    const assemblies = completeAssemblies(needs.assemblies);

    return {
        domains,
        modules,
        assemblies,
        globalFeatures: R.values(needs.globalFeatures)
    };
}

// ----------------------------------------------------------------------------

function scanForNeeds(model) {
    let domains = {};
    let modules = {};
    let assemblies = {};
    let globalFeatures = {};

    for (const module of model.modules || []) {
        modules[module.name] = module;
    }

    for (const assembly of model.assemblies || []) {
        explodeAssemblyRecursively(assembly, assemblies);
    }

    for (const assembly of R.values(assemblies)) {

        for (const position of R.values(assemblies[assembly.name].positions)) {
            const isLocal = Boolean(position.variants) || Boolean(position.positions);
            const generatedModuleName = isLocal ? `${assembly.name} / ${position.name}` : position.name;

            const existingAssembly = R.values(assemblies).find(a => a.name === position.assemblyName);

            if (!existingAssembly) {
                position.type = position.options ? 'Options' : 'Module';
                position.moduleName = generatedModuleName;
                modules[generatedModuleName] = modules[generatedModuleName] || { name: generatedModuleName };

                for (const variant of position.variants || []) {
                    modules[generatedModuleName].variants = modules[generatedModuleName].variants || [];
                    modules[generatedModuleName].variants.push(variant)
                }


            } else {
                position.type = 'Assembly';
            }
        }
    }

    for (const module of R.values(modules)) {

        for (const variant of module.variants || []) {
            for (const value of variant.values || []) {
                domains[value.feature] = domains[value.feature] || { name: value.feature };
                domains[value.feature].values = R.uniq((domains[value.feature].values || []).concat(value.values || []))

                module.features = module.features || {};
                module.features[value.feature] = {
                    name: value.feature,
                    domain: domains[value.feature]
                };
            }
        }
    }    

    // for (const assembly of R.values(assemblies)) {
    //     for (const position of R.values(assembly.positions)) {
    //         const existingAssembly = assemblies[position.assemblyName];

    //         if (!existingAssembly) {
    //             const existingModule = modules[position.moduleName];

    //             for (const feature of R.values(existingModule.features)) {
    //                 const type = domainTypeFromValues(domains[feature.name].values);
    //                 const aggregation = ['Integer', 'Float'].find(x => x === type) ? 'Sum' : 'Equal';
                    
    //                 assembly.attributes[feature.name] = assembly.attributes[feature.name] || { name: feature.name, aggregation, aggregateList: [] };
    //                 assembly.attributes[feature.name].aggregateList.push({
    //                     position: position.name,
    //                     feature: feature.name
    //                 });
    //             }
    //         }
    //     }
    // }

    // for (const assembly of R.values(assemblies)) {
    //     for (const position of R.values(assembly.positions)) {
    //         const existingAssembly = assemblies[position.name];

    //         if (existingAssembly) {
    //             for (const attribute of R.values(existingAssembly.attributes)) {
    //                 assembly.attributes[attribute.name] = assembly.attributes[attribute.name] || { name: attribute.name, aggregation: 'Equal', aggregateList: [] };
    //                 assembly.attributes[attribute.name].aggregateList.push({
    //                     position: position.name,
    //                     attribute: attribute.name
    //                 });
    //             }
    //         }
    //     }
    // }

    for (const module of R.values(modules)) {
        for (const feature of R.values(module.features)) {
            const isGlobal = Boolean((model.globalFeatures || []).find(f => f === feature.name));

            if (isGlobal) {
                module.features[feature.name] = undefined;
                globalFeatures[feature.name] = feature;
            }
        }
    }

    return {
        assemblies,
        modules,
        domains,
        globalFeatures
    }
}

// ----------------------------------------------------------------------------

function explodeAssemblyRecursively(assembly, buffer = {}) {
    buffer[assembly.name] = buffer[assembly.name] || { name: assembly.name, positions: {}, attributes: {} };

    for (const positionName of assembly.positionNames || []) {
        buffer[assembly.name].positions[positionName] = { name: positionName, assemblyName: positionName };
    }

    for (const position of assembly.positions || []) {
        buffer[assembly.name].positions[position.name] = { ...position, assemblyName: position.name };
    }
    
    const subAssemblies = R.values(assembly.positions).filter(p => Boolean(p.positions));

    for (const subAssembly of subAssemblies) {
        const generatedAssemblyName = `${assembly.name} / ${subAssembly.name}`;
        buffer[assembly.name].positions[subAssembly.name].assemblyName = generatedAssemblyName;
        explodeAssemblyRecursively({ ...subAssembly, name: generatedAssemblyName }, buffer);    
    }
}

// ----------------------------------------------------------------------------

function completeDomains(domains) {

    return R.values(domains).map(domain => {
        
        const type = domainTypeFromValues(domain.values);
        const values = R.uniq(domain.values).sort();

        return {
            name: domain.name,
            type,
            values
        }
    });
}

function domainTypeFromValues(values) {
    if (!values || values.length === 0) return 'String';

    const isInteger = x => {
        return Number.isInteger(Number(x)) || R.all(Number.isInteger, x.split('..').map(Number));
    }

    const isFloat = x => {
        return !Number.isNaN(Number(x)) || R.all(x => !Number.isNaN(x), x.split('..').map(Number));
    }

    if (R.all(isInteger, values)) return 'Integer';
    if (R.all(isFloat, values)) return 'Float';

    if (R.all(x => x === 'Yes' || x === 'No', values)) return 'Boolean';

    if (values.length > 0) return 'Enum';

    return 'String';
}

// ----------------------------------------------------------------------------

function completeModules(modules) {
    return R.values(modules).map(module => ({
        ...module,
        features: R.values(module.features).filter(f => f !== undefined),
        variants: R.values(module.variants)
    }));
}

// ----------------------------------------------------------------------------

function completeAssemblies(assemblies) {
    return R.values(assemblies).map(assembly => ({
        ...assembly,
        positions: R.values(assembly.positions),
        attributes: R.values(assembly.attributes)
    }))
}

// ----------------------------------------------------------------------------

function standardizeName(name) {
    return (name || '-')
        .replace(/\+/g, 'plus')
        .replace(/\</g, 'lt')
        .replace(/\>/g, 'gt')
        .replace(/[^a-zA-Z0-9\.]+/g, '_')
        .replace(/\_+$/g, '')
        .replace(/^\_+/g, '')
        .replace(/^$/g, '_missing')
        .toLowerCase();
}

function domainName(name) {
    return prefix + standardizeName(name) + '_domain';
}

function domainElementName(name) {
    if (name === 'Yes' || name === 'No') {
        return name;
    }
    return standardizeName(name);
}    

function moduleName(name) {
    return prefix + standardizeName(name) + '_module';
}

function variantName(name) {
    return standardizeName(name) + '_variant';
}

function featureName(name) {
    return standardizeName(name) + '_feature';
}

function assemblyName(name) {
    return prefix + standardizeName(name) + '_assembly';
}

function positionName(name) {
    return standardizeName(name) + '_position';
}

function attributeName(name) {
    return standardizeName(name) + '_attribute';
}


// ----------------------------------------------------------------------------

module.exports = {
    convertSimplifiedModel
}