import {} from 'lodash';
import {
    ready,
    to_hex,
    to_base64,
} from 'libsodium-wrappers-sumo';

import {readFile, writeFile} from 'fs';
import {join} from 'path';
import {promisify} from 'util';
import {exit} from 'process';
import {generateNewSalt, calcKeyFromPassword, encryptFile, decryptFile} from "../src/CryptoTool";

function isEqual(arr1: Uint8Array, arr2: Uint8Array): boolean {
    if (arr1.length !== arr2.length) {
        return false
    }

    return arr1.every((value, index) => value === arr2[index])
}

;(async () => {
    await ready;

    const f = await promisify(readFile)(join('../i18n/ModI18N.mod.zip'));
    console.log('f', f.length);

    const password = '123456789';

    const salt = await generateNewSalt();
    console.log('salt', salt.length);
    console.log('salt', to_hex(salt));
    console.log('salt', to_base64(salt));
    const key = await calcKeyFromPassword(password, salt);
    console.log('key', key.length);
    console.log('key', to_hex(key));
    console.log('key', to_base64(key));
    const {nonce, ciphertext} = await encryptFile(f, key);

    console.log('nonce', nonce.length);
    console.log('nonce', to_hex(nonce));
    console.log('nonce', to_base64(nonce));
    console.log('ciphertext', ciphertext.length);

    await promisify(writeFile)(join('./ModI18N.mod.zip.crypt'), ciphertext, {encoding: 'binary'});
    await promisify(writeFile)(join('./ModI18N.mod.zip.salt'), salt, {encoding: 'binary'});
    await promisify(writeFile)(join('./ModI18N.mod.zip.nonce'), nonce, {encoding: 'binary'});

    const decrypted = await decryptFile(
        await promisify(readFile)(join('./ModI18N.mod.zip.crypt')),
        await calcKeyFromPassword(password, await promisify(readFile)(join('./ModI18N.mod.zip.salt'))),
        await promisify(readFile)(join('./ModI18N.mod.zip.nonce')),
    );
    console.log('decrypted', decrypted.length);
    console.log(isEqual(decrypted, f));

})().catch(E => {
    console.error(E);
    exit(-1);
});
