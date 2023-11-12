import {StringTable_CN} from "./CN";
import {StringTable_EN} from "./EN";

const StringTableKeys = [
    'decryptFailWithWrongSavePassword',
    'decryptFailWithWrongInputPassword',

    'password',
    'yourInputPasswordIs',
] as const;

export type StringTableTypeStringPart = { [key in typeof StringTableKeys[number]]: string; };

export interface StringTableType extends StringTableTypeStringPart {
    inputPasswordTitle(s: string): string;
    inputPasswordPlaceholder(s: string): string;
}

export function getStringTable(): StringTableType {
    switch (navigator.language) {
        case 'zh-CN':
            return StringTable_CN;
        default:
            return StringTable_EN;
    }
}
