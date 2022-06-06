// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
// eslint-disable-next-line no-unused-vars
// import { ethers } from "hardhat";
// const ethers = require("hardhat");
const ethers = require("ethers");
const { hexlify, arrayify } = require("ethers/lib/utils");
const ts = require("../../contracts/typechain");
const bn254 = require("../src/bn254");

// import {
// IEncryptionOracle,
// } from "../../contracts/typechain";

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');
  await bn254.init();
  const address = "0x2344f64e3acf6956a08310b2be7be1df0d265a6f";
  const url =
    "https://eth-goerli.alchemyapi.io/v2/l8Hmor8Sp3Owu8kjDVM87gF0YZNSf_60";
  const provider = new ethers.providers.JsonRpcProvider(url);
  // const provider = ethers.providers.Provider;
  // const contract = new ts.IEncryptionOracle(provider, address);
  const contract = ts.EncryptionOracle__factory.connect(address, provider);
  const key = await contract.distributedKey();
  const xbuff = arrayify(key.x.toHexString()).reverse();
  const ybuff = arrayify(key.y.toHexString()).reverse();
  const xgood = ethers.BigNumber.from(hexlify(xbuff));
  const ygood = ethers.BigNumber.from(hexlify(ybuff));
  const p = { x: xgood, y: ygood };
  console.log("Point retrieved from contract is: x:", p.x, "y:", p.y);
  const point = bn254.curve.point().fromEvm(p);
  console.log("Valid point? ", point.isOk());
  console.log("Coordinates: x: ", key.x, "y = ", key.y);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
