let airdrop = require('../lib/airdrop');
let fs = require('fs');
const promisify = require("promisify-es6");

const AslTokenSale = artifacts.require("./AslTokenSale.sol");
const AslToken = artifacts.require("./AslToken.sol");

async function run() {
  tokenSaleInstance = await AslTokenSale.deployed();
  tokenInstance = AslToken.at(await tokenSaleInstance.token());

  let airdropAmounts = await airdrop.getAirDropAmounts(web3, tokenSaleInstance, tokenInstance);

  let fileName = `airdrop-amounts-${+new Date()}.json`;
  await promisify(fs.writeFile)(fileName, JSON.stringify(airdropAmounts));
  console.log("Airdrop amounts saved to : ", fileName);
}

module.exports = function (callback) {
  try {
    run().then(() => {
      callback();
    })
  }
  catch (err) {
    callback(err);
  }
};