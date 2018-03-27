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

  let airdropAddress = process.env.AIRDROP_ADDRESS;
  if (!airdropAddress) {
    throw new Error("Airdrop Address not set");
  }
  console.log("Using Airdrop Address:", airdropAddress);

  let kycAddress = process.env.KYC_ADDRESS;
  if (!kycAddress) {
    throw new Error("KYC Address not set");
  }
  console.log("Using KYC Address:", kycAddress);

  let tokenBaseRate = parseInt(process.env.TOKEN_BASE_RATE, 10);
  if (!tokenBaseRate) {
    throw new Error("Token Base Rate not set");
  }
  console.log("Using Token Base Rate:", tokenBaseRate);

  let referralBonusRate = parseInt(process.env.REFERRAL_BONUS_RATE, 10);
  if (!referralBonusRate) {
    throw new Error("Referral Bonus Rate not set");
  }
  console.log("Using Referral Bonus Rate:", referralBonusRate);

  let maxTxGasPrice = 50 * 10 ** 9; // 50 GWei

  return deployer.deploy(AslTokenSale, vaultAddress, airdropAddress, kycAddress, tokenBaseRate, referralBonusRate, maxTxGasPrice);
};
