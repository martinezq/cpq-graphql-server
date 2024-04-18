const R = require('ramda');

// ----------------------------------------------------------------------------

function parseDomainResource(domainResource) {
    return {
        id: domainResource.domainReference.id, 
        ...domainResource.domain
    };
}

// ----------------------------------------------------------------------------

function buildDomainResource(domain, promoContext) {
    return domain;
}

// ----------------------------------------------------------------------------

module.exports = {
    parseDomainResource,
    buildDomainResource
};