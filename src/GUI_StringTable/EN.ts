import {StringTableType} from "./StringTable";

export const StringTable_EN: StringTableType = {
    decryptFailWithWrongSavePassword: 'Decrypt fail with wrong save password. clean saved password.',
    decryptFailWithWrongInputPassword: 'Decrypt fail with wrong input password.',

    password: 'Password',
    yourInputPasswordIs: 'Your input password is :',

    inputPasswordTitle(s: string): string {
        return `Please input password for ${s}`;
    },
    inputPasswordPlaceholder(s: string): string {
        return `Input password for ${s}`;
    },
};
