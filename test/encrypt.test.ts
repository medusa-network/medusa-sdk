import * as hgamal from "./../src/hgamal";
import { new_keypair, KeyPair } from "../src";
import { init, curve } from "../src/bn254";
import { Scalar, Point } from "../src/algebra";

import assert from "assert";

function reencrypt<S extends Scalar, P extends Point<S>>(kp: KeyPair<S,P>, 
    recipient: P,
    c: hgamal.Ciphertext<P>): hgamal.ReencryptedCipher<P> {
    // p(rG + B)
    // see hgamal script for more details
    const random = recipient.add(c.random).mul(kp.secret);
    const cipher : hgamal.ReencryptedCipher<P> = {
        random: random,
        cipher: c.cipher,
    };
    return cipher;
}

describe("hgamal encryption", () => {
   before(async () =>  {
       await init();
   }) 

   it("decryption of reencryption", () => {
        const proxy = new_keypair(curve);
        const bob = new_keypair(curve);
        const msgStr = "Hello Bob";
        const msgBuff = new TextEncoder().encode(msgStr.padEnd(32,"\0"));
        let c = hgamal.encrypt(curve,proxy.pubkey,msgBuff);
        assert.ok(c.isOk());
        let ciphertext = c._unsafeUnwrap();
        let reencryption = reencrypt(proxy, bob.pubkey,ciphertext);
        let m = hgamal.decrypt_reencryption(curve,bob.secret,proxy.pubkey,reencryption);
        assert.ok(m.isOk());
        let found = m._unsafeUnwrap();
        let canonical :string = new TextDecoder().decode(found);
        canonical = canonical.replaceAll("\0","");
        assert.strictEqual(msgStr,canonical);
    });
});