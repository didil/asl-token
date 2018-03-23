const promisify = require("promisify-es6");


async function checkWallet(web3, tokenSaleInstance, tokenInstance) {
  const airdropWallet = await tokenSaleInstance.airdropWallet();

  const accounts = await promisify(web3.eth.getAccounts)();
  if (!accounts.includes(airdropWallet)) {
    throw new Error("the airdrop wallet must be one of the unlocked accounts on the ethereum node");
  }

  const airdropWalletBalance = await tokenInstance.balanceOf(airdropWallet);

  if (airdropWalletBalance.toNumber() === 0) {
    throw new Error("No Tokens to distribute, airdrop wallet balance is 0");
  }
}

function getOwnerAddresses(tokenInstance) {
  return new Promise((resolve, reject) => {
    let fromBlock = 0;
    let toBlock = 'latest';
    let ownerAddresses = [];

    // Pagination might be needed if over 1000 transactions ...
    let transferEvent = tokenInstance.Transfer({}, { fromBlock, toBlock });
    transferEvent.get((err, logs) => {
      if (err) {
        return reject(err);
      }

      let transferToAddresses = [];
      for (let i = 0; i < logs.length; i++) {
        let log = logs[i];
        transferToAddresses.push(log.args.to);
      }

      ownerAddresses = _.uniq(ownerAddresses.concat(transferToAddresses));

      resolve(ownerAddresses);
    });
  });
}

async function getFilteredOwnerAddresses(tokenSaleInstance, tokenInstance) {
  const airdropWallet = await tokenSaleInstance.airdropWallet();
  const vaultWallet = await tokenSaleInstance.vaultWallet();

  let ownerAddresses = await getOwnerAddresses(tokenInstance);

  return _.filter(ownerAddresses, (address) => address !== vaultWallet && address !== airdropWallet);
}

async function getBalances(tokenInstance, ownerAddresses) {
  let balances = {};
  for (let i = 0; i < ownerAddresses.length; i++) {
    let ownerAddress = ownerAddresses[i];

    let balance = await tokenInstance.balanceOf(ownerAddress);
    if (balance.toNumber() > 0) {
      balances[ownerAddress] = balance;
    }
  }
  return balances;
}

async function calculateAirDropAmounts(tokenSaleInstance, tokenInstance, balances) {
  const airdropWallet = await tokenSaleInstance.airdropWallet();
  let airdropWalletBalance = await tokenInstance.balanceOf(airdropWallet);
  let tokensSold = await tokenSaleInstance.tokensSold();

  console.log("Tokens Sold", tokensSold.div(10 ** 18).toNumber());
  console.log("Airdrop Wallet Balance", airdropWalletBalance.div(10 ** 18).toNumber());

  let addresses = Object.keys(balances);

  let airdropAmounts = {};

  for (let i = 0; i < addresses.length; i++) {
    let address = addresses[i];
    airdropAmounts[address] = {
      target: balances[address].div(tokensSold).mul(airdropWalletBalance).truncated(),
      actual: 0
    };
  }

  return airdropAmounts;
}

async function getAirDropAmounts(web3, tokenSaleInstance, tokenInstance) {
  await checkWallet(web3, tokenSaleInstance, tokenInstance);

  let ownerAddresses = await getFilteredOwnerAddresses(tokenSaleInstance, tokenInstance);

  let balances = await getBalances(tokenInstance, ownerAddresses);

  let airdropAmounts = await calculateAirDropAmounts(tokenSaleInstance, tokenInstance, balances);

  return airdropAmounts;
}

async function distribute(web3, tokenSaleInstance, tokenInstance, airdropAmounts, gasPrice, notify) {
  await checkWallet(web3, tokenSaleInstance, tokenInstance);

  const airdropWallet = await tokenSaleInstance.airdropWallet();

  let addresses = Object.keys(airdropAmounts);

  for (let i = 0; i < addresses.length; i++) {
    let address = addresses[i];

    let amountToTransfer = new web3.BigNumber(airdropAmounts[address].target); // initialize BigNumber in case target is a string (due to serialization)

    // skip address if transfer already done
    if (amountToTransfer.equals(new web3.BigNumber(airdropAmounts[address].actual))) {
      continue;
    }

    console.log("Transferring", amountToTransfer.div(10 ** 18).toNumber(), "Tokens to", address);

    await tokenInstance.transfer(address, amountToTransfer, {
      from: airdropWallet,
      gasPrice
    });

    // update actual amount transferred
    airdropAmounts[address].actual = amountToTransfer;

    if (notify) {
      // allow caller to save checkpoints at each transfer in case of failure
      notify(airdropAmounts);
    }
  }
}

module.exports = {
  getFilteredOwnerAddresses,
  getBalances,
  calculateAirDropAmounts,
  getAirDropAmounts,
  distribute
};