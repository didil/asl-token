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

  await tokenSaleInstance.reserveTokens(WALLET_INVESTOR_1, new web3.BigNumber(50 * (10 ** 6) * (10 ** 18)), { from: WALLET_OWNER });
  await tokenSaleInstance.reserveTokens(WALLET_INVESTOR_2, new web3.BigNumber(40 * (10 ** 6) * (10 ** 18)), { from: WALLET_OWNER });
  await tokenSaleInstance.reserveTokens(WALLET_INVESTOR_3, new web3.BigNumber(30 * (10 ** 6) * (10 ** 18)), { from: WALLET_OWNER });

  await tokenSaleInstance.startPreSale({ from: WALLET_OWNER });
  await tokenSaleInstance.startMainSale({ from: WALLET_OWNER });
  await tokenSaleInstance.finishContract({ from: WALLET_OWNER });
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