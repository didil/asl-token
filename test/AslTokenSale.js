const EVMThrow = require("./support/EVMThrow");
let airdrop = require('../lib/airdrop');

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

// constants

const TOKEN_RATE_BASE_RATE = new BigNumber(10625);
const TOKEN_RATE_10_PERCENT_BONUS = TOKEN_RATE_BASE_RATE.mul(1.1);
const TOKEN_RATE_15_PERCENT_BONUS = TOKEN_RATE_BASE_RATE.mul(1.15);
const TOKEN_RATE_20_PERCENT_BONUS = TOKEN_RATE_BASE_RATE.mul(1.2);
const TOKEN_RATE_30_PERCENT_BONUS = TOKEN_RATE_BASE_RATE.mul(1.3);

const REFERRER_BONUS_RATE = new BigNumber(350);
const REFERRED_BONUS_RATE = new BigNumber(150);

const MAX_TX_GAS_PRICE = new BigNumber(50).mul(GIGA);
const NEW_MAX_TX_GAS_PRICE = new BigNumber(100).mul(GIGA);

const PRE_SALE_WEI_MIN_TX = new BigNumber(1).mul(TO_WEI);
const SALE_WEI_MIN_TX = new BigNumber(0.1).mul(TO_WEI);

const PRE_SALE_TOKEN_CAP = new BigNumber(384).mul(MILLION).mul(TO_TOKEN_DECIMALS);
const TOKEN_SALE_TOKEN_CAP = new BigNumber(492).mul(MILLION).mul(TO_TOKEN_DECIMALS);
const TOTAL_TOKENS_SUPPLY = new BigNumber(1200).mul(MILLION).mul(TO_TOKEN_DECIMALS);


contract('AslTokenSale', async function (accounts) {
  const WALLET_OWNER = accounts[0];
  const WALLET_VAULT = accounts[1];
  const WALLET_AIRDROP = accounts[2];
  const WALLET_KYC = accounts[3];

  const WALLET_INVESTOR_1 = accounts[4];
  const WALLET_INVESTOR_2 = accounts[5];
  const WALLET_INVESTOR_3 = accounts[6];
  const WALLET_INVESTOR_4 = accounts[7];
  const WALLET_INVESTOR_5 = accounts[8];
  const WALLET_INVESTOR_6 = accounts[9];

  let tokenSaleInstance;
  let tokenInstance;

  async function doBuy(tokenSaleInstance, acc, weiAmount, expectedRate, referrer) {
    const actualValue = weiAmount.truncated();

    const tokenInstance = AslToken.at(await tokenSaleInstance.token());

    const preUserTokenBalance = await tokenInstance.balanceOf(acc);
    const preFundBalance = web3.eth.getBalance(WALLET_VAULT);
    const preTokensSold = await tokenSaleInstance.tokensSold();
    const preTotalSupply = await tokenInstance.totalSupply();
    let preReferrerTokenBalance;
    if (referrer){
      preReferrerTokenBalance = await tokenInstance.balanceOf(referrer);
    }

    await tokenSaleInstance.sendTransaction({ value: actualValue, from: acc });

    const tokensBought = actualValue.mul(expectedRate);
    const tokensReferrerBonus = referrer ? tokensBought.mul(REFERRER_BONUS_RATE).div(10000) : new BigNumber(0);
    const tokensReferredBonus = referrer ? tokensBought.mul(REFERRED_BONUS_RATE).div(10000) : new BigNumber(0);

    // check buyer balance is ok
    const postUserTokenBalance = await tokenInstance.balanceOf(acc);
    postUserTokenBalance.sub(preUserTokenBalance).should.be.bignumber.equal(tokensBought.add(tokensReferredBonus));

    // check referrer balance
    if(referrer){
      let postReferrerTokenBalance  = await tokenInstance.balanceOf(referrer);
      postReferrerTokenBalance.sub(preReferrerTokenBalance).should.be.bignumber.equal(tokensReferrerBonus);
    }

    // check funds forwarded
    const postFundBalance = web3.eth.getBalance(WALLET_VAULT);
    postFundBalance.minus(preFundBalance).should.be.bignumber.equal(weiAmount);

    // check total sold is ok
    const postTokensSold = await tokenSaleInstance.tokensSold();
    postTokensSold.sub(preTokensSold).should.be.bignumber.equal(tokensBought.add(tokensReferrerBonus).add(tokensReferredBonus));

    // check total supply is ok
    const postTotalSupply = await tokenInstance.totalSupply();
    postTotalSupply.sub(preTotalSupply).should.be.bignumber.equal(tokensBought.add(tokensReferrerBonus).add(tokensReferredBonus));

    return tokensBought;
  }

  describe('Contract tests', function () {
    it('Should reject deploying the Token Sale contract with no vault wallet', async function () {
      await AslTokenSale.new(null, WALLET_AIRDROP, WALLET_KYC, TOKEN_RATE_BASE_RATE, REFERRER_BONUS_RATE,REFERRED_BONUS_RATE, MAX_TX_GAS_PRICE).should.be.rejectedWith(EVMThrow);
    });

    it('Should reject deploying the Token Sale contract with no airdrop wallet', async function () {
      await AslTokenSale.new(WALLET_VAULT, null, WALLET_KYC, TOKEN_RATE_BASE_RATE, REFERRER_BONUS_RATE,REFERRED_BONUS_RATE, MAX_TX_GAS_PRICE).should.be.rejectedWith(EVMThrow);
    });

    it('Should reject deploying the Token Sale contract with no kyc wallet', async function () {
      await AslTokenSale.new(WALLET_VAULT, WALLET_AIRDROP, null, TOKEN_RATE_BASE_RATE, REFERRER_BONUS_RATE,REFERRED_BONUS_RATE, MAX_TX_GAS_PRICE).should.be.rejectedWith(EVMThrow);
    });

    it('Should reject deploying the Token Sale contract with no base rate', async function () {
      await AslTokenSale.new(WALLET_VAULT, WALLET_AIRDROP, WALLET_KYC, 0, REFERRER_BONUS_RATE,REFERRED_BONUS_RATE, MAX_TX_GAS_PRICE).should.be.rejectedWith(EVMThrow);
    });

    it('Should reject deploying the Token Sale contract with no referrer bonus rate', async function () {
      await AslTokenSale.new(WALLET_VAULT, WALLET_AIRDROP, WALLET_KYC, TOKEN_RATE_BASE_RATE, 0,REFERRED_BONUS_RATE, MAX_TX_GAS_PRICE).should.be.rejectedWith(EVMThrow);
    });

    it('Should reject deploying the Token Sale contract with no referred bonus rate', async function () {
      await AslTokenSale.new(WALLET_VAULT, WALLET_AIRDROP, WALLET_KYC, TOKEN_RATE_BASE_RATE, REFERRER_BONUS_RATE,0, MAX_TX_GAS_PRICE).should.be.rejectedWith(EVMThrow);
    });

    it('Should reject deploying the Token Sale contract with no Max Tx Gas Price', async function () {
      await AslTokenSale.new(WALLET_VAULT, WALLET_AIRDROP, WALLET_KYC, TOKEN_RATE_BASE_RATE, REFERRER_BONUS_RATE,REFERRED_BONUS_RATE, 0).should.be.rejectedWith(EVMThrow);
    });

    it('Should deploy the Token Sale contract', async function () {
      tokenSaleInstance = await AslTokenSale.new(WALLET_VAULT, WALLET_AIRDROP, WALLET_KYC, TOKEN_RATE_BASE_RATE, REFERRER_BONUS_RATE,REFERRED_BONUS_RATE, MAX_TX_GAS_PRICE);
      tokenInstance = AslToken.at(await tokenSaleInstance.token());

      const owner = await tokenSaleInstance.owner();
      owner.should.equal(WALLET_OWNER);

      const vaultWallet = await tokenSaleInstance.vaultWallet();
      vaultWallet.should.equal(WALLET_VAULT);

      const airdropWallet = await tokenSaleInstance.airdropWallet();
      airdropWallet.should.equal(WALLET_AIRDROP);

      const tokenBaseRate = await tokenSaleInstance.tokenBaseRate();
      tokenBaseRate.should.be.bignumber.equal(TOKEN_RATE_BASE_RATE);

      const referrerBonusRate = await tokenSaleInstance.referrerBonusRate();
      referrerBonusRate.should.be.bignumber.equal(REFERRER_BONUS_RATE);
      
      const referredBonusRate = await tokenSaleInstance.referredBonusRate();
      referredBonusRate.should.be.bignumber.equal(REFERRED_BONUS_RATE);
    });

    //
    // Private Sale
    //

    it('Should have correct state after deploy', async function () {
      const isPrivateSaleRunning = await tokenSaleInstance.isPrivateSaleRunning();
      const isPreSaleRunning = await tokenSaleInstance.isPreSaleRunning();
      const isPublicTokenSaleRunning = await tokenSaleInstance.isPublicTokenSaleRunning();
      const isMainSaleRunning = await tokenSaleInstance.isMainSaleRunning();
      const hasEnded = await tokenSaleInstance.hasEnded();

      assert.equal(isPrivateSaleRunning, true, "Contract is not on Private state");
      assert.equal(isPreSaleRunning, false, "Contract is on PreSale state");
      assert.equal(isPublicTokenSaleRunning, false, "Contract is on PublicTokenSaleRunning state");
      assert.equal(isMainSaleRunning, false, "Contract is on MainSaleRunning state");
      assert.equal(hasEnded, false, "Has Ended should be false");
    });

    it('Should reject calling finishContract() before main sale', async function () {
      await tokenSaleInstance.finishContract({ from: WALLET_OWNER }).should.be.rejectedWith(EVMThrow);
    });

    it('Should not approve KYC when executing from unallowed walled', async function () {
      await tokenSaleInstance.approveUserKYC(WALLET_INVESTOR_1, { from: WALLET_INVESTOR_2 }).should.be.rejectedWith(EVMThrow);
    });

    it('Should revert when invoking approveUserKYC with a null wallet', async function () {
      await tokenSaleInstance.approveUserKYC(null, { from: WALLET_KYC }).should.be.rejectedWith(EVMThrow);
    });

    it('Should revert when invoking disapproveUserKYC with a null wallet', async function () {
      await tokenSaleInstance.disapproveUserKYC(null, { from: WALLET_KYC }).should.be.rejectedWith(EVMThrow);
    });

    it('Should approve KYC of investor 1', async function () {
      await tokenSaleInstance.approveUserKYC(WALLET_INVESTOR_1, { from: WALLET_KYC });
      const userHasKyc = await tokenSaleInstance.userHasKYC(WALLET_INVESTOR_1);
      assert.equal(userHasKyc, true, "KYC has not been flagged");
    });

    it('switch KYC wallet to owner and back', async function () {
      await tokenSaleInstance.updateKYCWallet(WALLET_OWNER, { from: WALLET_OWNER });
      let kycWallet = await tokenSaleInstance.kycWallet();
      assert.equal(kycWallet, WALLET_OWNER, "KYC not set properly");

      await tokenSaleInstance.updateKYCWallet(WALLET_KYC, { from: WALLET_OWNER });
      kycWallet = await tokenSaleInstance.kycWallet();
      assert.equal(kycWallet, WALLET_KYC, "KYC not set properly");
    });

    it('switch Vault wallet to owner and back', async function () {
      await tokenSaleInstance.updateVaultWallet(WALLET_OWNER, { from: WALLET_OWNER });
      let vaultWallet = await tokenSaleInstance.vaultWallet();
      assert.equal(vaultWallet, WALLET_OWNER, "Vault not set properly");

      await tokenSaleInstance.updateVaultWallet(WALLET_VAULT, { from: WALLET_OWNER });
      vaultWallet = await tokenSaleInstance.vaultWallet();
      assert.equal(vaultWallet, WALLET_VAULT, "Vault not set properly");
    });

    it('Should reject buying before presale', async function () {
      await tokenSaleInstance.sendTransaction({
        value: PRE_SALE_WEI_MIN_TX,
        from: WALLET_INVESTOR_1
      }).should.be.rejectedWith(EVMThrow);
    });

    it('Should reject reserving tokens from non-owner', async function () {
      let user = WALLET_INVESTOR_5;
      let amount = new BigNumber(5).mul(TO_TOKEN_DECIMALS); // 5 tokens
      await tokenSaleInstance.reserveTokens(user, amount, { from: WALLET_INVESTOR_1 }).should.be.rejectedWith(EVMThrow);
    });

    it('Should reserve tokens', async function () {
      let user = WALLET_INVESTOR_5;
      let amount = new BigNumber(7).mul(TO_TOKEN_DECIMALS);

      await tokenSaleInstance.reserveTokens(user, amount, { from: WALLET_OWNER });

      const userTokenBalance = await tokenInstance.balanceOf(user);
      userTokenBalance.should.be.bignumber.equal(0);

      const userReservedAmount = await tokenSaleInstance.getReservedAmount(user);
      userReservedAmount.should.be.bignumber.equal(amount);

      const tokensReserved = await tokenSaleInstance.tokensReserved();
      tokensReserved.should.be.bignumber.equal(amount);

      const tokensSold = await tokenSaleInstance.tokensSold();
      tokensSold.should.be.bignumber.equal(0);

      const postTotalSupply = await tokenInstance.totalSupply();
      postTotalSupply.should.be.bignumber.equal(0);
    });

    it('Should reserve additional tokens', async function () {
      let user = WALLET_INVESTOR_5;
      let amount = new BigNumber(2).mul(TO_TOKEN_DECIMALS);

      await tokenSaleInstance.reserveTokens(user, amount, { from: WALLET_OWNER });

      const userTokenBalance = await tokenInstance.balanceOf(user);
      userTokenBalance.should.be.bignumber.equal(0);

      const userReservedAmount = await tokenSaleInstance.getReservedAmount(user);
      userReservedAmount.should.be.bignumber.equal(new BigNumber(9).mul(TO_TOKEN_DECIMALS));

      const tokensReserved = await tokenSaleInstance.tokensReserved();
      tokensReserved.should.be.bignumber.equal(new BigNumber(9).mul(TO_TOKEN_DECIMALS));

      const tokensSold = await tokenSaleInstance.tokensSold();
      tokensSold.should.be.bignumber.equal(0);

      const postTotalSupply = await tokenInstance.totalSupply();
      postTotalSupply.should.be.bignumber.equal(0);
    });

    it('cannot cancel more than reserved', async function () {
      await tokenSaleInstance.cancelReservedTokens(WALLET_INVESTOR_5, new BigNumber(10).mul(TO_TOKEN_DECIMALS), { from: WALLET_OWNER }).should.be.rejectedWith(EVMThrow);
    });

    it('Should cancel tokens', async function () {
      let user = WALLET_INVESTOR_5;
      let amount = new BigNumber(1).mul(TO_TOKEN_DECIMALS);

      await tokenSaleInstance.cancelReservedTokens(user, amount, { from: WALLET_OWNER });

      const userTokenBalance = await tokenInstance.balanceOf(user);
      userTokenBalance.should.be.bignumber.equal(0);

      const userReservedAmount = await tokenSaleInstance.getReservedAmount(user);
      userReservedAmount.should.be.bignumber.equal(new BigNumber(8).mul(TO_TOKEN_DECIMALS));

      const tokensReserved = await tokenSaleInstance.tokensReserved();
      tokensReserved.should.be.bignumber.equal(new BigNumber(8).mul(TO_TOKEN_DECIMALS));

      const tokensSold = await tokenSaleInstance.tokensSold();
      tokensSold.should.be.bignumber.equal(0);

      const postTotalSupply = await tokenInstance.totalSupply();
      postTotalSupply.should.be.bignumber.equal(0);
    });

    it('cannot confirm more than reserved', async function () {
      await tokenSaleInstance.confirmReservedTokens(WALLET_INVESTOR_5, new BigNumber(10).mul(TO_TOKEN_DECIMALS), { from: WALLET_OWNER }).should.be.rejectedWith(EVMThrow);
    });

    it('Should confirm reservations', async function () {
      let user = WALLET_INVESTOR_5;
      let amount = new BigNumber(5).mul(TO_TOKEN_DECIMALS);

      await tokenSaleInstance.confirmReservedTokens(user, amount, { from: WALLET_OWNER });

      const userTokenBalance = await tokenInstance.balanceOf(user);
      userTokenBalance.should.be.bignumber.equal(new BigNumber(5).mul(TO_TOKEN_DECIMALS));

      const userReservedAmount = await tokenSaleInstance.getReservedAmount(user);
      userReservedAmount.should.be.bignumber.equal(new BigNumber(3).mul(TO_TOKEN_DECIMALS));

      const tokensReserved = await tokenSaleInstance.tokensReserved();
      tokensReserved.should.be.bignumber.equal(new BigNumber(3).mul(TO_TOKEN_DECIMALS));

      const tokensSold = await tokenSaleInstance.tokensSold();
      tokensSold.should.be.bignumber.equal(new BigNumber(5).mul(TO_TOKEN_DECIMALS));

      const postTotalSupply = await tokenInstance.totalSupply();
      postTotalSupply.should.be.bignumber.equal(new BigNumber(5).mul(TO_TOKEN_DECIMALS));
    });

    it('Should reject reserving more tokens than pre sale cap', async function () {
      let user = WALLET_INVESTOR_5;
      const tokensSold = await tokenSaleInstance.tokensSold();
      let amount = PRE_SALE_TOKEN_CAP.sub(tokensSold).add(1);

      await tokenSaleInstance.reserveTokens(user, amount, { from: WALLET_OWNER }).should.be.rejectedWith(EVMThrow);
    });

    //
    // Pre Sale
    //

    it('Should start the PreSale', async function () {
      await tokenSaleInstance.startPreSale({ from: WALLET_OWNER });

      const isPrivateSaleRunning = await tokenSaleInstance.isPrivateSaleRunning();
      const isPreSaleRunning = await tokenSaleInstance.isPreSaleRunning();
      const isPublicTokenSaleRunning = await tokenSaleInstance.isPublicTokenSaleRunning();
      const isMainSaleRunning = await tokenSaleInstance.isMainSaleRunning();
      const hasEnded = await tokenSaleInstance.hasEnded();

      assert.equal(isPrivateSaleRunning, false, "Contract is on Private state");
      assert.equal(isPreSaleRunning, true, "Contract is not on PreSale state");
      assert.equal(isPublicTokenSaleRunning, true, "Contract is not on PublicTokenSaleRunning state");
      assert.equal(isMainSaleRunning, false, "Contract is on MainSaleRunning state");
      assert.equal(hasEnded, false, "Has Ended should be false");
    });

    it('Should move back to private', async function () {
      await tokenSaleInstance.goBackToPrivateSale({ from: WALLET_OWNER });

      const isPrivateSaleRunning = await tokenSaleInstance.isPrivateSaleRunning();
      const isPreSaleRunning = await tokenSaleInstance.isPreSaleRunning();
      const isPublicTokenSaleRunning = await tokenSaleInstance.isPublicTokenSaleRunning();
      const isMainSaleRunning = await tokenSaleInstance.isMainSaleRunning();
      const hasEnded = await tokenSaleInstance.hasEnded();

      assert.equal(isPrivateSaleRunning, true, "Contract is not on Private state");
      assert.equal(isPreSaleRunning, false, "Contract is on PreSale state");
      assert.equal(isPublicTokenSaleRunning, false, "Contract is on PublicTokenSaleRunning state");
      assert.equal(isMainSaleRunning, false, "Contract is on MainSaleRunning state");
      assert.equal(hasEnded, false, "Has Ended should be false");
    });

    it('Should move again to PreSale', async function () {
      await tokenSaleInstance.startPreSale({ from: WALLET_OWNER });

      const isPrivateSaleRunning = await tokenSaleInstance.isPrivateSaleRunning();
      const isPreSaleRunning = await tokenSaleInstance.isPreSaleRunning();
      const isPublicTokenSaleRunning = await tokenSaleInstance.isPublicTokenSaleRunning();
      const isMainSaleRunning = await tokenSaleInstance.isMainSaleRunning();
      const hasEnded = await tokenSaleInstance.hasEnded();

      assert.equal(isPrivateSaleRunning, false, "Contract is on Private state");
      assert.equal(isPreSaleRunning, true, "Contract is not on PreSale state");
      assert.equal(isPublicTokenSaleRunning, true, "Contract is not on PublicTokenSaleRunning state");
      assert.equal(isMainSaleRunning, false, "Contract is on MainSaleRunning state");
      assert.equal(hasEnded, false, "Has Ended should be false");
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

    it('Should reject minting Tokens', async function () {
      await tokenInstance.mint(WALLET_INVESTOR_1, 1, { from: WALLET_VAULT }).should.be.rejectedWith(EVMThrow);
    });

    it('Should reject invoking finish minting from the fund wallet (or any other wallet)', async function () {
      await tokenInstance.finishMinting({ from: WALLET_VAULT }).should.be.rejectedWith(EVMThrow);
    });


    it('Should approve KYC of the 2nd investor wallet and read the KYC logs', async function () {
      const { logs } = await tokenSaleInstance.approveUserKYC(WALLET_INVESTOR_2, { from: WALLET_KYC });
      const userHasKyc = await tokenSaleInstance.userHasKYC(WALLET_INVESTOR_2);
      assert.equal(userHasKyc, true, "KYC has not been flagged");

      const event = logs.find(e => e.event === 'KYC');

      should.exist(event);
      event.args.user.should.equal(WALLET_INVESTOR_2);
      event.args.isApproved.should.equal(true);
    });

    it('Should disapprove KYC of the 2nd investor wallet and read the KYC logs', async function () {
      const { logs } = await tokenSaleInstance.disapproveUserKYC(WALLET_INVESTOR_2, { from: WALLET_KYC });
      const userHasKyc = await tokenSaleInstance.userHasKYC(WALLET_INVESTOR_2);
      assert.equal(userHasKyc, false, "KYC has not been disaproved");

      const event = logs.find(e => e.event === 'KYC');

      should.exist(event);
      event.args.user.should.equal(WALLET_INVESTOR_2);
      event.args.isApproved.should.equal(false);
    });

    it('Should reject buying less than minimum during presale', async function () {
      const amount = PRE_SALE_WEI_MIN_TX.sub(1);

      await tokenSaleInstance.sendTransaction({
        value: amount,
        from: WALLET_INVESTOR_1
      }).should.be.rejectedWith(EVMThrow);
    });

    it('Should pause the contract', async function () {
      await tokenSaleInstance.pause({ from: WALLET_OWNER }).should.be.fulfilled;
    });

    it('Should reject buying when contract is paused', async function () {
      await tokenSaleInstance.sendTransaction({
        value: PRE_SALE_WEI_MIN_TX,
        from: WALLET_INVESTOR_1
      }).should.be.rejectedWith(EVMThrow);
    });

    it('Should unpause the contract', async function () {
      await tokenSaleInstance.unpause({ from: WALLET_OWNER }).should.be.fulfilled;
    });

    it('Should log purchase', async function () {
      const { logs } = await tokenSaleInstance.sendTransaction({ value: PRE_SALE_WEI_MIN_TX, from: WALLET_INVESTOR_1 });

      const event = logs.find(e => e.event === 'TokenPurchase');

      should.exist(event);
      event.args.purchaser.should.equal(WALLET_INVESTOR_1);
      event.args.value.should.be.bignumber.equal(PRE_SALE_WEI_MIN_TX);

      const expectedTokenAmount = TOKEN_RATE_10_PERCENT_BONUS.mul(PRE_SALE_WEI_MIN_TX);
      event.args.amount.should.be.bignumber.equal(expectedTokenAmount);
    });

    it('Should assign tokens to sender', async function () {
      let preBalance = await tokenInstance.balanceOf(WALLET_INVESTOR_1);
      await tokenSaleInstance.sendTransaction({ value: PRE_SALE_WEI_MIN_TX, from: WALLET_INVESTOR_1 });
      let postBalance = await tokenInstance.balanceOf(WALLET_INVESTOR_1);

      const expectedTokenAmount = TOKEN_RATE_10_PERCENT_BONUS.mul(PRE_SALE_WEI_MIN_TX);
      postBalance.sub(preBalance).should.be.bignumber.equal(expectedTokenAmount);
    });

    it('Should buy exactly the minimum', async function () {
      const userHasKyc = await tokenSaleInstance.userHasKYC(WALLET_INVESTOR_1);
      assert.equal(userHasKyc, true, "Investor should have KYC");

      const tokens = await doBuy(tokenSaleInstance, WALLET_INVESTOR_1, PRE_SALE_WEI_MIN_TX, TOKEN_RATE_10_PERCENT_BONUS);
    });

    it('Should reject buying from un-kyced wallet', async function () {
      const userHasKyc = await tokenSaleInstance.userHasKYC(WALLET_INVESTOR_3);
      assert.equal(userHasKyc, false, "Investor 3 should not have KYC");

      await tokenSaleInstance.sendTransaction({
        value: PRE_SALE_WEI_MIN_TX,
        from: WALLET_INVESTOR_3
      }).should.be.rejectedWith(EVMThrow);
    });

    it('Should buy 2 ETH worth of tokens at (PreSale 10% Bonus)', async function () {
      const tokens = await doBuy(tokenSaleInstance, WALLET_INVESTOR_1, new BigNumber(2).mul(TO_WEI), TOKEN_RATE_10_PERCENT_BONUS);
    });

    it('Should buy 60 ETH worth of tokens at (PreSale 15% Bonus)', async function () {
      const tokens = await doBuy(tokenSaleInstance, WALLET_INVESTOR_1, new BigNumber(60).mul(TO_WEI), TOKEN_RATE_15_PERCENT_BONUS);
    });

    it('Should buy 80 ETH worth of tokens at (PreSale 15% Bonus)', async function () {
      const tokens = await doBuy(tokenSaleInstance, WALLET_INVESTOR_1, new BigNumber(80).mul(TO_WEI), TOKEN_RATE_15_PERCENT_BONUS);
    });

    it('Should buy 300 ETH worth of tokens at PreSale (PreSale 20% Bonus)', async function () {
      const tokens = await doBuy(tokenSaleInstance, WALLET_INVESTOR_1, new BigNumber(300).mul(TO_WEI), TOKEN_RATE_20_PERCENT_BONUS);
    });

    it('Should buy 400 ETH worth of tokens at PreSale (PreSale 20% Bonus)', async function () {
      const tokens = await doBuy(tokenSaleInstance, WALLET_INVESTOR_1, new BigNumber(400).mul(TO_WEI), TOKEN_RATE_20_PERCENT_BONUS);
    });

    it('Should buy 1200 ETH worth of tokens at PreSale (PreSale 30% Bonus)', async function () {
      const tokens = await doBuy(tokenSaleInstance, WALLET_INVESTOR_1, new BigNumber(1200).mul(TO_WEI), TOKEN_RATE_30_PERCENT_BONUS);
    });

    it('Should buy 1500 ETH worth of tokens at PreSale (PreSale 30% Bonus)', async function () {
      const tokens = await doBuy(tokenSaleInstance, WALLET_INVESTOR_1, new BigNumber(1500).mul(TO_WEI), TOKEN_RATE_30_PERCENT_BONUS);
    });

    it('Should reject buying more than PreSale cap', async function () {
      const tokensSold = await tokenSaleInstance.tokensSold();
      let amount = PRE_SALE_TOKEN_CAP.sub(tokensSold).div(TOKEN_RATE_20_PERCENT_BONUS).add(1).truncated();

      await tokenSaleInstance.sendTransaction({
        value: amount,
        from: WALLET_INVESTOR_1
      }).should.be.rejectedWith(EVMThrow);
    });

    //
    // Main Sale
    //

    it('Should Start the Main Sale', async function () {
      await tokenSaleInstance.startMainSale({ from: WALLET_OWNER });

      const isPrivateSaleRunning = await tokenSaleInstance.isPrivateSaleRunning();
      const isPreSaleRunning = await tokenSaleInstance.isPreSaleRunning();
      const isPublicTokenSaleRunning = await tokenSaleInstance.isPublicTokenSaleRunning();
      const isMainSaleRunning = await tokenSaleInstance.isMainSaleRunning();
      const hasEnded = await tokenSaleInstance.hasEnded();

      assert.equal(isPrivateSaleRunning, false, "Contract is on Private state");
      assert.equal(isPreSaleRunning, false, "Contract is on PreSale state");
      assert.equal(isPublicTokenSaleRunning, true, "Contract is not on PublicTokenSaleRunning state");
      assert.equal(isMainSaleRunning, true, "Contract is not on MainSaleRunning state");
      assert.equal(hasEnded, false, "Has Ended should be false");
    });

    it('Should move back to PreSale', async function () {
      await tokenSaleInstance.goBackToPreSale({ from: WALLET_OWNER });

      const isPrivateSaleRunning = await tokenSaleInstance.isPrivateSaleRunning();
      const isPreSaleRunning = await tokenSaleInstance.isPreSaleRunning();
      const isPublicTokenSaleRunning = await tokenSaleInstance.isPublicTokenSaleRunning();
      const isMainSaleRunning = await tokenSaleInstance.isMainSaleRunning();
      const hasEnded = await tokenSaleInstance.hasEnded();

      assert.equal(isPrivateSaleRunning, false, "Contract is on Private state");
      assert.equal(isPreSaleRunning, true, "Contract is not on PreSale state");
      assert.equal(isPublicTokenSaleRunning, true, "Contract is not on PublicTokenSaleRunning state");
      assert.equal(isMainSaleRunning, false, "Contract is on MainSaleRunning state");
      assert.equal(hasEnded, false, "Has Ended should be false");
    });

    it('Should move again to the Main Sale', async function () {
      await tokenSaleInstance.startMainSale({ from: WALLET_OWNER });

      const isPrivateSaleRunning = await tokenSaleInstance.isPrivateSaleRunning();
      const isPreSaleRunning = await tokenSaleInstance.isPreSaleRunning();
      const isPublicTokenSaleRunning = await tokenSaleInstance.isPublicTokenSaleRunning();
      const isMainSaleRunning = await tokenSaleInstance.isMainSaleRunning();
      const hasEnded = await tokenSaleInstance.hasEnded();

      assert.equal(isPrivateSaleRunning, false, "Contract is on Private state");
      assert.equal(isPreSaleRunning, false, "Contract is on PreSale state");
      assert.equal(isPublicTokenSaleRunning, true, "Contract is not on PublicTokenSaleRunning state");
      assert.equal(isMainSaleRunning, true, "Contract is not on MainSaleRunning state");
      assert.equal(hasEnded, false, "Has Ended should be false");
    });

    it('Should reject reserving tokens after presale ended', async function () {
      let user = WALLET_INVESTOR_5;
      let amount = new BigNumber(5).mul(TO_TOKEN_DECIMALS); // 5 tokens
      await tokenSaleInstance.reserveTokens(user, amount, { from: WALLET_OWNER }).should.be.rejectedWith(EVMThrow);
    });

    it('Should approve KYC of investor 4 and set referrer', async function () {
      await tokenSaleInstance.approveUserKYCAndSetReferrer(WALLET_INVESTOR_4, WALLET_INVESTOR_6, { from: WALLET_KYC });
      const userHasKyc = await tokenSaleInstance.userHasKYC(WALLET_INVESTOR_4);
      assert.equal(userHasKyc, true);

      const userReferrer = await tokenSaleInstance.getUserReferrer(WALLET_INVESTOR_4);
      assert.equal(userReferrer, WALLET_INVESTOR_6);
    });

    it('Should reject buying less than the minimum during the crowd sale', async function () {
      await tokenSaleInstance.sendTransaction({
        value: SALE_WEI_MIN_TX.sub(1),
        from: WALLET_INVESTOR_1
      }).should.be.rejectedWith(EVMThrow);
    });

    it('Should accept buying exactly the minimum', async function () {
      await tokenSaleInstance.sendTransaction({ value: SALE_WEI_MIN_TX, from: WALLET_INVESTOR_1 }).should.be.fulfilled;
    });

    it('Should pause the contract', async function () {
      await tokenSaleInstance.pause({ from: WALLET_OWNER }).should.be.fulfilled;
    });

    it('Should reject buying when contract is paused', async function () {
      await tokenSaleInstance.sendTransaction({
        value: SALE_WEI_MIN_TX,
        from: WALLET_INVESTOR_1
      }).should.be.rejectedWith(EVMThrow);
    });

    it('Should unpause the contract', async function () {
      await tokenSaleInstance.unpause({ from: WALLET_OWNER }).should.be.fulfilled;
    });

    it('Should accept transaction with max gas price', async function () {
      await tokenSaleInstance.sendTransaction({
        value: SALE_WEI_MIN_TX,
        from: WALLET_INVESTOR_1,
        gasPrice: MAX_TX_GAS_PRICE
      }).should.be.fulfilled;
    });

    it('Should reject transaction with gas price above the maximum', async function () {
      await tokenSaleInstance.sendTransaction({
        value: SALE_WEI_MIN_TX,
        from: WALLET_INVESTOR_1,
        gasPrice: MAX_TX_GAS_PRICE.add(1)
      }).should.be.rejectedWith(EVMThrow);
    });

    it('Should reject changing the max tx gas price to 0 GWei', async function () {
      await tokenSaleInstance.updateMaxTxGasPrice(0, { from: WALLET_OWNER }).should.be.rejectedWith(EVMThrow);
    });

    it('Should change the max tx gas price', async function () {
      let startMaxTxGas = await tokenSaleInstance.maxTxGasPrice();
      await tokenSaleInstance.updateMaxTxGasPrice(NEW_MAX_TX_GAS_PRICE, { from: WALLET_OWNER });
      let endMaxTxGas = await tokenSaleInstance.maxTxGasPrice();

      assert.equal(startMaxTxGas.toString(10), MAX_TX_GAS_PRICE.toString(10), "Start Gas should be 50 GWei");
      assert.equal(endMaxTxGas.toString(10), NEW_MAX_TX_GAS_PRICE.toString(10), "End Gas should be 100 GWei");
    });

    it('Should accept transaction with new max gas price', async function () {
      await tokenSaleInstance.sendTransaction({
        value: SALE_WEI_MIN_TX,
        from: WALLET_INVESTOR_1,
        gasPrice: NEW_MAX_TX_GAS_PRICE
      }).should.be.fulfilled;
    });

    it('Should reject transaction with gas price above the new maximum (', async function () {
      await tokenSaleInstance.sendTransaction({
        value: SALE_WEI_MIN_TX,
        from: WALLET_INVESTOR_1,
        gasPrice: NEW_MAX_TX_GAS_PRICE.add(1)
      }).should.be.rejectedWith(EVMThrow);
    });

    it('Should reject buying without KYC', async function () {
      const isKyc = await tokenSaleInstance.userHasKYC(WALLET_INVESTOR_3);
      assert.equal(isKyc, false, "Investor 3 should not have KYC approved");

      await tokenSaleInstance.sendTransaction({
        value: SALE_WEI_MIN_TX,
        from: WALLET_INVESTOR_3
      }).should.be.rejectedWith(EVMThrow);
    });

    it('Should buy 1 ETH worth of tokens', async function () {
      const tokens = await doBuy(tokenSaleInstance, WALLET_INVESTOR_1, ONE_ETH, TOKEN_RATE_BASE_RATE);
    });

    it('Should reject transfers until end of crowdsale', async function () {
      await tokenInstance.transfer(WALLET_INVESTOR_2, new BigNumber(100).mul(TO_WEI), { from: WALLET_INVESTOR_1 }).should.be.rejectedWith(EVMThrow);
    });

    it('calling buyTokens directly also works', async function () {
      const preUserTokenBalance = await tokenInstance.balanceOf(WALLET_INVESTOR_1);

      await tokenSaleInstance.buyTokens({ value: ONE_ETH, from: WALLET_INVESTOR_1 });

      const tokensBought = ONE_ETH.mul(TOKEN_RATE_BASE_RATE);

      // check buyer balance is ok
      const postUserTokenBalance = await tokenInstance.balanceOf(WALLET_INVESTOR_1);
      postUserTokenBalance.sub(preUserTokenBalance).should.be.bignumber.equal(tokensBought);
    });

    it('Should buy tokens for new investor (referral)', async function () {
      const tokens = await doBuy(tokenSaleInstance, WALLET_INVESTOR_4, new BigNumber(8).mul(ONE_ETH), TOKEN_RATE_BASE_RATE, WALLET_INVESTOR_6);
    });

    it('Should reject buying more than Token Sale cap', async function () {
      const tokensSold = await tokenSaleInstance.tokensSold();
      let amount = TOKEN_SALE_TOKEN_CAP.sub(tokensSold).div(TOKEN_RATE_BASE_RATE).add(1).truncated();

      await tokenSaleInstance.sendTransaction({
        value: amount,
        from: WALLET_INVESTOR_4
      }).should.be.rejectedWith(EVMThrow);
    });

    it('Contract should not be on finished state', async function () {
      const hasEnded = await tokenSaleInstance.hasEnded();

      assert.equal(hasEnded, false, "Has Ended should be false");
    });

    //
    // Finished
    //

    it('Should reject calling finishContract() with pending reservations', async function () {
      await tokenSaleInstance.finishContract({ from: WALLET_OWNER }).should.be.rejectedWith(EVMThrow);
    });

    it('Should call finishContract', async function () {
      // cancel pending reservation
      await tokenSaleInstance.cancelReservedTokens(WALLET_INVESTOR_5, new BigNumber(3).mul(TO_TOKEN_DECIMALS), { from: WALLET_OWNER });

      const tokensSold = await tokenSaleInstance.tokensSold();
      const unsoldTokens = TOKEN_SALE_TOKEN_CAP.sub(tokensSold).truncated();
      const companyReserveTokens = TOTAL_TOKENS_SUPPLY.sub(TOKEN_SALE_TOKEN_CAP);

      await tokenSaleInstance.finishContract({ from: WALLET_OWNER });

      const tokenContractOwner = await tokenInstance.owner();
      assert.equal(tokenContractOwner, WALLET_OWNER, "Token should be owned by owner wallet after contract finish");

      // check balance of tokens on airdrop wallet, should have unsold Tokens
      const airdropWalletBalance = await tokenInstance.balanceOf(WALLET_AIRDROP);
      assert.equal(airdropWalletBalance.toString(10), unsoldTokens.toString(10), "Airdrop wallet final balance is wrong");

      // check balance of tokens on vault wallet, should have Company Reserve Tokens
      const vaultBalance = await tokenInstance.balanceOf(WALLET_VAULT);
      assert.equal(vaultBalance.toString(10), companyReserveTokens.toString(10), "Vault wallet final balance is wrong");

      // check all supply has been minted
      const totalSupply = await tokenInstance.totalSupply();
      assert.equal(totalSupply.toString(10), TOTAL_TOKENS_SUPPLY.toString(10), "All token supply should have been minted");

      // check states
      const isPrivateSaleRunning = await tokenSaleInstance.isPrivateSaleRunning();
      const isPreSaleRunning = await tokenSaleInstance.isPreSaleRunning();
      const isPublicTokenSaleRunning = await tokenSaleInstance.isPublicTokenSaleRunning();
      const isMainSaleRunning = await tokenSaleInstance.isMainSaleRunning();
      const hasEnded = await tokenSaleInstance.hasEnded();

      assert.equal(isPrivateSaleRunning, false, "Contract is on Private state");
      assert.equal(isPreSaleRunning, false, "Contract is on PreSale state");
      assert.equal(isPublicTokenSaleRunning, false, "Contract is on PublicTokenSaleRunning state");
      assert.equal(isMainSaleRunning, false, "Contract is on MainSaleRunning state");
      assert.equal(hasEnded, true, "Has Ended should be true");
    });

    it('Should reject calling finishContract() after already calling it', async function () {
      await tokenSaleInstance.finishContract({ from: WALLET_OWNER }).should.be.rejectedWith(EVMThrow);
    });

    it('Should reject buying after sale ends', async function () {
      await tokenSaleInstance.sendTransaction({
        value: new BigNumber(1),
        from: WALLET_INVESTOR_1
      }).should.be.rejectedWith(EVMThrow);
    });

    it('Should reject reserving tokens after sale ends', async function () {
      let user = WALLET_INVESTOR_5;
      let amount = new BigNumber(5).mul(TO_TOKEN_DECIMALS); // 5 tokens
      await tokenSaleInstance.reserveTokens(user, amount, { from: WALLET_OWNER }).should.be.rejectedWith(EVMThrow);
    });

    it('Should reject calling transfer with empty wallet', async function () {
      await tokenInstance.transfer(new BigNumber(0), new BigNumber(100).mul(TO_WEI), { from: WALLET_INVESTOR_1 }).should.be.rejectedWith(EVMThrow);
    });

    it('Should reject calling transfer to Token contract', async function () {
      const tokenSaleAddress = await tokenSaleInstance.token();

      await tokenInstance.transfer(tokenSaleAddress, new BigNumber(100).mul(TO_WEI), { from: WALLET_INVESTOR_1 }).should.be.rejectedWith(EVMThrow);
    });

    it('Should transfer 100 Token from Investor 1 to 2', async function () {
      await tokenInstance.transfer(WALLET_INVESTOR_2, new BigNumber(100).mul(TO_WEI), { from: WALLET_INVESTOR_1 }).should.be.fulfilled;
    });

    it('Should allow Investor 3 to transfer 100 Token from Investor 1', async function () {
      await tokenInstance.approve(WALLET_INVESTOR_3, new BigNumber(100).mul(TO_WEI), { from: WALLET_INVESTOR_1 }).should.be.fulfilled;
    });

    it('Should increase the allowed amount to be managed by Investor 3 by 70 Token', async function () {
      await tokenInstance.increaseApproval(WALLET_INVESTOR_3, new BigNumber(70).mul(TO_WEI), { from: WALLET_INVESTOR_1 }).should.be.fulfilled;
    });

    it('Should decreaseApproval the transfer to be managed by Investor 3 by 20 Token', async function () {
      await tokenInstance.decreaseApproval(WALLET_INVESTOR_3, new BigNumber(20).mul(TO_WEI), { from: WALLET_INVESTOR_1 }).should.be.fulfilled;
    });

    it('Should transferFrom the total approved value of 150 Token', async function () {
      const startBalance = await tokenInstance.balanceOf(WALLET_INVESTOR_2);
      await tokenInstance.transferFrom(WALLET_INVESTOR_1, WALLET_INVESTOR_2, new BigNumber(150).mul(TO_WEI), { from: WALLET_INVESTOR_3 }).should.be.fulfilled;
      const endBalance = await tokenInstance.balanceOf(WALLET_INVESTOR_2);
      endBalance.sub(startBalance).toString(10).should.equal(new BigNumber(150).mul(TO_WEI).toString(10));
    });

    it('Should reject minting 1 Token from the vault wallet (even though it owns the AslToken contract now)', async function () {
      await tokenInstance.mint(WALLET_INVESTOR_1, 1, { from: WALLET_VAULT }).should.be.rejectedWith(EVMThrow);
    });

  });

  describe('Airdrop', function () {
    let ownerAddresses, balances, airdropAmounts;
    let initial_inv_1_balance, initial_inv_2_balance, initial_inv_4_balance, initial_inv_5_balance;
    let final_inv_1_balance, final_inv_2_balance, final_inv_4_balance, final_inv_5_balance;
    let initialAirdropWalletBalance;

    it('Should give the correct list of token owners', async function () {
      ownerAddresses = await airdrop.getFilteredOwnerAddresses(tokenSaleInstance, tokenInstance);

      ownerAddresses.sort().should.deep.equal([WALLET_INVESTOR_1, WALLET_INVESTOR_2, WALLET_INVESTOR_4, WALLET_INVESTOR_5, WALLET_INVESTOR_6].sort());
    });

    it('Should give the correct balances', async function () {
      balances = await airdrop.getBalances(tokenInstance, ownerAddresses);

      Object.keys(balances).length.should.equal(5);

      initial_inv_1_balance = await tokenInstance.balanceOf(WALLET_INVESTOR_1);
      balances[WALLET_INVESTOR_1].should.be.bignumber.equal(initial_inv_1_balance);

      initial_inv_2_balance = await tokenInstance.balanceOf(WALLET_INVESTOR_2);
      balances[WALLET_INVESTOR_2].should.be.bignumber.equal(initial_inv_2_balance);

      initial_inv_4_balance = await tokenInstance.balanceOf(WALLET_INVESTOR_4);
      balances[WALLET_INVESTOR_4].should.be.bignumber.equal(initial_inv_4_balance);

      initial_inv_5_balance = await tokenInstance.balanceOf(WALLET_INVESTOR_5);
      balances[WALLET_INVESTOR_5].should.be.bignumber.equal(initial_inv_5_balance);

      initial_inv_6_balance = await tokenInstance.balanceOf(WALLET_INVESTOR_6);
      balances[WALLET_INVESTOR_6].should.be.bignumber.equal(initial_inv_6_balance);
    });

    it('Should give the correct airdrop amounts', async function () {
      initialAirdropWalletBalance = await tokenInstance.balanceOf(WALLET_AIRDROP);
      let tokensSold = await tokenSaleInstance.tokensSold();

      airdropAmounts = await airdrop.calculateAirDropAmounts(tokenSaleInstance, tokenInstance, balances);

      Object.keys(airdropAmounts).length.should.equal(5);

      // check new balances
      airdropAmounts[WALLET_INVESTOR_1].target.toNumber().should.equal(initial_inv_1_balance.div(tokensSold).mul(initialAirdropWalletBalance).truncated().toNumber());
      airdropAmounts[WALLET_INVESTOR_2].target.toNumber().should.equal(initial_inv_2_balance.div(tokensSold).mul(initialAirdropWalletBalance).truncated().toNumber());
      airdropAmounts[WALLET_INVESTOR_4].target.toNumber().should.equal(initial_inv_4_balance.div(tokensSold).mul(initialAirdropWalletBalance).truncated().toNumber());
      airdropAmounts[WALLET_INVESTOR_5].target.toNumber().should.equal(initial_inv_5_balance.div(tokensSold).mul(initialAirdropWalletBalance).truncated().toNumber());
      airdropAmounts[WALLET_INVESTOR_6].target.toNumber().should.equal(initial_inv_6_balance.div(tokensSold).mul(initialAirdropWalletBalance).truncated().toNumber());

      // check totals almost equal (rounding issues, check we're ok to 99.9 % precision)
      airdropAmounts[WALLET_INVESTOR_1].target
        .add(airdropAmounts[WALLET_INVESTOR_2].target)
        .add(airdropAmounts[WALLET_INVESTOR_4].target)
        .add(airdropAmounts[WALLET_INVESTOR_5].target)
        .add(airdropAmounts[WALLET_INVESTOR_6].target)
        .sub(initialAirdropWalletBalance)
        .div(initialAirdropWalletBalance).toNumber().should.be.below(0.001);
    });

    it('Should give the same results via getAirDropAmounts', async function () {
      let _airdropAmounts = await airdrop.getAirDropAmounts(web3, tokenSaleInstance, tokenInstance);

      (_airdropAmounts).should.deep.equal(airdropAmounts);
    });

    it('Should send the airdrop amounts', async function () {
      await airdrop.distribute(web3, tokenSaleInstance, tokenInstance, airdropAmounts, 5 * 10 ** 9);

      final_inv_1_balance = await tokenInstance.balanceOf(WALLET_INVESTOR_1);
      final_inv_1_balance.should.be.bignumber.equal(initial_inv_1_balance.add(airdropAmounts[WALLET_INVESTOR_1].target));

      final_inv_2_balance = await tokenInstance.balanceOf(WALLET_INVESTOR_2);
      final_inv_2_balance.should.be.bignumber.equal(initial_inv_2_balance.add(airdropAmounts[WALLET_INVESTOR_2].target));

      final_inv_4_balance = await tokenInstance.balanceOf(WALLET_INVESTOR_4);
      final_inv_4_balance.should.be.bignumber.equal(initial_inv_4_balance.add(airdropAmounts[WALLET_INVESTOR_4].target));

      final_inv_5_balance = await tokenInstance.balanceOf(WALLET_INVESTOR_5);
      final_inv_5_balance.should.be.bignumber.equal(initial_inv_5_balance.add(airdropAmounts[WALLET_INVESTOR_5].target));

      final_inv_6_balance = await tokenInstance.balanceOf(WALLET_INVESTOR_6);
      final_inv_6_balance.should.be.bignumber.equal(initial_inv_6_balance.add(airdropAmounts[WALLET_INVESTOR_6].target));

      let finalAirdropBalance = await tokenInstance.balanceOf(WALLET_AIRDROP);

      // check all airdrop distributed (rounding issues, check we're ok to 99.9 % precision)
      finalAirdropBalance
        .div(initialAirdropWalletBalance).toNumber().should.be.below(0.001);

      // check amount distributed makes sense
      initialAirdropWalletBalance
        .sub(finalAirdropBalance)
        .sub(final_inv_1_balance.sub(initial_inv_1_balance))
        .sub(final_inv_2_balance.sub(initial_inv_2_balance))
        .sub(final_inv_4_balance.sub(initial_inv_4_balance))
        .sub(final_inv_5_balance.sub(initial_inv_5_balance))
        .sub(final_inv_6_balance.sub(initial_inv_6_balance))
        .toNumber().should.equal(0);
    });


  });

});