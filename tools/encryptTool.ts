import {isNil, isString} from 'lodash';
import {
    ready,
    to_hex,
    to_base64,
} from 'libsodium-wrappers-sumo';

import {readFile, writeFile} from 'fs';
import {join, basename} from 'path';
import {promisify} from 'util';
import {exit} from 'process';
import {generateNewSalt, calcKeyFromPassword, encryptFile, decryptFile} from "../src/CryptoTool";
import * as process from "process";
import * as child_process from "child_process";
import * as console from "console";
import * as JSON5 from "json5";

function isEqual(arr1: Uint8Array, arr2: Uint8Array): boolean {
    if (arr1.length !== arr2.length) {
        return false
    }

    return arr1.every((value, index) => value === arr2[index])
}

async function encryptModZipFile(p: string, password: string) {
    await ready;

    const f = await promisify(readFile)(p);
    console.log('f', f.length);

    const salt = await generateNewSalt();
    console.log('salt', salt.length);
    console.log('salt_hex', to_hex(salt));
    console.log('salt_base64', to_base64(salt));
    const key = await calcKeyFromPassword(password, salt);
    console.log('key', key.length);
    console.log('key_hex', to_hex(key));
    console.log('key_base64', to_base64(key));
    const {nonce, ciphertext} = await encryptFile(f, key);

    console.log('nonce', nonce.length);
    console.log('nonce_hex', to_hex(nonce));
    console.log('nonce_base64', to_base64(nonce));
    console.log('ciphertext', ciphertext.length);

    const R: {
        crypt: string,
        salt: string,
        nonce: string,
    } = {} as any;

    R.crypt = `${basename(p)}.crypt`;
    R.salt = `${basename(p)}.salt`;
    R.nonce = `${basename(p)}.nonce`;
    await promisify(writeFile)(R.crypt, ciphertext, {encoding: 'binary'});
    await promisify(writeFile)(R.salt, salt, {encoding: 'binary'});
    await promisify(writeFile)(R.nonce, nonce, {encoding: 'binary'});

    const decrypted = await decryptFile(
        await promisify(readFile)(R.crypt),
        await calcKeyFromPassword(password, await promisify(readFile)(R.salt)),
        await promisify(readFile)(R.nonce),
    );
    console.log('decrypted', decrypted.length);
    console.log(isEqual(decrypted, f));

    return R;
}

async function runScript(scriptPath: string, args: string[]) {
    return new Promise((resolve, reject) => {

        // keep track of whether callback has been invoked to prevent multiple invocations
        var invoked = false;

        var process = child_process.spawn(scriptPath);

        // listen for errors as they may prevent the exit event from firing
        process.on('error', function (err) {
            if (invoked) return;
            invoked = true;
            reject(err);
        });

        // execute the callback once the process has finished running
        process.on('close', function (code) {
            if (invoked) return;
            invoked = true;
            resolve(code);
        });

    });
}

;(async () => {

    console.log('process.argv.length', process.argv.length);
    console.log('process.argv', process.argv);
    const packModZipJsFilePath = process.argv[2];
    const configJsonFilePath = process.argv[3];
    const bootTemplateJsonPath = process.argv[4];
    const modPath = process.argv[5];
    console.log('packModZipJsFilePath', packModZipJsFilePath);
    console.log('configJsonFilePath', configJsonFilePath);
    console.log('bootTemplateJsonPath', bootTemplateJsonPath);
    console.log('modPath', modPath);
    if (!configJsonFilePath) {
        console.error('no configJsonFilePath');
        process.exit(1);
        return;
    }
    if (!bootTemplateJsonPath) {
        console.error('no bootTemplateJsonPath');
        process.exit(1);
        return;
    }
    if (!modPath) {
        console.error('no modPath');
        process.exit(1);
        return;
    }

    const configJsonF = await promisify(readFile)(configJsonFilePath, {encoding: 'utf-8'});

    const configJson: {
        modName: string,
        password: string,
        passwordHintFile?: string,
    } = JSON5.parse(configJsonF);

    if (!(
        isString(configJson.password)
        && isString(configJson.modName)
        && (isNil(configJson.passwordHintFile) ? true : isString(configJson.passwordHintFile))
    )) {
        console.error('configJson invalid');
        process.exit(1);
        return;
    }

    const rEncrypt = await encryptModZipFile(modPath, configJson.password);

    // const bootTemplateJsonPath = 'bootTemplate.json';
    const bootTemplateJsonF = await promisify(readFile)(bootTemplateJsonPath, {encoding: 'utf-8'});
    const bootTemplateJson = JSON5.parse(bootTemplateJsonF);

    bootTemplateJson.name = configJson.modName;
    bootTemplateJson.additionBinaryFile = [
        rEncrypt.crypt,
        rEncrypt.salt,
        rEncrypt.nonce,
    ];

    const passwordHintFilePath = 'passwordHintFile.txt';
    if (isString(configJson.passwordHintFile)) {
        await promisify(writeFile)(
            passwordHintFilePath,
            await promisify(readFile)(configJson.passwordHintFile, {encoding: 'utf-8'}),
            {encoding: 'utf-8'});
        if (!(bootTemplateJson.additionFile as string[]).find(T => T === passwordHintFilePath)) {
            (bootTemplateJson.additionFile as string[]).push(passwordHintFilePath);
        }
    } else {
        (bootTemplateJson.additionFile as string[]) = (bootTemplateJson.additionFile as string[]).filter(T => T !== passwordHintFilePath);
    }

    await promisify(writeFile)('boot.json', JSON5.stringify(bootTemplateJson, undefined, 2), {encoding: 'utf-8'});

    const rCode = await runScript(packModZipJsFilePath, []);

    if (rCode !== 0) {
        console.log('packModZip error', rCode);
        return;
    }

    console.log('=== Congratulation! EncryptMod done! Everything is ok. ===');
})().catch(E => {
    console.error(E);
    exit(-1);
});
