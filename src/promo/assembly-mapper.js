const R = require('ramda');

// ----------------------------------------------------------------------------

function parseAssemblyResource(assemblyResource, { attributeResourceList, positionResourceList, ruleResourceList }) {
    const id = assemblyResource.assemblyReference.id;

    const attributes = 
        attributeResourceList
        .filter(attributeResource => attributeResource.attribute.parentAssemblyNamedReference.id === id)
        .map(attributeResource => ({
            id: attributeResource.attributeReference.id,
            ...attributeResource.attribute,
            category: attributeResource.attribute.attributeCategoryNamedReference,
            aggregateList: attributeResource.attribute.aggregateList?.map(x => ({
                attribute: x.attributeNamedReference,
                feature: x.featureNamedReference,
                position: x.positionNamedReference
            }))
        }));

    const positions = 
        positionResourceList
        .filter(positionResource => positionResource.position.parentAssemblyNamedReference.id === id)
        .map(positionResource => ({
            id: positionResource.positionReference.id,
            ...positionResource.position,
            module: positionResource.position.moduleNamedReference,
            assembly: positionResource.position.assemblyNamedReference,
        }));            

    const rules =
        ruleResourceList
        .filter(ruleResource => ruleResource.rule.assemblyNamedReference.id === id)
        .map(ruleResource => ({
            ...R.omit(['combinationRuleColumnList', 'combinationRuleRowList'], ruleResource.rule),
            combination: Boolean(ruleResource.rule.combinationRuleColumnList) ? {
                columns: ruleResource.rule.combinationRuleColumnList.map(c => c.value.replace(' » ', '.')),
                columnIds: ruleResource.rule.combinationRuleColumnList.map(c => c.id),
                rows: ruleResource.rule.combinationRuleRowList.map(r => ({
                    values: R.sortBy(
                        cc => ruleResource.rule.combinationRuleColumnList.findIndex(c => c.id === cc.combinationRuleColumnReference.id), 
                        r.combinationRuleCellList
                    ).map(v => v.value)
                }))
            } : undefined
        }));

    return {
        id, 
        ...assemblyResource.assembly,
        attributes,
        positions,
        rules
    };
}

// ----------------------------------------------------------------------------

function processCombinationColumns(combination, assembly, promoContext) {
    const modules = promoContext.modules || [];
    const modulesByName = R.mapObjIndexed((v, k) => R.head(v), R.groupBy(x => x.name, modules));

    const columns = combination.columns || [];
    const positions = assembly.positions || [];

    return columns.map((columnString, i) => {
        
        if (!columnString) {
            throw 'wrong column name: ' + columnString;
        }

        const isLocalAttribute = columnString.indexOf('.') === -1;
        const isPosition = !isLocalAttribute;

        if (isLocalAttribute) {
            return {
                id: combination.columnIds?.[i],
                attributeNamedReference: { name: columnString }
            };    
        }

        if (isPosition) {
            const positionName = columnString.split('.')[0];
            const featureOrSubAttributeName = columnString.split('.')[1];
            
            // const isQty = featureOrSubAttributeName === 'Qty';
            const isQty = false; // Tacton bug: not supported in API!

            const refModuleName = positions.find(p => p.name === positionName)?.module?.name;
            const refAssemblyName = positions.find(p => p.name === positionName)?.assembly?.name;
            
            const isModulePosition = Boolean(modulesByName[refModuleName]);
            const isAssemblyPosition = !isModulePosition;

            if (isModulePosition) {
                return {
                    id: combination.columnIds?.[i],
                    positionNamedReference: { name: positionName },
                    moduleNamedReference: { name: refModuleName },
                    featureNamedReference: !isQty ? { name: featureOrSubAttributeName } : undefined
                }
            }

            if (isAssemblyPosition) {
                return {
                    id: combination.columnIds?.[i],
                    positionNamedReference: { name: positionName },
                    assemblyNamedReference: { name: refAssemblyName },
                    attributeNamedReference: !isQty ? { name: featureOrSubAttributeName } : undefined
                }
            }

        }

    }).filter(x => x !== undefined);
}

function processCombinationRows(combination, assembly, promoContext) {
    const rows = combination.rows || [];

    return rows.map(row => ({
        combinationRuleCellList: row.values.map((v, i) => ({
            combinationRuleColumnReference: { id: combination.columnIds[i] },
            value: v
        }))
    }));
}

function buildAssemblyRuleResources(assembly, promoContext, opts) {

    const includeCombinationRows = opts?.includeCombinationRows || false;

    const ruleList = (assembly.rules || []).map(rule => ({
        ...R.omit(['assemblyNamedReference', 'combination'], rule),
        assemblyNamedReference: { name: assembly.name },
        combinationRuleColumnList: rule.combination !== undefined ? processCombinationColumns(rule.combination, assembly, promoContext) : [],
        combinationRuleRowList: (rule.combination !== undefined && includeCombinationRows) ? processCombinationRows(rule.combination, assembly, promoContext) : []
    }));

    return ruleList;
}

function buildAssemblyResource(assembly, promoContext, opts) {

    const attributeList = (assembly.attributes || []).map(attribute => ({
        ...R.omit(['parentAssemblyNamedReference', 'attributeCategoryNamedReference', 'domainNamedReference', 'aggregateList'], attribute),
        defaultView: attribute.defaultView !== undefined ? attribute.defaultView : true,
        parentAssemblyNamedReference: { name: assembly.name },
        domainNamedReference: attribute.domain,
        aggregateList: (attribute.aggregateList || []).map(aggregate => ({
            attributeNamedReference: aggregate.attribute,
            featureNamedReference: aggregate.feature,
            positionNamedReference: aggregate.position
        }))
    }));

    const positionList = (assembly.positions || []).map(position => ({
        ...R.omit(['parentAssemblyNamedReference', 'assemblyNamedReference', 'moduleNamedReference'], position),
        defaultView: position.defaultView !== undefined ? position.defaultView : true,
        parentAssemblyNamedReference: { name: assembly.name },
        assemblyNamedReference: position.assembly,
        moduleNamedReference: position.module,
        qtyType: position.qtyType || 'Configurable'
    }));

    const ruleList = buildAssemblyRuleResources(assembly, promoContext, opts);

    const resource = {
        assembly: R.omit(['positions', 'attributes', 'variants', 'rules'], assembly),
        attributeList,
        positionList,
        variantList: [],
        ruleList
    };

    return resource;
}

// ----------------------------------------------------------------------------

function mergeAssembly(existingAssembly, deltaAssembly) {
    console.log('mergeAssembly', 'NOT FULLY IMPLEMENTED YET!');

    const merged = {
        ...existingAssembly,
        ...R.omit(['attributes', 'positions', 'variants', 'rules'], deltaAssembly),
        attributes: existingAssembly.attributes,
        positions: existingAssembly.positions,
        variants: existingAssembly.variants,
        rules: existingAssembly.rules.map((existingRule, i) => {
            const deltaRule = deltaAssembly.rules[i];
            return {
                ...existingRule,
                combination: Boolean(existingRule.combination) ? {
                    ...existingRule.combination,
                    rows: deltaRule.combination?.rows
                } : undefined
            };
        })
    };

    return merged;
}

// ----------------------------------------------------------------------------

module.exports = {
    parseAssemblyResource,
    buildAssemblyResource,
    buildAssemblyRuleResources,
    mergeAssembly
};