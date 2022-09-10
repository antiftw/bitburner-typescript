export default class TypeHelper{
    is(obj: any, type: NumberConstructor): obj is number;
    is(obj: any, type: StringConstructor): obj is string;
    is<T>(obj: any, type: { prototype: T }): obj is T;
    is(obj: any, type: any): boolean {
        const objType: string = typeof obj;
        const typeString = type.toString();
        const nameRegex = /Arguments|Function|String|Number|Date|Array|Boolean|RegExp/;

        let typeName = '';

        if (obj && objType === "object") {
            return obj instanceof type;
        }

        if (typeString.startsWith("class ")) {
            return type.name.toLowerCase() === objType;
        }

        typeName = typeString.match(nameRegex);
        if (typeName) {
            return typeName[0].toLowerCase() === objType;
        }

        return false;
    }
}