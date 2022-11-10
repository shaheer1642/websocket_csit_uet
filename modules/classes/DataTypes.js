export default class DataTypes {
    #attribute;
    #required_for_endpoints;
    #optional_for_endpoints;
    constructor(attribute, required_for_endpoints, optional_for_endpoints) {
        this.#attribute = attribute
        this.#required_for_endpoints = required_for_endpoints || []
        this.#optional_for_endpoints = optional_for_endpoints || []
    }
    autonumber = {
        attribute: this.#attribute,
        required: this.#required_for_endpoints,
        optional: this.#optional_for_endpoints,
        type: 'autonumber',
        example_value: 3
    };
    number = {
        attribute: this.#attribute,
        required: this.#required_for_endpoints,
        optional: this.#optional_for_endpoints,
        type: 'number',
        example_value: 3
    }
    string = {
        attribute: this.#attribute,
        required: this.#required_for_endpoints,
        optional: this.#optional_for_endpoints,
        type: 'string',
        example_value: 'some-title-string'
    }
    uuid = {
        attribute: this.#attribute,
        required: this.#required_for_endpoints,
        optional: this.#optional_for_endpoints,
        type: 'uuid',
        example_value: 'caa1534e-da15-41b6-8110-cc3fcffb14ed'
    }
    unix_timestamp_second = {
        attribute: this.#attribute,
        required: this.#required_for_endpoints,
        optional: this.#optional_for_endpoints,
        type: 'unix_timestamp_second',
        example_value: 1665774803
    }
}
