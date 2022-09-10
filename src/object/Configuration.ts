import TypeHelper from "/toolbox/TypeHelper";
import { IConfiguration } from "/types";
export default class Configuration implements IConfiguration {
    name: string;
    value: string | number | boolean | string[] | number[];
    category: string;
    type: TypeHelper;
    constructor(name: string, value: string | number | boolean | string[] | number[] , category: string) {
        this.name = name;
        this.value = value;
        this.category = category;
        this.type = new TypeHelper();
    }
    getStringValue() : string {
        if(this.type.is(this.value, String)) {
            return this.value;
        }
        return '';
    }

    getNumberValue(): number {
        if(this.type.is(this.value, Number)) {
            return this.value;
        }
        return 0;
    }
    getArrayValue(): Array<any> {
        if(this.type.is(this.value, Array)) {
            return this.value;
        }
        return [];
    }
    getObject(): unknown {
        if(this.type.is(this.value, Object)) {
            return this.value;
        }
        return {};
    }
    getBooleanValue(): boolean {
        if(this.type.is(this.value, Boolean)) {
            return this.value;
        }
        return false;
    }
}