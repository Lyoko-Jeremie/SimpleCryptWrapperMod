import {StringTableType} from "./StringTable";

export const StringTable_CN: StringTableType = {
    decryptFailWithWrongSavePassword: '解密失败，已存储的密码无效，清除已存储的密码。',
    decryptFailWithWrongInputPassword: '解密失败，输入的密码错误。',

    password: '密码',
    yourInputPasswordIs: '你输入的密码是：',

    inputPasswordTitle(s: string): string {
        return `请输入${s}的密码`;
    },
    inputPasswordPlaceholder(s: string): string {
        return `请输入${s}的密码`;
    },
};
