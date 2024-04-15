const fs = require('fs');
const public = require('../common/public-schema');

async function generateSchema() {

    const schema = `
        ${public.schema}

        type Ref {
            id: ID
            name: String
        }

        type LocalizedString {
            en: String
            de: String
        }

        type EnumElement {
            name: String
            description: String
            descriptionTranslations: LocalizedString
            longDescription: String
            longDescriptionTranslations: LocalizedString
        }

        enum DomainType {
            Boolean
            Enum
            Integer
            String
            Float
        }

        type DomainTypeRange {
            min: Float
            max: Float
        }

        type DomainBooleanValue {
            name: String
            nameTranslations: LocalizedString
        }

        type Domain {
            id: ID
            name: String
            description: String
            type: DomainType
            booleanYes: DomainBooleanValue
            booleanNo: DomainBooleanValue
            floatRange: DomainTypeRange
            integerRange: DomainTypeRange
            enumElementList: [EnumElement]
        }

        type AssemblyAttributeCategory {
            id: ID
            name: String
        }

        enum AggregationStrategy {
            None
            Equal
            Sum
        }

        type AttributeAggregate {
            attribute: AssemblyAttribute
            feature: Feature
            position: AssemblyPosition
        }

        enum PositionType {
            Module
            Assembly
        }

        enum QtyType {
            Configurable
            Static
        }

        type AssemblyPosition {
            id: ID
            name: String
            description: String
            descriptionTranslations: LocalizedString            
            type: PositionType
            defaultView: Boolean
            dynamic: Boolean
            enabled: Boolean
            qtyType: QtyType
            qty: Int
            qtyMin: Int
            qtyMax: Int
            module: Ref
            assembly: Ref
        }

        type AssemblyAttribute {
            id: ID
            name: String
            description: String
            descriptionTranslations: LocalizedString
            io: Boolean
            category: AssemblyAttributeCategory
            domain: Domain
            defaultView: Boolean
            aggregationStrategy: AggregationStrategy
            aggregateList: [AttributeAggregate]
        }

        type Assembly {
            id: ID
            name: String
            description: String
            descriptionTranslations: LocalizedString
            consistencyCheckStrategy: String
            attributes: [AssemblyAttribute]
            positions: [AssemblyPosition]
        }

        type Feature {
            id: ID
            name: String
            description: String
            descriptionTranslations: LocalizedString            
            domain: Domain
            initialValue: String
        }

        enum Status {
            Active
        }

        type FeatureValue {
            attribute: AssemblyAttribute
            feature: Feature
            value: String
        }

        type ModuleVariant {
            id: ID
            name: String
            description: String
            descriptionTranslations: LocalizedString
            longDescription: String
            longDescriptionTranslations: LocalizedString
            status: Status
            image: String
            document: String
            values: [FeatureValue]
        }

        type Module {
            id: ID
            name: String
            description: String
            descriptionTranslations: LocalizedString 
            features: [Feature]    
            variants: [ModuleVariant]      
        }

        type Query {
            listDomains: [Domain]
            listAssemblies: [Assembly]
            listModules: [Module]
        }

        type Mutation {
            deleteDomain(id: ID): Boolean
            deleteModule(id: ID): Boolean
            deleteAssembly(id: ID): Boolean
        }
    `;

    // console.log(schema);

    if (!fs.existsSync('out')) {
        fs.mkdirSync('out');
    }
    
    fs.writeFileSync('out/schema-promo.gql', schema);

    return schema;

}

module.exports = {
    generateSchema
}