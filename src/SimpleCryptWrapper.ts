import type {LogWrapper} from "../../../dist-BeforeSC2/ModLoadController";
import type {SC2DataManager} from "../../../dist-BeforeSC2/SC2DataManager";
import type {ModUtils} from "../../../dist-BeforeSC2/Utils";
import {isString} from 'lodash';
import {ready} from 'libsodium-wrappers';
import {calcKeyFromPasswordBrowser, decryptFile} from './CryptoTool';
import {getStringTable} from "./GUI_StringTable/StringTable";
import {ISimpleCryptWrapper} from "./ISimpleCryptWrapper";
import {setRef} from "./CalcRef";

const ST = getStringTable();

export interface CryptDataItem {
    crypt: string;
    nonce: string;
    salt: string;
}

const PasswordHintFile = 'passwordHintFile.txt';

export class SimpleCryptWrapper implements ISimpleCryptWrapper {
    private logger: LogWrapper;

    private readonly ModName: string = '';

    private readonly infoCreateOk: boolean = false;

    constructor(
        public gSC2DataManager: SC2DataManager,
        public gModUtils: ModUtils,
    ) {
        this.logger = gModUtils.getLogger();
        if (gModUtils?.getSemVerTools && gModUtils.getSemVerTools()) {
            const semVer = gModUtils.getSemVerTools();
            if (semVer.satisfies(semVer.parseVersion(gModUtils.version).version, semVer.parseRange('>=2.5.1'))) {

                // do init
                const ModName = gModUtils.getNowRunningModName();
                if (isString(ModName)) {

                    this.ModName = ModName;
                    this.infoCreateOk = true;

                    setRef(ModName, this);

                    return;
                } else {
                    this.logger.error(`[SimpleCryptWrapper] constructor failed, ModName is not string`);
                    return;
                }
            } else {
                this.logger.error(`[SimpleCryptWrapper] constructor failed, ModLoader version not match. need >=2.5.1`);
            }
        } else {
            this.logger.error(`[SimpleCryptWrapper] constructor failed, ModLoader version not match. no getSemVerTools.`);
        }
        return;
    }

    async decrypt() {
        if (!this.infoCreateOk) {
            console.log(`[SimpleCryptWrapper] cannot call decrypt(), constructor not completed`);
            this.logger.log(`[SimpleCryptWrapper] cannot call decrypt(), constructor not completed`);
        }
        try {
            console.log(`[${this.ModName}] decrypt`);
            this.logger.log(`[${this.ModName}] decrypt`);
            await ready;
            const mod = this.gSC2DataManager.getModLoader().getModByNameOne(this.ModName);
            if (!mod) {
                console.error(`[${this.ModName}] cannot find inner Mod , maybe the package is broken`);
                this.logger.error(`[${this.ModName}] cannot find inner Mod , maybe the package is broken`);
                return;
            }

            let passwordHint: string | undefined = undefined;
            if (mod.mod.bootJson.additionFile.find(T => T === PasswordHintFile)) {
                passwordHint = await mod.zip.zip.file(PasswordHintFile)?.async('string');
            }

            const cdi = new Map<string, CryptDataItem>();
            mod.mod.bootJson.additionBinaryFile?.forEach((T) => {
                let fileName = '';
                let typeName: keyof CryptDataItem;
                if (T.endsWith('.crypt')) {
                    fileName = T.slice(0, -6);
                    typeName = 'crypt';
                } else if (T.endsWith('.nonce')) {
                    fileName = T.slice(0, -6);
                    typeName = 'nonce';
                } else if (T.endsWith('.salt')) {
                    fileName = T.slice(0, -5);
                    typeName = 'salt';
                } else {
                    console.warn(`[${this.ModName}] Unknown file type`, T);
                    this.logger.warn(`[${this.ModName}] Unknown file type [${T}]`);
                    return;
                }
                if (!cdi.has(fileName)) {
                    cdi.set(fileName, {} as CryptDataItem);
                }
                const nn = cdi.get(fileName)!;
                nn[typeName] = T;
            });
            for (const nn of cdi) {
                if (!(nn[1].crypt && nn[1].nonce && nn[1].salt)) {
                    console.warn(`[${this.ModName}] Missing file`, [nn]);
                    this.logger.warn(`[${this.ModName}] Missing file [${nn[0]}]`);
                    continue;
                }
                const crypt = await mod.zip.zip.file(nn[1].crypt)?.async('uint8array');
                const nonce = await mod.zip.zip.file(nn[1].nonce)?.async('uint8array');
                const salt = await mod.zip.zip.file(nn[1].salt)?.async('uint8array');
                if (!(crypt && nonce && salt)) {
                    console.warn(`[${this.ModName}] cannot get file from zip`, [nn, crypt, nonce, salt]);
                    this.logger.warn(`[${this.ModName}] cannot get file from zip [${nn[0]}]`);
                    continue;
                }
                const tryDecrypt = async (password: string) => {
                    const key = await calcKeyFromPasswordBrowser(password, salt);
                    return await decryptFile(
                        crypt,
                        key,
                        nonce,
                    );
                }
                let decryptZip: Uint8Array | undefined = undefined;
                // try read
                try {
                    const savedP = this.tryLoadPassword();
                    if (isString(savedP)) {
                        decryptZip = await tryDecrypt(savedP);
                    }
                } catch (E: Error | any) {
                    this.cleanSavedPassword();
                    console.error(`[${this.ModName}] decrypt error by read saved password`, [nn, E]);
                    this.logger.error(`[${this.ModName}] decrypt error by read saved password [${nn[0]}] [${E?.message ? E.message : E}]`);
                    await window.modSweetAlert2Mod.fire(`Mod[${this.ModName}] ${ST.decryptFailWithWrongSavePassword} [${E?.message ? E.message : E}]`);
                }
                if (!decryptZip) {
                    // try input
                    const inputP = await this.inputPassword(passwordHint);
                    try {
                        decryptZip = await tryDecrypt(inputP);
                    } catch (E: Error | any) {
                        console.error(`[${this.ModName}] decrypt error by input password`, [nn, E]);
                        this.logger.error(`[${this.ModName}] decrypt error by input password [${nn[0]}] [${E?.message ? E.message : E}]`);
                        await window.modSweetAlert2Mod.fire(`Mod[${this.ModName}] ${ST.decryptFailWithWrongInputPassword} [${E?.message ? E.message : E}]`);
                        return;
                    }
                    this.savePassword(inputP);
                }
                if (!decryptZip) {
                    // never go there
                    console.error(`[${this.ModName}] decrypt error, no valid decrypt password`, [nn]);
                    this.logger.error(`[${this.ModName}] decrypt error, no valid decrypt password [${nn[0]}]`);
                    return;
                }
                if (!await this.gModUtils.lazyRegisterNewModZipData(decryptZip)) {
                    console.error(`[${this.ModName}] cannot register new mod zip data`, [nn, decryptZip]);
                    this.logger.error(`[${this.ModName}] cannot register new mod zip data [${nn[0]}]`);
                } else {
                    console.log(`[${this.ModName}] decrypt success`, [nn]);
                    this.logger.log(`[${this.ModName}] decrypt success [${nn[0]}]`);
                }
            }
        } catch (e: any) {
            console.error(e);
            this.logger.error(`[${this.ModName}] decrypt () Error:[${e?.message ? e.message : e}]`);
        }
    }

    // get password from user input
    async inputPassword(passwordHint: string | undefined = undefined) {
        if (!this.infoCreateOk) {
            console.log(`[SimpleCryptWrapper] cannot call readPassword(), constructor not completed`);
            this.logger.log(`[SimpleCryptWrapper] cannot call readPassword(), constructor not completed`);
        }
        try {
            const {value: password} = await window.modSweetAlert2Mod.fireWithOptions({
                title: `${ST.inputPasswordTitle(this.ModName)}\n${passwordHint ? passwordHint : ''}`,
                input: 'password',
                inputLabel: `${ST.password}`,
                inputPlaceholder: `${ST.inputPasswordPlaceholder(this.ModName)}`,
                inputAttributes: {
                    maxlength: '1000',
                    autocapitalize: 'off',
                    autocorrect: 'off'
                },
            });

            if (password) {
                await window.modSweetAlert2Mod.fire(`${ST.yourInputPasswordIs} ${password}`);
            }

            return password;
        } catch (e) {
            console.error(e);
        }
        return undefined;
    }

    cleanSavedPassword() {
        if (!this.infoCreateOk) {
            console.log(`[SimpleCryptWrapper] cannot call savePassword(), constructor not completed`);
            this.logger.log(`[SimpleCryptWrapper] cannot call savePassword(), constructor not completed`);
        }
        // clean saved password in localstorage
        localStorage.removeItem(`SimpleCryptWrapper_${this.ModName}_password`);
    }

    tryLoadPassword() {
        if (!this.infoCreateOk) {
            console.log(`[SimpleCryptWrapper] cannot call tryLoadPassword(), constructor not completed`);
            this.logger.log(`[SimpleCryptWrapper] cannot call tryLoadPassword(), constructor not completed`);
        }
        // try load from localstorage
        const p = localStorage.getItem(`SimpleCryptWrapper_${this.ModName}_password`);
        if (isString(p)) {
            return p;
        }
        return undefined;
    }

    savePassword(password: string) {
        if (!this.infoCreateOk) {
            console.log(`[SimpleCryptWrapper] cannot call savePassword(), constructor not completed`);
            this.logger.log(`[SimpleCryptWrapper] cannot call savePassword(), constructor not completed`);
        }
        // encrypt and save to localstorage
        localStorage.setItem(`SimpleCryptWrapper_${this.ModName}_password`, password);
    }

    init() {
        if (!this.infoCreateOk) {
            console.log(`[SimpleCryptWrapper] cannot call init(), constructor not completed`);
            this.logger.log(`[SimpleCryptWrapper] cannot call init(), constructor not completed`);
        }
    }
}
