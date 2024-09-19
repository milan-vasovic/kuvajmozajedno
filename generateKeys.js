const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Generisanje RSA ključeva
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
    },
    privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
    }
});

// Kreiraj folder 'keys' ako ne postoji
if (!fs.existsSync('keys')) {
    fs.mkdirSync('keys');
}

// Čuvanje ključeva u 'keys' folderu
fs.writeFileSync(path.join('keys', 'publicKey.pem'), publicKey);
fs.writeFileSync(path.join('keys', 'privateKey.pem'), privateKey);

console.log('Keys have been generated.');
