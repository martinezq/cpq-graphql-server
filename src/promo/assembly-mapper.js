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
                columns: ruleResource.rule.combinationRuleColumnList.map(c => c.value?.replace(' » ', '.')),
                columnIds: ruleResource.rule.combinationRuleColumnList.map(c => c.id),
                rows: ruleResource.rule.combinationRuleRowList.map(r => ({
                    id: r.id,
                    values: R.sortBy(
                        cc => ruleResource.rule.combinationRuleColumnList.findIndex(c => c.id === cc.combinationRuleColumnReference.id), 
                        r.combinationRuleCellList
                    ).map(v => v.value)
                }))
            } : undefined
        }));

    const virtualVariantRes = assemblyResource.assembly.virtualVariant;

    const virtualVariant = virtualVariantRes ? {
        ...virtualVariantRes,
        values: virtualVariantRes.variantValueList?.map(v => ({
            attribute: v.attributeNamedReference ? { name: v.attributeNamedReference?.name } : undefined,
            feature: v.featureNamedReference ? { name: v.featureNamedReference?.name } : undefined,
            value: v.value
        }))
    } : undefined;

    return {
        id, 
        ...assemblyResource.assembly,
        attributes,
        positions,
        rules,
        virtualVariant
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
            
            const isQty = featureOrSubAttributeName === 'Qty';
            // const isQty = false; // Tacton bug: not supported in API!

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

function processCombinationRows(combination, assembly, promoContext, { includeNewCombinationRows }) {
    const rows = combination.rows || [];

    return rows
        .filter(row => includeNewCombinationRows || row.id)
        .map(row => ({
            id: row.id,
            combinationRuleCellList: row.values.map((v, i) => ({
                combinationRuleColumnReference: { id: combination.columnIds[i] },
                value: v
            }))
        }));
}

function buildAssemblyRuleResources(assembly, promoContext, opts) {

    const includeNewCombinationRows = opts?.includeNewCombinationRows || false;

    const ruleList = (assembly.rules || []).map(rule => ({
        ...R.omit(['assemblyNamedReference', 'combination'], rule),
        assemblyNamedReference: { name: assembly.name },
        combinationRuleColumnList: rule.combination !== undefined ? processCombinationColumns(rule.combination, assembly, promoContext) : [],
        combinationRuleRowList: rule.combination !== undefined  ? processCombinationRows(rule.combination, assembly, promoContext, { includeNewCombinationRows }) : []
    }));

    return ruleList;
}

function buildAssemblyResource(assembly, promoContext, opts) {

    const attributeList = (assembly.attributes || []).map(attribute => ({
        ...R.omit(['parentAssemblyNamedReference', 'attributeCategoryNamedReference', 'domainNamedReference', 'aggregateList', 'category'], attribute),
        defaultView: attribute.defaultView !== undefined ? attribute.defaultView : true,
        parentAssemblyNamedReference: { name: assembly.name },
        domainNamedReference: attribute.domain,
        aggregateList: (attribute.aggregateList || []).map(aggregate => ({
            attributeNamedReference: aggregate.attribute,
            featureNamedReference: aggregate.feature,
            positionNamedReference: aggregate.position
        })),
        attributeCategoryNamedReference: attribute.category
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

    const virtualVariant = assembly.virtualVariant ? {
        ...R.omit(['values'], assembly.virtualVariant),
        variantValueList: assembly.virtualVariant.values?.map(vv => ({
            value: vv.value,
            attributeNamedReference: vv.attribute ? { name: vv.attribute.name } : undefined,
            featureNamedReference: vv.feature ? { name: vv.feature.name } : undefined
        }))
    } : undefined

    const assembly2 = {
        ...R.omit(['positions', 'attributes', 'variants', 'rules', 'virtualVariant'], assembly),
        virtualVariant
    };

    const resource = {
        assembly: assembly2,
        attributeList,
        positionList,
        variantList: [],
        ruleList
    };

    return resource;
}

// ----------------------------------------------------------------------------

function mergeAssembly(existingAssembly, deltaAssembly) {
    console.log('mergeAssembly', 'EXPERIMENTAL, NEEDS SOME MORE TESTING!');

    const merged = {
        ...existingAssembly,
        ...R.omit(['attributes', 'positions', 'variants', 'rules'], deltaAssembly),
        attributes: mergeAttributes(existingAssembly.attributes, deltaAssembly.attributes),
        positions: mergePositions(existingAssembly.positions, deltaAssembly.positions),
        variants: existingAssembly.variants,
        rules: mergeRules(existingAssembly.rules, deltaAssembly.rules)
    };

    return merged;
}

function mergeAttributes(existingAttributes, deltaAttributes) {
    const existingAttributesByName = R.groupBy(x => x.name, existingAttributes);
    const deltaAttributesByName = R.groupBy(x => x.name, deltaAttributes);

    const updatedAttributes = existingAttributes.map(existingAttribute => {
        const deltaAttribute = deltaAttributesByName[existingAttribute.name]?.[0];

        if (!deltaAttribute) {
            return undefined;
        } else {
            return {
                ...existingAttribute,
                ...deltaAttribute
            }
        }
    }).filter(x => x !== undefined);;

    const newAttributes = deltaAttributes.filter(da => !existingAttributesByName[da.name]);

    return updatedAttributes.concat(newAttributes);
}

function mergePositions(existingPositions, deltaPositions) {
    const existingPositionsByName = R.groupBy(x => x.name, existingPositions);
    const deltaPositionsByName = R.groupBy(x => x.name, deltaPositions);

    const updatedPositions = existingPositions.map(existingPosition => {
        const deltaPosition = deltaPositionsByName[existingPosition.name]?.[0];

        if (!deltaPosition) {
            return undefined;
        } else {
            return {
                ...existingPosition,
                ...deltaPosition
            };
        }
    }).filter(x => x !== undefined);

    const newPositions = deltaPositions.filter(dp => !existingPositionsByName[dp.name]);

    return updatedPositions.concat(newPositions);
}

function mergeRules(existingRules, deltaRules) {
    const existingRulesBySig = R.groupBy(r => ruleSignature(r), existingRules);
    const deltaRulesBySig = R.groupBy(r => ruleSignature(r), deltaRules);

    const updatedRules = existingRules.map(existingRule => {
        const existingRuleSig = ruleSignature(existingRule)
        const deltaRule = deltaRulesBySig[existingRuleSig]?.[0];
        
        if (!deltaRule) {
            return undefined; // make sure to remove rules that are outdated, can be parametrized in the future
        }

        if (existingRule.type === 'Combination') {
            return {
                ...existingRule,
                combination: {
                    ...existingRule.combination,
                    rows: mergeCombinationRows(existingRule.combination.rows, deltaRule.combination.rows)
                }
            };
        } else {
            return {
                ...existingRule,
                ...deltaRule
            }
        }
    }).filter(x => x !== undefined);

    const addedRules = deltaRules.filter(r => !existingRulesBySig[ruleSignature(r)]);
    const allRules = updatedRules.concat(addedRules);

    return allRules;
}

function mergeCombinationRows(existingRows, deltaRows) {
    const existingRowsBySig = R.groupBy(rowSignature, existingRows);
    const deltaRowsBySig = R.groupBy(rowSignature, deltaRows);

    const rows = 
        existingRows.filter(existingRow => deltaRowsBySig[rowSignature(existingRow)])
        .concat(deltaRows.filter(deltaRow => !existingRowsBySig[rowSignature(deltaRow)]));

    return rows;
}

function ruleSignature(rule) {
    if (rule.type === 'Constraint') {
        return rule.constraint;
    } else if (rule.type === 'Combination') {
        return JSON.stringify(rule.combination.columns)
    } else {
        throw `Can't generate signature for unknown rule type: ${rule.type}`
    }
}

function rowSignature(row) {
    return JSON.stringify(row.values);
}

function mergeRules2(existingRules, deltaRules) {
    return existingRules.map((existingRule, i) => {
        const deltaRule = deltaAssembly.rules[i];
        return {
            ...existingRule,
            combination: Boolean(existingRule.combination) ? {
                ...existingRule.combination,
                rows: deltaRule?.combination?.rows
            } : undefined
        };
    });
}

// ----------------------------------------------------------------------------

module.exports = {
    parseAssemblyResource,
    buildAssemblyResource,
    buildAssemblyRuleResources,
    mergeAssembly
};