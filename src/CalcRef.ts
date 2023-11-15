/// <reference path="./ISimpleCryptWrapper.ts" />

export interface ISimpleCryptWrapper {
    init(): any;

    decrypt(): Promise<any>;
}

// https://developer.mozilla.org/en-US/docs/Glossary/Base64
// https://developer.mozilla.org/zh-CN/docs/Glossary/Base64

// function b64EncodeUnicode(str: string) {
//     return btoa(encodeURIComponent(str));
// }
//
// function UnicodeDecodeB64(str: string) {
//     return decodeURIComponent(atob(str));
// }

export const utf8_to_b64 = (str: string) => {
    return window.btoa(unescape(encodeURIComponent(str)));
}

export const b64_to_utf8 = (str: string) => {
    return decodeURIComponent(escape(window.atob(str)));
}

export const calcRef = (modName: string): string => {
    if (typeof modName !== 'string') {
        console.error('calcRef modName is not string', modName);
        throw new Error('calcRef modName is not string');
    }
    return utf8_to_b64(modName);
    // return b64EncodeUnicode(nodeName);
}

export const setRef = <R extends ISimpleCryptWrapper>(modName: string, ref: R) => {
    window.modSimpleCryptWrapperRefList = window.modSimpleCryptWrapperRefList || new Map<string, R>();
    const refName = calcRef(modName);
    const refItem: R | undefined = window.modSimpleCryptWrapperRefList.get(refName);
    if (refItem) {
        console.warn('setRef() duplicate refName, will overwrite. ', [modName, refName, ref, refItem]);
    }
    window.modSimpleCryptWrapperRefList.set(refName, ref);
}

export const getRef = <R extends ISimpleCryptWrapper>(modName: string): R | undefined => {
    const refName = calcRef(modName);
    return window.modSimpleCryptWrapperRefList?.get(refName);
}
