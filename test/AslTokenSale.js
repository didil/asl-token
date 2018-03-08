const EVMThrow = require("./support/EVMThrow");

const BigNumber = web3.BigNumber;
const should = require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const AslToken = artifacts.require("./AslToken.sol");
const AslTokenSale = artifacts.require("./AslTokenSale.sol");

const GIGA = new BigNumber(10).pow(9);
const MILLION = new BigNumber(10).pow(6);
const TO_WEI = new BigNumber(10).pow(18);
const TO_TOKEN_DECIMALS = new BigNumber(10).pow(18);
const ONE_ETH = new BigNumber(10).pow(18);
const ONE_WEI = new BigNumber(1);

// constants

const TOKEN_RATE_BASE_RATE = new BigNumber(2500);
const TOKEN_RATE_10_PERCENT_BONUS = new BigNumber(3125);
const TOKEN_RATE_15_PERCENT_BONUS = new BigNumber(3250);
const TOKEN_RATE_20_PERCENT_BONUS = new BigNumber(3500);

const MAX_TX_GAS_PRICE = new BigNumber(50).mul(GIGA);
const NEW_MAX_TX_GAS_PRICE = new BigNumber(100).mul(GIGA);

const PRE_SALE_WEI_MIN_TX = new BigNumber(1).mul(TO_WEI);
const SALE_WEI_MIN_TX = new BigNumber(0.1).mul(TO_WEI);

const PRE_SALE_TOKEN_CAP = new BigNumber(384).mul(MILLION).mul(TO_TOKEN_DECIMALS);
const TOKEN_SALE_TOKEN_CAP = new BigNumber(492).mul(MILLION).mul(TO_TOKEN_DECIMALS);


async function doBuy(tokenSaleInstance, acc, weiAmount, expectedRate) {
  const actualValue = weiAmount.truncated();

  const tokenInstance = AslToken.at(await tokenSaleInstance.token());

  const preUserTokenBalance = await tokenInstance.balanceOf(acc);
  const preUserWeiSpent = await tokenSaleInstance.userWeiSpent(acc);
  const preTokensSold = await tokenSaleInstance.tokensSold();
  const preTotalSupply = await tokenInstance.totalSupply();

  await tokenSaleInstance.sendTransaction({ value: actualValue, from: acc });

  const tokensBought = actualValue.mul(expectedRate);

  // check buyer balance is ok
  const postUserTokenBalance = await tokenInstance.balanceOf(acc);
  postUserTokenBalance.sub(preUserTokenBalance).should.be.bignumber.equal(tokensBought);

  // check wei spent
  const postUserWeiSpent = await tokenSaleInstance.userWeiSpent(acc);
  postUserWeiSpent.sub(preUserWeiSpent).should.be.bignumber.equal(weiAmount);

  // check total sold is ok
  const postTokensSold = await tokenSaleInstance.tokensSold();
  postTokensSold.sub(preTokensSold).should.be.bignumber.equal(tokensBought);

  // check total supply is ok
  const postTotalSupply = await tokenInstance.totalSupply();
  postTotalSupply.sub(preTotalSupply).should.be.bignumber.equal(tokensBought);

  return tokensBought;
}


contract('AslTokenSale', async function (accounts) {
  const WALLET_OWNER = accounts[0];
  const WALLET_KYCMANAGER = accounts[1];
  const WALLET_FUND = accounts[2];
  const WALLET_TEST = accounts[3];
  const WALLET_INVESTOR = accounts[4];
  const WALLET_INVESTOR2 = accounts[5];
  const WALLET_INVESTOR3 = accounts[6];
  const WALLET_INVESTOR4 = accounts[7];

  const value = PRE_SALE_WEI_MIN_TX;
  const expectedTokenAmount = TOKEN_RATE_10_PERCENT_BONUS.mul(value);

  let tokenSaleInstance;
  let tokenInstance;
  
  describe('Contract tests', function () {
    it('Should reject deploying the Token Sale contract with no fund wallet', async function () {
      await AslTokenSale.new(null, WALLET_TEST, MAX_TX_GAS_PRICE).should.be.rejectedWith(EVMThrow);
    });

    it('Should reject deploying the Token Sale contract with no KYC wallet', async function () {
      await AslTokenSale.new(WALLET_FUND, null, MAX_TX_GAS_PRICE).should.be.rejectedWith(EVMThrow);
    });

    it('Should reject deploying the Token Sale contract with no Max Tx Gas Price', async function () {
      await AslTokenSale.new(WALLET_FUND, WALLET_TEST, 0).should.be.rejectedWith(EVMThrow);
    });

    it('Should deploy the Token Sale contract', async function () {
      // deploy the wallet with test account as the KYC Manager,
      // as we're going to change it to the correct account later
      tokenSaleInstance = await AslTokenSale.new(WALLET_FUND, WALLET_TEST, MAX_TX_GAS_PRICE);
      tokenInstance = AslToken.at(await tokenSaleInstance.token());
    });

    it('Should reject calling finishContract() during period before sale', async function () {
      await tokenSaleInstance.finishContract({ from: WALLET_OWNER }).should.be.rejectedWith(EVMThrow);
    });

    it('Contract should not be on finished state', async function () {
      const hasEnded = await tokenSaleInstance.hasEnded();

      assert.equal(hasEnded, false, "Has Ended should be false");
    });

    it('Should be the owner of the contract', async function () {
      const owner = await tokenSaleInstance.owner();
      owner.should.equal(WALLET_OWNER);
    });

    it('Should await untill the start of the PreSale period', async function () {
      await tokenSaleInstance.startPreSale({ from: WALLET_OWNER });

      const isPreSaleRunning = await tokenSaleInstance.isPreSaleRunning();
      const isTokenSaleRunning = await tokenSaleInstance.isTokenSaleRunning();
      const isMainSaleRunning = await tokenSaleInstance.isMainSaleRunning();
      assert.equal(isPreSaleRunning, true, "Contract is not on PreSale state");
      assert.equal(isTokenSaleRunning, true, "Contract is not on TokenSaleRunning state");
      assert.equal(isMainSaleRunning, false, "Contract is on MainSaleRunning state");
    });

    it('Should reject calling finishContract() during presale period', async function () {
      await tokenSaleInstance.finishContract({ from: WALLET_OWNER }).should.be.rejectedWith(EVMThrow);
    });

    it('Token should be owned by the Token Sale', async function () {
      const tokensaleAddress = tokenSaleInstance.address;
      const owner = await tokenInstance.owner();

      assert.equal(owner, tokensaleAddress, "Owner of AslToken should be AslTokenSale");
    });

    it('Token should have mintingFinished be false', async function () {
      const mintingFinished = await tokenInstance.mintingFinished();

      assert.equal(mintingFinished, false, "AslToken should not have finished minting");
    });

    it('Should reject minting 1 Token from the fund wallet (or any other wallet)', async function () {
      await tokenInstance.mint(WALLET_INVESTOR, 1, { from: WALLET_FUND }).should.be.rejectedWith(EVMThrow);
    });

    it('Should reject invoking finish minting from the fund wallet (or any other wallet)', async function () {
      await tokenInstance.finishMinting({ from: WALLET_FUND }).should.be.rejectedWith(EVMThrow);
    });

    it('Should reject changing the KYC Manager to an empty wallet', async function () {
      await tokenSaleInstance.setKYCManager(new BigNumber(0), { from: WALLET_OWNER }).should.be.rejectedWith(EVMThrow);
    });

    it('Should change KYC Manager to correct wallet', async function () {
      const startKycManager = await tokenSaleInstance.kycManagerWallet();
      await tokenSaleInstance.setKYCManager(WALLET_KYCMANAGER, { from: WALLET_OWNER });
      const endKycManager = await tokenSaleInstance.kycManagerWallet();

      assert.equal(startKycManager, WALLET_TEST, "KYC Manager should start as test wallet");
      assert.equal(endKycManager, WALLET_KYCMANAGER, "KYC Manager should end as the KYC Manager wallet");
    });

    it('Should not approve KYC when executing from old KYC Manager (test wallet that was input on constructor)', async function () {
      await tokenSaleInstance.approveUserKYC(WALLET_INVESTOR, { from: WALLET_TEST }).should.be.rejectedWith(EVMThrow);
    });

    it('Should revert when invoking approveUserKYC with an empty wallet', async function () {
      await tokenSaleInstance.approveUserKYC(new BigNumber(0), { from: WALLET_KYCMANAGER }).should.be.rejectedWith(EVMThrow);
    });

    it('Should revert when invoking disapproveUserKYC with an empty wallet', async function () {
      await tokenSaleInstance.disapproveUserKYC(new BigNumber(0), { from: WALLET_KYCMANAGER }).should.be.rejectedWith(EVMThrow);
    });

    it('Should approve KYC of the investor wallet when executing from KYC Manager wallet', async function () {
      await tokenSaleInstance.approveUserKYC(WALLET_INVESTOR, { from: WALLET_KYCMANAGER });
      const userHasKyc = await tokenSaleInstance.userHasKYC(WALLET_INVESTOR);
      assert.equal(userHasKyc, true, "KYC has not been flagged");
    });

    it('Should approve KYC of the 2nd investor wallet and read the KYC logs', async function () {
      const { logs } = await tokenSaleInstance.approveUserKYC(WALLET_INVESTOR2, { from: WALLET_KYCMANAGER });
      const userHasKyc = await tokenSaleInstance.userHasKYC(WALLET_INVESTOR2);
      assert.equal(userHasKyc, true, "KYC has not been flagged");

      const event = logs.find(e => e.event === 'KYC');

      should.exist(event);
      event.args.user.should.equal(WALLET_INVESTOR2);
      event.args.isApproved.should.equal(true);
    });

    it('Should disapprove KYC of the 2nd investor wallet and read the KYC logs', async function () {
      const { logs } = await tokenSaleInstance.disapproveUserKYC(WALLET_INVESTOR2, { from: WALLET_KYCMANAGER });
      const userHasKyc = await tokenSaleInstance.userHasKYC(WALLET_INVESTOR2);
      assert.equal(userHasKyc, false, "KYC has not been disaproved");

      const event = logs.find(e => e.event === 'KYC');

      should.exist(event);
      event.args.user.should.equal(WALLET_INVESTOR2);
      event.args.isApproved.should.equal(false);
    });

    it('Should reject buying more than PreSale cap', async function () {
      const amount = PRE_SALE_TOKEN_CAP.div(TOKEN_RATE_20_PERCENT_BONUS).truncated().add(1);
      await tokenSaleInstance.sendTransaction({ value: amount, from: WALLET_INVESTOR }).should.be.rejectedWith(EVMThrow);
    });

    it('Should reject buying less than minimum during presale', async function () {
      const amount = PRE_SALE_WEI_MIN_TX.sub(1);
      
      await tokenSaleInstance.sendTransaction({ value: amount, from: WALLET_INVESTOR }).should.be.rejectedWith(EVMThrow);
    });

    it('Should pause the contract', async function () {
      await tokenSaleInstance.pause({ from: WALLET_OWNER }).should.be.fulfilled;
    });

    it('Should reject buying when contract is paused', async function () {
      await tokenSaleInstance.sendTransaction({ value: value, from: WALLET_INVESTOR }).should.be.rejectedWith(EVMThrow);
    });

    it('Should unpause the contract', async function () {
      await tokenSaleInstance.unpause({ from: WALLET_OWNER }).should.be.fulfilled;
    });

    it('Should log purchase', async function () {
      const { logs } = await tokenSaleInstance.sendTransaction({ value, from: WALLET_INVESTOR });

      const event = logs.find(e => e.event === 'TokenPurchase');

      should.exist(event);
      event.args.purchaser.should.equal(WALLET_INVESTOR);
      event.args.value.should.be.bignumber.equal(value);
      event.args.amount.should.be.bignumber.equal(expectedTokenAmount);
    });

    it('Should assign tokens to sender', async function () {
      var preBalance = await tokenInstance.balanceOf(WALLET_INVESTOR);
      await tokenSaleInstance.sendTransaction({ value: value, from: WALLET_INVESTOR });
      var postBalance = await tokenInstance.balanceOf(WALLET_INVESTOR);
      postBalance.sub(preBalance).should.be.bignumber.equal(expectedTokenAmount);
    });

    it('Should forward funds to wallet', async function () {
      const pre = web3.eth.getBalance(WALLET_FUND);
      await tokenSaleInstance.sendTransaction({ value: value, from: WALLET_INVESTOR });
      const post = web3.eth.getBalance(WALLET_FUND);
      post.minus(pre).should.be.bignumber.equal(value);
    });

    it('Should buy exactly the minimum', async function () {
      const userHasKyc = await tokenSaleInstance.userHasKYC(WALLET_INVESTOR);
      assert.equal(userHasKyc, true, "Investor should have KYC");

      const tokens = await doBuy(tokenSaleInstance, WALLET_INVESTOR, PRE_SALE_WEI_MIN_TX, TOKEN_RATE_10_PERCENT_BONUS);
    });

    it('Should reject buying from un-kyced wallet', async function () {
      const userHasKyc = await tokenSaleInstance.userHasKYC(WALLET_INVESTOR3);
      assert.equal(userHasKyc, false, "Investor 3 should not have KYC");

      await tokenSaleInstance.sendTransaction({
        value: PRE_SALE_WEI_MIN_TX,
        from: WALLET_INVESTOR3
      }).should.be.rejectedWith(EVMThrow);
    });

    it('Should buy 2 ETH worth of tokens at (PreSale 10% Bonus)', async function () {
      const tokens = await doBuy(tokenSaleInstance, WALLET_INVESTOR, new BigNumber(2).mul(TO_WEI), TOKEN_RATE_10_PERCENT_BONUS);
    });

    it('Should buy 60 ETH worth of tokens at (PreSale 15% Bonus)', async function () {
      const tokens = await doBuy(tokenSaleInstance, WALLET_INVESTOR, new BigNumber(60).mul(TO_WEI), TOKEN_RATE_15_PERCENT_BONUS);
    });

    it('Should buy 80 ETH worth of tokens at (PreSale 15% Bonus)', async function () {
      const tokens = await doBuy(tokenSaleInstance, WALLET_INVESTOR, new BigNumber(80).mul(TO_WEI), TOKEN_RATE_15_PERCENT_BONUS);
    });

    it('Should buy 300 ETH worth of tokens at PreSale (PreSale 20% Bonus)', async function () {
      const tokens = await doBuy(tokenSaleInstance, WALLET_INVESTOR, new BigNumber(300).mul(TO_WEI), TOKEN_RATE_20_PERCENT_BONUS);
    });

    it('Should buy 400 ETH worth of tokens at PreSale (PreSale 20% Bonus)', async function () {
      const tokens = await doBuy(tokenSaleInstance, WALLET_INVESTOR, new BigNumber(400).mul(TO_WEI), TOKEN_RATE_20_PERCENT_BONUS);
    });

    //
    // Main Sale
    //

    it('Should Start the Main Sale', async function () {
      await tokenSaleInstance.startMainSale({ from: WALLET_OWNER });

      const isPreSaleRunning = await tokenSaleInstance.isPreSaleRunning();
      assert.equal(isPreSaleRunning, false, "Contract should not be on PreSale state");

      const isMainSaleRunning = await tokenSaleInstance.isMainSaleRunning();
      assert.equal(isMainSaleRunning, true, "Contract should be on MainSale state");
    });

    it('Should reject buying Token Sale cap', async function () {
      const amount = TOKEN_SALE_TOKEN_CAP.div(TOKEN_RATE_BASE_RATE).truncated().add(1);
      await tokenSaleInstance.sendTransaction({ value: amount, from: WALLET_INVESTOR }).should.be.rejectedWith(EVMThrow);
    });

    it('Should reject buying less than the minimum during the crowd sale', async function () {
      await tokenSaleInstance.sendTransaction({
        value: SALE_WEI_MIN_TX.sub(1),
        from: WALLET_INVESTOR
      }).should.be.rejectedWith(EVMThrow);
    });

    it('Should pause the contract', async function () {
      await tokenSaleInstance.pause({ from: WALLET_OWNER }).should.be.fulfilled;
    });

    it('Should reject buying when contract is paused', async function () {
      await tokenSaleInstance.sendTransaction({
        value: SALE_WEI_MIN_TX,
        from: WALLET_INVESTOR
      }).should.be.rejectedWith(EVMThrow);
    });

    it('Should unpause the contract', async function () {
      await tokenSaleInstance.unpause({ from: WALLET_OWNER }).should.be.fulfilled;
    });

    it('Should accept buying exactly the minimum', async function () {
      await tokenSaleInstance.sendTransaction({ value: SALE_WEI_MIN_TX, from: WALLET_INVESTOR }).should.be.fulfilled;
    });

    it('Should accept transaction with max gas price (50 GWei)', async function () {
      await tokenSaleInstance.sendTransaction({
        value: SALE_WEI_MIN_TX,
        from: WALLET_INVESTOR,
        gasPrice: MAX_TX_GAS_PRICE
      }).should.be.fulfilled;
    });

    it('Should reject transaction with gas price above the maximum (' + MAX_TX_GAS_PRICE.add(1).div(GIGA).toString(10) + ' GWei)', async function () {
      await tokenSaleInstance.sendTransaction({
        value: SALE_WEI_MIN_TX,
        from: WALLET_INVESTOR,
        gasPrice: MAX_TX_GAS_PRICE.add(1)
      }).should.be.rejectedWith(EVMThrow);
    });

    it('Should reject changing the max tx gas price to 0 GWei', async function () {
      await tokenSaleInstance.updateMaxTxGas(0, { from: WALLET_KYCMANAGER }).should.be.rejectedWith(EVMThrow);
    });

    it('Should change the max tx gas price to 100 GWei', async function () {
      var startMaxTxGas = await tokenSaleInstance.maxTxGas();
      await tokenSaleInstance.updateMaxTxGas(NEW_MAX_TX_GAS_PRICE, { from: WALLET_KYCMANAGER });
      var endMaxTxGas = await tokenSaleInstance.maxTxGas();

      assert.equal(startMaxTxGas.toString(10), MAX_TX_GAS_PRICE.toString(10), "Start Gas should be 50 GWei");
      assert.equal(endMaxTxGas.toString(10), NEW_MAX_TX_GAS_PRICE.toString(10), "End Gas should be 100 GWei");
    });

    it('Should accept transaction with max gas price (100 GWei)', async function () {
      await tokenSaleInstance.sendTransaction({
        value: SALE_WEI_MIN_TX,
        from: WALLET_INVESTOR,
        gasPrice: NEW_MAX_TX_GAS_PRICE
      }).should.be.fulfilled;
    });

    it('Should reject transaction with gas price above the maximum (' + NEW_MAX_TX_GAS_PRICE.add(1).div(GIGA).toString(10) + ' GWei)', async function () {
      await tokenSaleInstance.sendTransaction({
        value: SALE_WEI_MIN_TX,
        from: WALLET_INVESTOR,
        gasPrice: NEW_MAX_TX_GAS_PRICE.add(1)
      }).should.be.rejectedWith(EVMThrow);
    });

    it('Should reject buying without KYC', async function () {
      const isKyc = await tokenSaleInstance.userHasKYC(WALLET_INVESTOR3);
      assert.equal(isKyc, false, "Investor 3 should not have KYC approved");

      await tokenSaleInstance.sendTransaction({
        value: SALE_WEI_MIN_TX,
        from: WALLET_INVESTOR3
      }).should.be.rejectedWith(EVMThrow);
    });

    it('Should buy 1 ETH worth of tokens', async function () {
      const tokens = await doBuy(tokenSaleInstance, WALLET_INVESTOR, ONE_ETH, TOKEN_RATE_BASE_RATE);
    });

    it('calling buyTokens directly also works', async function () {
      const preUserTokenBalance = await tokenInstance.balanceOf(WALLET_INVESTOR);

      await tokenSaleInstance.buyTokens({ value: ONE_ETH, from: WALLET_INVESTOR });

      const tokensBought = ONE_ETH.mul(TOKEN_RATE_BASE_RATE);

      // check buyer balance is ok
      const postUserTokenBalance = await tokenInstance.balanceOf(WALLET_INVESTOR);
      postUserTokenBalance.sub(preUserTokenBalance).should.be.bignumber.equal(tokensBought);
    });

    it('Contract should not be on finished state', async function () {
      const hasEnded = await tokenSaleInstance.hasEnded();

      assert.equal(hasEnded, false, "Has Ended should be false");
    });

    //
    // Finished
    //

    it('Should call finishContract', async function () {
      const tokensSold = await tokenSaleInstance.tokensSold();
      const notSoldTokens = TOKEN_SALE_TOKEN_CAP.sub(tokensSold).truncated();

      await tokenSaleInstance.finishContract({ from: WALLET_OWNER });

      // check balance of tokens on fund wallet, should have not sold tokens
      const owner = await tokenInstance.owner();
      const fundBalance = await tokenInstance.balanceOf(WALLET_FUND);

      assert.equal(fundBalance.toString(10), notSoldTokens.toString(10), "Fund wallet final balance is wrong");
      assert.equal(owner, WALLET_FUND, "Token should be owned by fund wallet after contract finish");
    });


    it('Contract should be on finished state', async function () {
      const hasEnded = await tokenSaleInstance.hasEnded();

      assert.equal(hasEnded, true, "Has Ended should be true");
    });

    it('Should reject calling finishContract() after already calling it', async function () {
      await tokenSaleInstance.finishContract({ from: WALLET_OWNER }).should.be.rejectedWith(EVMThrow);
    });

    it('Should reject buying after sale ends', async function () {
      await tokenSaleInstance.sendTransaction({
        value: new BigNumber(1),
        from: WALLET_INVESTOR
      }).should.be.rejectedWith(EVMThrow);
    });

    it('Should reject calling transfer with empty wallet', async function () {
      await tokenInstance.transfer(new BigNumber(0), new BigNumber(100).mul(TO_WEI), { from: WALLET_INVESTOR }).should.be.rejectedWith(EVMThrow);
    });

    it('Should reject calling transfer to Token contract', async function () {
      const tokenSaleAddress = await tokenSaleInstance.token();

      await tokenInstance.transfer(tokenSaleAddress, new BigNumber(100).mul(TO_WEI), { from: WALLET_INVESTOR }).should.be.rejectedWith(EVMThrow);
    });

    it('Should transfer 100 Token from Investor 1 to 2', async function () {
      await tokenInstance.transfer(WALLET_INVESTOR2, new BigNumber(100).mul(TO_WEI), { from: WALLET_INVESTOR }).should.be.fulfilled;
    });

    it('Should allow Investor 3 to transfer 100 Token from Investor 1', async function () {
      await tokenInstance.approve(WALLET_INVESTOR3, new BigNumber(100).mul(TO_WEI), { from: WALLET_INVESTOR }).should.be.fulfilled;
    });

    it('Should increase the allowed amount to be managed by Investor 3 by 70 Token', async function () {
      await tokenInstance.increaseApproval(WALLET_INVESTOR3, new BigNumber(70).mul(TO_WEI), { from: WALLET_INVESTOR }).should.be.fulfilled;
    });

    it('Should decreaseApproval the transfer to be managed by Investor 3 by 20 Token', async function () {
      await tokenInstance.decreaseApproval(WALLET_INVESTOR3, new BigNumber(20).mul(TO_WEI), { from: WALLET_INVESTOR }).should.be.fulfilled;
    });

    it('Should transferFrom the total approved value of 150 Token', async function () {
      const startBalance = await tokenInstance.balanceOf(WALLET_INVESTOR2);
      await tokenInstance.transferFrom(WALLET_INVESTOR, WALLET_INVESTOR2, new BigNumber(150).mul(TO_WEI), { from: WALLET_INVESTOR3 }).should.be.fulfilled;
      const endBalance = await tokenInstance.balanceOf(WALLET_INVESTOR2);
      endBalance.sub(startBalance).toString(10).should.equal(new BigNumber(150).mul(TO_WEI).toString(10));
    });

    it('Should reject minting 1 Token from the fund wallet (even though it owns the AslToken contract now)', async function () {
      await tokenInstance.mint(WALLET_INVESTOR, 1, { from: WALLET_FUND }).should.be.rejectedWith(EVMThrow);
    });
  });
});