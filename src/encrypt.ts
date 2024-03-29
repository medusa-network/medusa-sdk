import { Keypair, Medusa } from './index';
import { Scalar, Point } from './algebra';
import { ok, err, Result } from 'neverthrow';
import {
  Ciphertext as HGamalCipher,
  EVMCipher as HGamalEVMCipher,
} from './hgamal';
import * as hgamal from './hgamal';
import {
  EVMEncoding,
  ABIEncoder,
  ABIAddress,
  EncodingRes,
  ABIUint256,
  ABIEncoded,
} from './encoding';
import { secretbox, randomBytes } from 'tweetnacl';
import { DleqSuite } from './dleq';
import { ShaTranscript } from './transcript';
import { BigNumber, ethers } from 'ethers';

const newNonce = () => randomBytes(secretbox.nonceLength);
const generateKey = () => randomBytes(secretbox.keyLength);

/// Label needed to produce a valid ciphertext proof
export class Label implements ABIEncoder, EVMEncoding<BigNumber> {
  label: string;
  constructor(
    medusaKey: ABIEncoder,
    platformAddress: string,
    encryptor: string,
  ) {
    if (!ethers.utils.isAddress(platformAddress)) {
      throw new Error(
        `invalid platform address specified for label: ${platformAddress}`,
      );
    }
    if (!ethers.utils.isAddress(encryptor)) {
      throw new Error(
        `invalid encryptor address specified for label: ${encryptor}`,
      );
    }
    this.label = new ShaTranscript()
      // uint256 label = uint256(sha256(
      //    abi.encode(distKey.x, distKey.y, msg.sender, _encryptor)
      // ));
      .append(medusaKey)
      .append(ABIAddress(platformAddress))
      .append(ABIAddress(encryptor))
      .digest();
  }

  toEvm(): BigNumber {
    return BigNumber.from(this.label);
  }

  fromEvm(_t: BigNumber): EncodingRes<this> {
    throw new Error('Method not implemented.');
  }

  static from<S extends Scalar, P extends Point<S>>(
    medusaKey: P,
    platformAddress: string,
    encryptor: string,
  ): Label {
    return new Label(medusaKey, platformAddress, encryptor);
  }

  abiEncode(): ABIEncoded {
    return ABIUint256(BigNumber.from(this.label)).abiEncode();
  }
}

export interface EncryptionBundle<
  KeyCipherEVM,
  KeyCipher extends EVMEncoding<KeyCipherEVM>,
> {
  /// data encrypted symmetrically, can be stored anywhere like IPFS
  encryptedData: Uint8Array;
  /// key used to encrypt data, encrypted using Medusa, must be submitted to Medusa
  encryptedKey: KeyCipher;
}

export class HGamalSuite<
  S extends Scalar,
  P extends Point<S>,
  Suite extends DleqSuite<S, P>,
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
      EncryptionBundle<HGamalEVMCipher, HGamalCipher<S, P>>,
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

    /// label will output its digest so in the end we have
    /// H ( H(label), ... )
    const transcript = new ShaTranscript().append(label);
    /// then using the Medusa encryption
    const medusaCipher = await hgamal.encrypt(
      this.suite,
      medusaKey,
      key,
      transcript,
    );
    if (medusaCipher.isOk()) {
      return ok({
        encryptedData: fullMessage,
        encryptedKey: medusaCipher.value,
      });
    } else {
      return err(medusaCipher.error);
    }
  }

  /// Method to call when one wishes Medusa to reencrypt a ciphertext to us.
  /// The public part of the keypair must be notified to Medusa (via the regular
  /// way of asking to reencrypt) and the secret part must be kept and given to
  /// "oneTimeDecrypt" when the reencryption arrived.
  public keyForDecryption(): Keypair<S, P> {
    return Medusa.newKeypair(this.suite);
  }

  /// Decrypts a reencryption by medusa of the given bundle, using the
  /// secret key derived by keyForDecryption() and given the original ciphertext.
  public async decryptFromMedusa(
    secret: S,
    medusaKey: P,
    // original ciphertext of the data and more importantly the key
    bundle: EncryptionBundle<HGamalEVMCipher, HGamalCipher<S, P>>,
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
      bundle.encryptedData.length,
    );

    const decrypted = secretbox.open(message, nonce, key);
    if (decrypted === null) {
      return err(new hgamal.EncryptionError('Authenticated decryption failed'));
    }
    return ok(decrypted);
  }
}
