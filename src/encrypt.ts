import { KeyPair, newKeypair } from "../src/index";
import { Scalar, Point, Curve } from "../src/algebra";
import { ok, err, Result } from "neverthrow";
import { curve, G1 } from "../src/bn254";
import { Ciphertext as HGamalCipher, EVMCipher as HGamalEVM } from "../src/hgamal";
import * as hgamal from "./../src/hgamal";
import { EVMEncoding } from "./encoding";
import { secretbox, randomBytes } from "tweetnacl";
import { encodeBase64, decodeBase64 } from "tweetnacl-util";

const newNonce = () => randomBytes(secretbox.nonceLength);
const generateKey = () => randomBytes(secretbox.keyLength);

export class EncryptionBundle<KeyCipherEVM, KeyCipher extends EVMEncoding<KeyCipherEVM>> {
    /// data encrypted symmetrically, can be stored anywhere like IPFS
    encrypted_data: Uint8Array;
    /// key used to encrypt data, encrypted using Medusa, must be submitted to Medusa
    encrypted_key: KeyCipher;
    constructor(d: Uint8Array, k: KeyCipher) {
        this.encrypted_data = d;
        this.encrypted_key = k;
    }
}

export class HGamalSuite<S extends Scalar, P extends Point<S>,C extends Curve<S,P>>  { 
    curve: C;

    constructor(curve: C) {
        this.curve = curve;
    }
    // XXX can't make it static because can't access C P or S then...
    public async onetimeEncrypt(data: Uint8Array, medusa_key: P)
        : Promise<Result<EncryptionBundle<HGamalEVM, HGamalCipher<S,P>>,hgamal.EncryptionError>> {
        /// first encrypt the data symmetrically
        const key = generateKey();
        const nonce = newNonce();
        const box = secretbox(data, nonce, key);
        const fullMessage = new Uint8Array(nonce.length + box.length);
        fullMessage.set(nonce);
        fullMessage.set(box, nonce.length);

        /// then using the Medusa encryption
        let medusa_cipher = await hgamal.encrypt(this.curve, medusa_key, key);
        if (medusa_cipher.isOk()) {
            return ok(new EncryptionBundle(fullMessage,medusa_cipher.value));
        } else {
            return err(medusa_cipher.error);
        }
    }

    /// Method to call when one wishes Medusa to reencrypt a ciphertext to us.
    /// The public part of the keypair must be notified to Medusa (via the regular 
    /// way of asking to reencrypt) and the secret part must be kept and given to
    /// "oneTimeDecrypt" when the reencryption arrived.
    public keyForDecryption(): KeyPair<S,P> {
        return newKeypair(this.curve);
    }
    public async onetimeDecrypt(
        secret: S,
        medusa_key: P,
        bundle: EncryptionBundle<HGamalEVM, HGamalCipher<S,P>>,
        reencryption: hgamal.Ciphertext<S,P>
        ): Promise<hgamal.DecryptionRes> {
            /// first decrypt the encryption key from Medusa
            const r = await hgamal.decryptReencryption(
                this.curve,
                secret,
                medusa_key,
                reencryption
            );
            if (!r.isOk()) {
                return err(r.error);
            }
            let key = r.value;
            /// then decrypt the original data with this key
            const nonce = bundle.encrypted_data.slice(0, secretbox.nonceLength);
            const message = bundle.encrypted_data.slice(secretbox.nonceLength, bundle.encrypted_data.length);

            const decrypted = secretbox.open(message, nonce, key);
            return ok(decrypted);
        }
}