const AslTokenSale = artifacts.require("./AslTokenSale.sol");
const AslToken = artifacts.require("./AslToken.sol");

const promisify = require("promisify-es6");
const _ = require("lodash");

function getExternalSupporterAddresses(tokenSaleInstance) {
  return new Promise((resolve, reject) => {
    let fromBlock = 0;
    let toBlock = 'latest';
    let externalSupporterAddresses = [];

    // Pagination might be needed if over 1000 transactions ...
    let event = tokenSaleInstance.TokenReservation({}, { fromBlock, toBlock });
    event.get((err, logs) => {
      if (err) {
        return reject(err);
      }

      let addresses = [];
      for (let i = 0; i < logs.length; i++) {
        let log = logs[i];
        addresses.push(log.args.wallet);
      }

      externalSupporterAddresses = _.uniq(externalSupporterAddresses.concat(addresses));

      resolve(externalSupporterAddresses);
    });
  });
}

async function run() {
  let tokenSaleInstance = await AslTokenSale.deployed();
  let tokenInstance = AslToken.at(await tokenSaleInstance.token());

  const tokensReserved = await tokenSaleInstance.tokensReserved();

  const tokensReservedNumber = tokensReserved.div(10 ** 18).toNumber();
  console.log("Total Tokens Reserved:", tokensReservedNumber);

  if (tokensReservedNumber > 0) {
    let externalSupporterAddresses = await getExternalSupporterAddresses(tokenSaleInstance);

    for (let i = 0; i < externalSupporterAddresses.length; i++) {
      let address = externalSupporterAddresses[i];

      const userReservedAmount = await tokenSaleInstance.getReservedAmount(address);
      if (userReservedAmount.toNumber() > 0) {
        console.log(address, "pending reserved amount:", userReservedAmount.div(10 ** 18).toNumber());
      }
    }
  }

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