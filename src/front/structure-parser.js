const parser = require('xml2json');

function parseDescribeResponse(resp) {
    const { data } = resp;
    const jsonData = JSON.parse(parser.toJson(data));
    const resources = jsonData.resources.resource;

    let result = resources.map(r => {
        return {
            name: r.name,
            gqlName: r.name,
            gqlNamePlural: toPlural(r.name),
            gqlListQueryName: r.name + 'List',
            gqlGetQueryName: r.name,
            gqlAddMutationName: 'add' + r.name,
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
    }
    
    return 'String';
}

module.exports = {
    parseDescribeResponse,
}