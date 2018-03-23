let airdrop = require('../lib/airdrop');
const fs = require('fs');
const promisify = require("promisify-es6");

const AslTokenSale = artifacts.require("./AslTokenSale.sol");
const AslToken = artifacts.require("./AslToken.sol");


function saveCheckpoint(fileName, airdropAmounts) {
  fs.writeFile(fileName, JSON.stringify(airdropAmounts), (err) => {
    if (err) {
      return console.log("Error writing checkpoint file", err);
    }
  });
}

async function run() {
  let airdropAmountsFile = process.env.AIRDROP_AMOUNTS_FILE;

  if (!airdropAmountsFile) {
    throw new Error("AIRDROP_AMOUNTS_FILE missing");
  }

  let airdropAmountsFilePath = './' + airdropAmountsFile;
  let airdropAmountsBackupFilePath = airdropAmountsFilePath + ".backup-" + (+ new Date());

  // backup airdrop amounts file since progress will be saved after each transfer
  await promisify(fs.copyFile)(airdropAmountsFilePath, airdropAmountsBackupFilePath);

  let airdropAmounts = require("." + airdropAmountsFilePath); // require is done from current directory ...

  tokenSaleInstance = await AslTokenSale.deployed();
  tokenInstance = AslToken.at(await tokenSaleInstance.token());

  let gasPrice = parseInt(process.env.GAS_PRICE, 10) || 10 * 10 ** 9; // 10 GWEI default


  await airdrop.distribute(web3, tokenSaleInstance, tokenInstance, airdropAmounts, gasPrice, saveCheckpoint.bind(this, airdropAmountsFile));

  console.log("Airdrop distribution done");
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