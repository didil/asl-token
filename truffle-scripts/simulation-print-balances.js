const AslTokenSale = artifacts.require("./AslTokenSale.sol");
const AslToken = artifacts.require("./AslToken.sol");

const promisify = require("promisify-es6");

async function run() {
  let tokenSaleInstance = await AslTokenSale.deployed();
  let tokenInstance = AslToken.at(await tokenSaleInstance.token());

  const accounts = await promisify(web3.eth.getAccounts)();

  const WALLET_OWNER = accounts[0];
  const WALLET_VAULT = accounts[1];
  const WALLET_AIRDROP = accounts[2];
  const WALLET_KYC = accounts[3];

  const WALLET_INVESTOR_1 = accounts[4];
  const WALLET_INVESTOR_2 = accounts[5];
  const WALLET_INVESTOR_3 = accounts[6];

  let airdrop_wallet_balance = await tokenInstance.balanceOf(WALLET_AIRDROP);
  let inv_1_balance = await tokenInstance.balanceOf(WALLET_INVESTOR_1);
  let inv_2_balance = await tokenInstance.balanceOf(WALLET_INVESTOR_2);
  let inv_3_balance = await tokenInstance.balanceOf(WALLET_INVESTOR_3);

  console.log("Balances");
  console.log("WALLET_AIRDROP", airdrop_wallet_balance.div(10 ** 18).toNumber() );
  console.log("WALLET_INVESTOR_1", inv_1_balance.div(10 ** 18).toNumber() );
  console.log("WALLET_INVESTOR_2", inv_2_balance.div(10 ** 18).toNumber() );
  console.log("WALLET_INVESTOR_3", inv_3_balance.div(10 ** 18).toNumber() );
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