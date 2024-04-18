const fs = require('fs');
const public = require('../common/public-schema');

async function generateSchema() {

    const schema = `
        ${public.schema}

        enum DomainType {
            Boolean
            Enum
            Integer
            String
            Float
        }

        enum Status {
            Active
        }      
        
        enum AggregationStrategy {
            None
            Equal
            Sum
        }        

        enum PositionType {
            Module
            Assembly
        }

        enum QtyType {
            Configurable
            Static
        }

        enum RuleType {
            Constraint
            Combination
        }

        #######################################################################

        type Ref {
            id: ID
            name: String
        }

        input RefInput {
            id: ID
            name: String
        }        


        type LocalizedString {
            en: String
            de: String
        }

        input LocalizedStringInput {
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

        input EnumElementInput {
            name: String!
            description: String
            descriptionTranslations: LocalizedStringInput
            longDescription: String
            longDescriptionTranslations: LocalizedStringInput
        }        


        type DomainTypeRange {
            min: Float
            max: Float
        }

        input DomainTypeRangeInput {
            min: Float
            max: Float
        }


        type DomainBooleanValue {
            name: String
            nameTranslations: LocalizedString
        }

        input DomainBooleanValueInput {
            name: String
            nameTranslations: LocalizedStringInput
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

        input DomainInput {
            id: ID
            name: String!
            description: String
            type: DomainType!
            booleanYes: DomainBooleanValueInput
            booleanNo: DomainBooleanValueInput
            floatRange: DomainTypeRangeInput
            integerRange: DomainTypeRangeInput
            enumElementList: [EnumElementInput]            
        }

        input DomainDeltaInput {
            id: ID
            name: String!
            description: String
            # booleanYes: DomainBooleanValueInput
            # booleanNo: DomainBooleanValueInput
            # floatRange: DomainTypeRangeInput
            # integerRange: DomainTypeRangeInput
            enumElementList: [EnumElementInput]            
        }        


        type AssemblyAttributeCategory {
            id: ID
            name: String
        }

        input AssemblyAttributeCategoryInput {
            id: ID
            name: String
        }        


        type AttributeAggregate {
            attribute: AssemblyAttribute
            feature: Feature
            position: AssemblyPosition
        }

        input AttributeAggregateInput {
            attribute: AssemblyAttributeInput
            feature: RefInput
            position: RefInput
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

        input AssemblyPositionInput {
            id: ID
            name: String
            description: String
            descriptionTranslations: LocalizedStringInput
            type: PositionType
            defaultView: Boolean
            dynamic: Boolean
            enabled: Boolean
            qtyType: QtyType
            qty: Int
            qtyMin: Int
            qtyMax: Int
            module: RefInput
            assembly: RefInput
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

        input AssemblyAttributeInput {
            id: ID
            name: String
            description: String
            descriptionTranslations: LocalizedStringInput
            io: Boolean
            category: AssemblyAttributeCategoryInput
            domain: RefInput
            defaultView: Boolean
            aggregationStrategy: AggregationStrategy
            aggregateList: [AttributeAggregateInput]
        }        


        type Row {
            values: [String]
        }

        input RowInput {
            values: [String]
        }


        type Combination {
            columns: [String]
            rows: [Row]
        }

        input CombinationInput {
            columns: [String]
            rows: [RowInput]
        }


        type Rule {
            type: RuleType
            ruleGroup: String
            enabled: Boolean
            constraint: String
            combination: Combination
        }

        input RuleInput {
            type: RuleType
            ruleGroup: String
            enabled: Boolean
            constraint: String
            combination: CombinationInput
        }


        type Assembly {
            id: ID
            name: String
            description: String
            descriptionTranslations: LocalizedString
            consistencyCheckStrategy: String
            attributes: [AssemblyAttribute]
            positions: [AssemblyPosition]
            rules: [Rule]
        }

        input AssemblyInput {
            id: ID
            name: String
            description: String
            descriptionTranslations: LocalizedStringInput
            consistencyCheckStrategy: String
            attributes: [AssemblyAttributeInput]
            positions: [AssemblyPositionInput]
            rules: [RuleInput]
        }


        type Feature {
            id: ID
            name: String
            description: String
            descriptionTranslations: LocalizedString
            domain: Domain
            initialValue: String
        }

        input FeatureInput {
            id: ID
            name: String!
            description: String
            descriptionTranslations: LocalizedStringInput            
            domain: RefInput
            initialValue: String
        }


        type FeatureValue {
            attribute: AssemblyAttribute
            feature: Feature
            value: String
        }

        input FeatureValueInput {
            # attribute: AssemblyAttribute
            feature: RefInput
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

        input ModuleVariantInput {
            id: ID
            name: String
            description: String
            descriptionTranslations: LocalizedStringInput
            longDescription: String
            longDescriptionTranslations: LocalizedStringInput
            status: Status
            image: String
            document: String
            values: [FeatureValueInput]
        }


        type Module {
            id: ID
            name: String
            description: String
            descriptionTranslations: LocalizedString 
            features: [Feature]    
            variants: [ModuleVariant]      
        }

        input ModuleInput {
            id: ID
            name: String!
            description: String
            descriptionTranslations: LocalizedStringInput 
            features: [FeatureInput]
            variants: [ModuleVariantInput]      
        }          

        #######################################################################

        type Query {
            listDomains: [Domain]
            listAssemblies: [Assembly]
            listModules: [Module]
        }

        #######################################################################

        type Mutation {
            upsertDomain(domain: DomainInput!): Domain
            upsertDomains(domains: [DomainInput]!): [Domain]
            deleteDomain(id: ID!): Boolean
            
            upsertModule(module: ModuleInput!): Module
            upsertModules(modules: [ModuleInput]!): [Module]
            deleteModule(id: ID!): Boolean
            
            upsertAssembly(assembly: AssemblyInput!): Assembly
            upsertAssemblies(assemblies: [AssemblyInput]!): [Assembly]
            deleteAssembly(id: ID!): Boolean
            
            # deltaUpsertDomain(domain: DomainDeltaInput!): Domain
            # deltaUpsertModule(module: ModuleInput!): Module
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