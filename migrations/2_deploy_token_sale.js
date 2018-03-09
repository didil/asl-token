const AslTokenSale = artifacts.require("./AslTokenSale.sol");


module.exports = function (deployer, network) {
  if (network === "development") {
    // don't deploy if running tests
    return true;
  }

  let vaultAddress = process.env.VAULT_ADDRESS;
  if (!vaultAddress) {
    throw new Error("Vault Address not set");
  }

  let maxTxGasPrice = 50 * 10 ** 9; // 50 GWei

  console.log("Using Vault Address:", vaultAddress);

  return deployer.deploy(AslTokenSale, vaultAddress, maxTxGasPrice);
};
