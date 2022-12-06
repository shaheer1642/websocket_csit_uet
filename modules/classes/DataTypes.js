class DataTypes {
    constructor(attribute, required_for_endpoints, optional_for_endpoints, multiline) {
        this.autonumber = {
            attribute: attribute,
            required: required_for_endpoints || [],
            optional: optional_for_endpoints || [],
            type: 'autonumber',
            example_value: 3,
        };
        this.number = {
            attribute: attribute,
            required: required_for_endpoints || [],
            optional: optional_for_endpoints || [],
            type: 'number',
            example_value: 3
        }
        this.string = {
            attribute: attribute,
            required: required_for_endpoints || [],
            optional: optional_for_endpoints || [],
            type: 'string',
            example_value: 'some-title-string',
            multiline: multiline || false
        }
        this.uuid = {
            attribute: attribute,
            required: required_for_endpoints || [],
            optional: optional_for_endpoints || [],
            type: 'uuid',
            example_value: 'caa1534e-da15-41b6-8110-cc3fcffb14ed'
        }
        this.unix_timestamp_second = {
            attribute: attribute,
            required: required_for_endpoints || [],
            optional: optional_for_endpoints || [],
            type: 'unix_timestamp_milliseconds',
            example_value: 1665774803000
        }
    }
}

module.exports = {
    DataTypes
}