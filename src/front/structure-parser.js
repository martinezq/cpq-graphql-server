const parser = require('xml2json');

function parseDescribeResponse(resp) {
    const { data } = resp;
    const jsonData = JSON.parse(parser.toJson(data));
    const resources = jsonData.resources.resource;

    const bomAttribute = {
        gqlName: 'bom',
        gqlType: 'String',
        gqlTypeInput: 'String'
    };

    let result = resources.map(r => {
        return {
            name: r.name,
            gqlName: r.name,
            gqlNamePlural: toPlural(r.name),
            gqlListQueryName: 'list' + toPlural(r.name),
            gqlGetQueryName: 'get' + r.name,
            gqlAddMutationName: 'add' + r.name,
            gqlAddIfDoesntExistMutationName: 'add' + r.name + "IfDoesntExist",
            gqlCopyMutationName: 'copy' + r.name,
            gqlUpdateMutationName: 'update' + r.name,
            gqlUpdateManyMutationName: 'updateMany' + toPlural(r.name),
            gqlDeleteManyMutationName: 'deleteMany' + toPlural(r.name),
            apiType: r.name.toLowerCase(),
            attributes: r.attributes.attribute.map(a => {
                return {
                    name: a.name,
                    referencedType: a.referencedType,
                    gqlName: toGraphQLName(a),
                    type: a.type,
                    gqlType: toGraphQLType(a),
                    gqlTypeInput: toGraphQLTypeInput(a)
                }
            })
            //.concat(r.name === 'ConfiguredProduct' ? [bomAttribute] : undefined)
            // .filter(x => x !== undefined)
        }
    });

    result.forEach(r => {
        r.attributes.forEach(a => {
            if (a.referencedType) {
                a.resource = result.find(x => x.name === a.referencedType);
            }
        });
    });

    return result;
}

function toGraphQLName(attribute) {
    return attribute.name.replace(/-/, '');
}

function toPlural(val) {
    const lastIndex = val.length - 1;
    if (val[lastIndex] === 'y') {
        return val.slice(0, lastIndex) + 'ies'
    } else {
        return val + 's';
    }
}

function toGraphQLType(attribute) {
    switch(attribute.type) {
        case 'Reference':
            return attribute.referencedType;
        case 'StrongReference':
            return 'ID';
        case 'Boolean':
            return 'Boolean';
        case 'Integer':
            return 'Int';
        case 'XML':
            if (attribute.name === 'profiles') return '[UserProfile]'
            return 'String';
    }
    
    return 'String';
}

function toGraphQLTypeInput(attribute) {
    switch(attribute.type) {
        case 'Reference':
            return attribute.referencedType + 'Ref';
        case 'StrongReference':
            return 'ID';
        case 'Boolean':
            return 'Boolean';
        case 'Integer':
            return 'Int';
        case 'XML':
            if (attribute.name === 'profiles') return '[UserProfileInput]'
            if (attribute.name === 'bom') return 'BOMInput'
            return;
    }
    
    return 'String';
}

module.exports = {
    parseDescribeResponse,
}