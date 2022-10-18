import { KeyPair, newKeypair } from "../src/index";
import { Scalar, Point, Curve } from "../src/algebra";
import { ok, err, Result } from "neverthrow";
import { curve, G1 } from "../src/bn254";
import { Ciphertext as HGamalCipher, EVMCipher as HGamalEVM } from "../src/hgamal";
import * as hgamal from "./../src/hgamal";
import { EVMEncoding } from "./encoding";

export class EncryptionBundle<KeyCipherEVM, KeyCipher extends EVMEncoding<KeyCipherEVM>> {
    /// data encrypted symmetrically, can be stored anywhere like IPFS
    encrypted_data: Uint8Array;
    /// iv used to encrypt symmetrically 
    iv: Uint8Array;
    /// key used to encrypt data, encrypted using Medusa, must be submitted to Medusa
    encrypted_key: KeyCipher;
    constructor(d: Uint8Array, iv: Uint8Array, k: KeyCipher) {
        this.encrypted_data = d;
        this.encrypted_key = k;
        this.iv = iv;
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
        let key = await window.crypto.subtle.generateKey(
            {
                name: "AES-GCM",
                length: 256,
            },
            true,
            ["encrypt", "decrypt"]);
        let iv = window.crypto.getRandomValues(new Uint8Array(12));
        let ciphertext = await window.crypto.subtle.encrypt(
            {
              name: "AES-GCM",
              iv: iv
            },
            key,
            data,
          );
        
        /// then using the Medusa encryption
        let keybuffer = await window.crypto.subtle.exportKey("raw",key);
        let medusa_cipher = await hgamal.encrypt(this.curve, medusa_key, new Uint8Array(keybuffer));
        if (medusa_cipher.isOk()) {
            return ok(new EncryptionBundle(new Uint8Array(ciphertext),iv,medusa_cipher.value));
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
            let key = await window.crypto.subtle.importKey( "raw", r.value, "AES-GCM",
                                            true, ["encrypt", "decrypt"]);
            /// then decrypt the original data with this key
            let data = await window.crypto.subtle.decrypt(
                {
                  name: "AES-GCM",
                  iv: bundle.iv,
                },
                key,
                bundle.encrypted_data,
              );
              return ok(new Uint8Array(data));
        }
}