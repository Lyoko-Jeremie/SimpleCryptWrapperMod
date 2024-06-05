import {isNil, isString} from 'lodash';
import {
    ready,
    to_hex,
    to_base64,
} from 'libsodium-wrappers-sumo';

import {readFile, writeFile, unlink} from 'fs';
import {join, basename} from 'path';
import {promisify} from 'util';
import {exit} from 'process';
import {generateNewSalt, calcKeyFromPassword, encryptFile, decryptFile} from "../src/CryptoTool";
import * as process from "process";
import * as child_process from "child_process";
import * as console from "console";
import JSON5 from "json5";

function isEqual(arr1: Uint8Array, arr2: Uint8Array): boolean {
    if (arr1.length !== arr2.length) {
        return false;
    }

    return arr1.every((value, index) => value === arr2[index]);
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


async function decryptAFile(
    P: string,
    password: string,
) {
    await ready;

    const R: {
        crypt: string,
        salt: string,
        nonce: string,
    } = {} as any;
    R.crypt = `${basename(P)}.crypt`;
    R.salt = `${basename(P)}.salt`;
    R.nonce = `${basename(P)}.nonce`;

    const decrypted = await decryptFile(
        await promisify(readFile)(R.crypt),
        await calcKeyFromPassword(password, await promisify(readFile)(R.salt)),
        await promisify(readFile)(R.nonce),
    );

    await promisify(writeFile)(P, decrypted, {encoding: 'binary'});

    return R;
}

async function runScript(scriptPath: string, args: string[]) {
    return new Promise((resolve, reject) => {

        // keep track of whether callback has been invoked to prevent multiple invocations
        let invoked = false;

        const process = child_process.spawn('node', [scriptPath].concat(args));

        process.stdout.on('data', function (data) {
            console.log(data.toString());
        });
        process.stderr.on('data', function (data) {
            console.error(data.toString());
        });

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
    const decryptFilePath = process.argv[2];
    const password = process.argv[3];
    console.log('decryptFilePath', decryptFilePath);
    console.log('password', password);
    if (!decryptFilePath) {
        console.error('no decryptFilePath');
        process.exit(1);
        return;
    }
    if (!password) {
        console.error('no password');
        process.exit(1);
        return;
    }

    await decryptAFile(decryptFilePath, password);

    console.log('=== Congratulation! test-decryptTool done! Everything is ok. ===');
})().catch(E => {
    console.error(E);
    exit(-1);
});
