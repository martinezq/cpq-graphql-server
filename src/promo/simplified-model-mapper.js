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
            values: variant?.values?.map(value => ({
                feature: { name: featureName(value.feature) },
                value: value.values?.map(domainElementName)?.join('; ') || 'unspecified'
            }))
        }))
    }));

    const assemblies = completedModel.assemblies.map(assembly => ({
        name: assemblyName(assembly.name),
        description: assembly.name,
        positions: assembly.positions.map(position => ({
            name: positionName(position.name),
            description: position.name,
            type: position.type,
            module: position.type === 'Module' ? { name: moduleName(position.name ) } : undefined,
            assembly: position.type === 'Assembly' ? { name: assemblyName(position.name ) }: undefined
        })),
        attributes: assembly.attributes.map(attribute => ({
            name: attributeName(attribute.name),
            description: attribute.name,
            domain: { name: domainName(attribute.name) }
        }))
    }))

    return {
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
        assemblies
    };
}

// ----------------------------------------------------------------------------

function scanForNeeds(model) {
    let domains = {};
    let modules = {};
    let assemblies = {};

    for (const module of model.modules) {
        modules[module.name] = module;

        for (const variant of module.variants) {
            for (const value of variant.values) {
                domains[value.feature] = domains[value.feature] || { name: value.feature };
                domains[value.feature].values = R.uniq((domains[value.feature].values || []).concat(value.values || []))

                modules[module.name].features = modules[module.name].features || {};
                modules[module.name].features[value.feature] = {
                    name: value.feature,
                    domain: domains[value.feature]
                };
            }
        }
    }

    for (const assembly of model.assemblies) {

        assemblies[assembly.name] = assemblies[assembly.name] || { name: assembly.name, positions: {}, attributes: {} };

        for (const position of assembly.positions) {
            assemblies[assembly.name].positions[position.name] = position;

            const existingAssembly = model.assemblies.find(a => a.name === position.name);

            if (!existingAssembly) {
                modules[position.name] = modules[position.name] || { name: position.name };
                assemblies[assembly.name].positions[position.name].type = 'Module';

                const existingModule = modules[position.name];

                for (const feature of R.values(existingModule.features)) {
                    assemblies[assembly.name].attributes[feature.name] = { name: feature.name };
                }

            } else {
                assemblies[assembly.name].positions[position.name].type = 'Assembly';
            }
        }
    }

    return {
        assemblies,
        modules,
        domains,
    }
}

// ----------------------------------------------------------------------------

function completeDomains(domains) {
    
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

// ----------------------------------------------------------------------------

function completeModules(modules) {
    return R.values(modules).map(module => ({
        ...module,
        features: R.values(module.features),
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