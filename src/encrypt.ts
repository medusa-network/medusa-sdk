import { KeyPair, newKeypair } from "./index";
import { Scalar, Point, Curve, EVMG1Point } from "./algebra";
import { ok, err, Result } from "neverthrow";
import { Ciphertext as HGamalCipher, EVMCipher as HGamalEVM } from "./hgamal";
import * as hgamal from "./hgamal";
import { EVMEncoding, ABIEncoder, ABIString, ABIAddress, ABIBytes32, EncodingRes, ABIUint256 } from "./encoding";
import { secretbox, randomBytes } from "tweetnacl";
import { DleqSuite } from "./dleq";
import { ShaTranscript, EVMTranscript } from "./transcript";
import { BigNumber, BytesLike, ethers } from "ethers";
import { arrayify } from "ethers/lib/utils";

const newNonce = () => randomBytes(secretbox.nonceLength);
const generateKey = () => randomBytes(secretbox.keyLength);

/// Label needed to produce a valid ciphertext proof
export class Label implements ABIEncoder, EVMEncoding<BigNumber> {
  label: string;
  constructor(medusa_key: ABIEncoder, platform_address: string, encryptor: string) {
    if (!ethers.utils.isAddress(platform_address)) {
      throw new Error("invalid platform address specified for label");
    }
    if (!ethers.utils.isAddress(encryptor)) {
      throw new Error("invalid encryptor address specified for label");
    }
    this.label = new ShaTranscript()
      .append(medusa_key)
      .append(ABIAddress(platform_address))
      .append(ABIAddress(encryptor))
      .digest();
  }
  toEvm(): BigNumber {
    return BigNumber.from(this.label);
  }
  fromEvm(t: BigNumber): EncodingRes<this> {
    throw new Error("Method not implemented.");
  }

  static from<S extends Scalar, P extends Point<S>>(medusa_key: P, platform_address: string, encryptor: string): Label {
    return new Label(medusa_key, platform_address, encryptor);
  }
  abiEncode(): [string[], any[]] {
    return ABIUint256(BigNumber.from(this.label)).abiEncode();
  }
}
export class EncryptionBundle<
  KeyCipherEVM,
  KeyCipher extends EVMEncoding<KeyCipherEVM>
> {
  /// data encrypted symmetrically, can be stored anywhere like IPFS
  encryptedData: Uint8Array;
  /// key used to encrypt data, encrypted using Medusa, must be submitted to Medusa
  encryptedKey: KeyCipher;
  constructor(d: Uint8Array, k: KeyCipher) {
    this.encryptedData = d;
    this.encryptedKey = k;
  }
}

export class HGamalSuite<
  S extends Scalar,
  P extends Point<S>,
  Suite extends DleqSuite<S, P>
> {
  suite: Suite;

  constructor(suite: Suite) {
    this.suite = suite;
  }

  /// method to encrypt data to Medusa.
  // XXX can't make it static because can't access C P or S then...
  public async encryptToMedusa(
    data: Uint8Array,
    medusaKey: P,
    label: Label,
  ): Promise<
    Result<
      EncryptionBundle<HGamalEVM, HGamalCipher<S, P>>,
      hgamal.EncryptionError
    >
  > {
    /// first encrypt the data symmetrically
    const key = generateKey();
    const nonce = newNonce();
    const box = secretbox(data, nonce, key);
    const fullMessage = new Uint8Array(nonce.length + box.length);
    fullMessage.set(nonce);
    fullMessage.set(box, nonce.length);

    /// in dleq -> H ( H(label), ... )
    const transcript = new ShaTranscript().append(label);
    /// then using the Medusa encryption
    const medusaCipher = await hgamal.encrypt(this.suite, medusaKey, key, transcript);
    if (medusaCipher.isOk()) {
      return ok(new EncryptionBundle(fullMessage, medusaCipher.value));
    } else {
      return err(medusaCipher.error);
    }
  }

  /// Method to call when one wishes Medusa to reencrypt a ciphertext to us.
  /// The public part of the keypair must be notified to Medusa (via the regular
  /// way of asking to reencrypt) and the secret part must be kept and given to
  /// "oneTimeDecrypt" when the reencryption arrived.
  public keyForDecryption(): KeyPair<S, P> {
    return newKeypair(this.suite);
  }

  /// Decrypts a reencryption by medusa of the given bundle, using the
  /// secret key derived by keyForDecryption() and given the original ciphertext.
  public async decryptFromMedusa(
    secret: S,
    medusaKey: P,
    // original ciphertext of the data and more importantly the key
    bundle: EncryptionBundle<HGamalEVM, HGamalCipher<S, P>>,
    // the reencryption of the key by the medusa network
    reencryption: hgamal.MedusaReencryption<S, P>,
  ): Promise<hgamal.DecryptionRes> {
    /// first decrypt the encryption key from Medusa
    const r = await hgamal.decryptReencryption(
      this.suite,
      secret,
      medusaKey,
      bundle.encryptedKey, // original cipher of the key
      reencryption, // reencryption done by medusa
    );
    if (!r.isOk()) {
      return err(r.error);
    }
    const key = r.value;
    /// then decrypt the original data with this key
    const nonce = bundle.encryptedData.slice(0, secretbox.nonceLength);
    const message = bundle.encryptedData.slice(
      secretbox.nonceLength,
      bundle.encryptedData.length
    );

    const decrypted = secretbox.open(message, nonce, key);
    if (decrypted === null) {
      return err(new hgamal.EncryptionError("Authenticated decryption failed"));
    }
    return ok(decrypted);
  }
}
