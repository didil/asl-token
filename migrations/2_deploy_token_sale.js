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
  console.log("Using Vault Address:", vaultAddress);

  let kycAddress = process.env.KYC_ADDRESS;
  if (!kycAddress) {
    throw new Error("KYC Address not set");
  }
  console.log("Using KYC Address:", kycAddress);

  let maxTxGasPrice = 50 * 10 ** 9; // 50 GWei

  return deployer.deploy(AslTokenSale, vaultAddress, kycAddress, maxTxGasPrice);
};
