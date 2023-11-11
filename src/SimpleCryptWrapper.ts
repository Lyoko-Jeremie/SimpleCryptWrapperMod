import JSZip from "jszip";
import type {LifeTimeCircleHook, LogWrapper} from "../../../dist-BeforeSC2/ModLoadController";
import type {SC2DataManager} from "../../../dist-BeforeSC2/SC2DataManager";
import type {ModUtils} from "../../../dist-BeforeSC2/Utils";
import type {ModBootJson, ModInfo} from "../../../dist-BeforeSC2/ModLoader";
import {isArray, isNil, isString} from 'lodash';
import {ready} from 'libsodium-wrappers';
import {decryptFile, calcKeyFromPasswordBrowser} from './CryptoTool';

export interface CryptDataItem {
    crypt: string;
    nonce: string;
    salt: string;
}

export class SimpleCryptWrapper {
    private logger: LogWrapper;

    private readonly ModName: string = '';

    private readonly infoCreateOk = false;

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
            const mod = this.gSC2DataManager.getModLoader().getModByNameOne('CryptoI18n');
            if (!mod) {
                console.error(`[${this.ModName}] Mod not found`);
                this.logger.error(`[${this.ModName}] Mod not found`);
                return;
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
                const key = await calcKeyFromPasswordBrowser(await this.readPassword(), salt);
                const decryptZip = await decryptFile(
                    crypt,
                    key,
                    nonce,
                ).catch(async (E) => {
                    console.error(`[${this.ModName}] decrypt error`, [nn, E]);
                    this.logger.error(`[${this.ModName}] decrypt error [${nn[0]}] [${E?.message ? E.message : E}]`);
                    await window.modSweetAlert2Mod.fire(`解密失败，密码错误: [${E?.message ? E.message : E}]`);
                });
                if (!decryptZip) {
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

    // TODO get password from user input
    async readPassword() {
        if (!this.infoCreateOk) {
            console.log(`[SimpleCryptWrapper] cannot call readPassword(), constructor not completed`);
            this.logger.log(`[SimpleCryptWrapper] cannot call readPassword(), constructor not completed`);
        }
        // TODO
        try {
            const {value: password} = await window.modSweetAlert2Mod.fireWithOptions({
                title: `请输入${this.ModName}的密码`,
                input: 'password',
                inputLabel: '密码',
                inputPlaceholder: `请输入${this.ModName}的密码`,
                inputAttributes: {
                    maxlength: '1000',
                    autocapitalize: 'off',
                    autocorrect: 'off'
                },
            });

            if (password) {
                await window.modSweetAlert2Mod.fire(`你输入的密码是: ${password}`);
            }

            return password;
        } catch (e) {
            console.error(e);
        }
        return undefined;
    }

    tryLoadPassword() {
        if (!this.infoCreateOk) {
            console.log(`[SimpleCryptWrapper] cannot call tryLoadPassword(), constructor not completed`);
            this.logger.log(`[SimpleCryptWrapper] cannot call tryLoadPassword(), constructor not completed`);
        }
        // try load from localstorage
    }

    savePassword() {
        if (!this.infoCreateOk) {
            console.log(`[SimpleCryptWrapper] cannot call savePassword(), constructor not completed`);
            this.logger.log(`[SimpleCryptWrapper] cannot call savePassword(), constructor not completed`);
        }
        // encrypt and save to localstorage
    }

    init() {
        if (!this.infoCreateOk) {
            console.log(`[SimpleCryptWrapper] cannot call init(), constructor not completed`);
            this.logger.log(`[SimpleCryptWrapper] cannot call init(), constructor not completed`);
        }
    }
}
