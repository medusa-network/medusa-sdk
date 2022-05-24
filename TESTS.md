# How to run tests on this folder

1) Go to main [contracts](./contracts) folder and run following commands:
```
npm install
npx hardhat compile
```

2) Go back in `js` folder and run following commands:
```
npm install
npm run test
```

## Output

If everything goes well you'll see a result like this:
```

> medusa-js@1.0.0 test
> npx hardhat test

No need to generate any newer typings.


  testing bn254 wrapper
    ✔ group operations
    ✔ new keypair
    ✔ serialization scalar
    ✔ serialization point
p1.x =  09df360bdc70c00e7b59d8e9a81a99da67be41eee07eb511bf1d208c38fe811e  - p1.y =  f2447b87cb94039da59d04930d74b55a95db5fd83c7ed074ca8cd78c5f01d129
p2.x =  09df360bdc70c00e7b59d8e9a81a99da67be41eee07eb511bf1d208c38fe811e  - p2.y =  55b801514bf71c9fe72c6dd583f6cb3cc87c21a979c77f435f135a54134d9306
random p:  0x09df360bdc70c00e7b59d8e9a81a99da67be41eee07eb511bf1d208c38fe811e
random -p:  0x09df360bdc70c00e7b59d8e9a81a99da67be41eee07eb511bf1d208c38fe819e
random p.x:  0x09df360bdc70c00e7b59d8e9a81a99da67be41eee07eb511bf1d208c38fe811e
random p.y:  0x55b801514bf71c9fe72c6dd583f6cb3cc87c21a979c77f435f135a54134d9306
    ✔ Compatibility with rust code

  Test Encoding 
    ✔ local encoding & decoding curve
    ✔ encoding g1point evm (442ms)

  hgamal encryption
    ✔ decryption of reencryption

  foo testing
    ✔ foo()
    ✔ only zero


  10 passing (676ms)
```