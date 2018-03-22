let airdrop = require('../lib/airdrop');

const AslTokenSale = artifacts.require("./AslTokenSale.sol");
const AslToken = artifacts.require("./AslToken.sol");

let airdropAmountsFileName;

function saveCheckpoint(resultsFileName, airdropAmounts) {
  fs.writeFile(resultsFileName, JSON.stringify(airdropAmounts), (err) => {
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

  let airdropAmounts = require('./' + airdropAmountsFile);

  tokenSaleInstance = await AslTokenSale.deployed();
  tokenInstance = AslToken.at(await tokenSaleInstance.token());

  let gasPrice = parseInt(process.env.GAS_PRICE, 10) || 10 * 10 ** 9; // 10 GWEI default

  let resultsFileName = airdropAmountsFileName.replace(".json", "") + "-results.json";

  await airdrop.distribute(web3, tokenSaleInstance, tokenInstance, airdropAmounts, gasPrice, saveCheckpoint.bind(this, resultsFileName));

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