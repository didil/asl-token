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

// constants

const TOKEN_RATE_BASE_RATE = new BigNumber(10625);
const TOKEN_RATE_10_PERCENT_BONUS = TOKEN_RATE_BASE_RATE.mul(1.1);
const TOKEN_RATE_15_PERCENT_BONUS = TOKEN_RATE_BASE_RATE.mul(1.15);
const TOKEN_RATE_20_PERCENT_BONUS = TOKEN_RATE_BASE_RATE.mul(1.2);
const TOKEN_RATE_30_PERCENT_BONUS = TOKEN_RATE_BASE_RATE.mul(1.3);

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
  
  const WALLET_INVESTOR_1 = accounts[2];
  const WALLET_INVESTOR_2 = accounts[3];
  const WALLET_INVESTOR_3 = accounts[4];
  const WALLET_INVESTOR_4 = accounts[5];
  const WALLET_INVESTOR_5 = accounts[6];

  let tokenSaleInstance;
  let tokenInstance;

  async function doBuy(tokenSaleInstance, acc, weiAmount, expectedRate) {
    const actualValue = weiAmount.truncated();

    const tokenInstance = AslToken.at(await tokenSaleInstance.token());

    const preUserTokenBalance = await tokenInstance.balanceOf(acc);
    const preUserWeiSpent = await tokenSaleInstance.userWeiSpent(acc);
    const preFundBalance = web3.eth.getBalance(WALLET_VAULT);
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

    // check funds forwarded
    const postFundBalance = web3.eth.getBalance(WALLET_VAULT);
    postFundBalance.minus(preFundBalance).should.be.bignumber.equal(weiAmount);

    // check total sold is ok
    const postTokensSold = await tokenSaleInstance.tokensSold();
    postTokensSold.sub(preTokensSold).should.be.bignumber.equal(tokensBought);

    // check total supply is ok
    const postTotalSupply = await tokenInstance.totalSupply();
    postTotalSupply.sub(preTotalSupply).should.be.bignumber.equal(tokensBought);

    return tokensBought;
  }

  describe('Contract tests', function () {
    it('Should reject deploying the Token Sale contract with no vault wallet', async function () {
      await AslTokenSale.new(null, MAX_TX_GAS_PRICE).should.be.rejectedWith(EVMThrow);
    });

    it('Should reject deploying the Token Sale contract with no Max Tx Gas Price', async function () {
      await AslTokenSale.new(WALLET_VAULT,  0).should.be.rejectedWith(EVMThrow);
    });

    it('Should deploy the Token Sale contract', async function () {
      tokenSaleInstance = await AslTokenSale.new(WALLET_VAULT,  MAX_TX_GAS_PRICE);
      tokenInstance = AslToken.at(await tokenSaleInstance.token());

      const owner = await tokenSaleInstance.owner();
      owner.should.equal(WALLET_OWNER);

      const vaultWallet = await tokenSaleInstance.vaultWallet();
      vaultWallet.should.equal(WALLET_VAULT);
    });

    //
    // Private Sale
    //

    it('Should have correct state after deploy', async function () {
      const isPrivateSaleRunning = await tokenSaleInstance.isPrivateSaleRunning();
      const isPreSaleRunning = await tokenSaleInstance.isPreSaleRunning();
      const isTokenSaleRunning = await tokenSaleInstance.isTokenSaleRunning();
      const isMainSaleRunning = await tokenSaleInstance.isMainSaleRunning();
      const hasEnded = await tokenSaleInstance.hasEnded();

      assert.equal(isPrivateSaleRunning, true, "Contract is not on Private state");
      assert.equal(isPreSaleRunning, false, "Contract is on PreSale state");
      assert.equal(isTokenSaleRunning, false, "Contract is on TokenSaleRunning state");
      assert.equal(isMainSaleRunning, false, "Contract is on MainSaleRunning state");
      assert.equal(hasEnded, false, "Has Ended should be false");
    });

    it('Should reject calling finishContract() before main sale', async function () {
      await tokenSaleInstance.finishContract({ from: WALLET_OWNER }).should.be.rejectedWith(EVMThrow);
    });
    
    it('Should not approve KYC when executing from non-owner', async function () {
      await tokenSaleInstance.approveUserKYC(WALLET_INVESTOR_1, { from: WALLET_INVESTOR_2 }).should.be.rejectedWith(EVMThrow);
    });

    it('Should revert when invoking approveUserKYC with an empty wallet', async function () {
      await tokenSaleInstance.approveUserKYC(new BigNumber(0), { from: WALLET_OWNER }).should.be.rejectedWith(EVMThrow);
    });

    it('Should revert when invoking disapproveUserKYC with an empty wallet', async function () {
      await tokenSaleInstance.disapproveUserKYC(new BigNumber(0), { from: WALLET_OWNER }).should.be.rejectedWith(EVMThrow);
    });

    it('Should approve KYC of investor 1', async function () {
      await tokenSaleInstance.approveUserKYC(WALLET_INVESTOR_1, { from: WALLET_OWNER });
      const userHasKyc = await tokenSaleInstance.userHasKYC(WALLET_INVESTOR_1);
      assert.equal(userHasKyc, true, "KYC has not been flagged");
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
      await tokenSaleInstance.reserveTokens(amount, user, { from: WALLET_INVESTOR_1 }).should.be.rejectedWith(EVMThrow);
    });

    it('Should reserve tokens', async function () {
      let user = WALLET_INVESTOR_5;
      let amount = new BigNumber(5).mul(TO_TOKEN_DECIMALS); // 5 tokens

      await tokenSaleInstance.reserveTokens(amount, user, { from: WALLET_OWNER });

      const userTokenBalance = await tokenInstance.balanceOf(user);
      userTokenBalance.should.be.bignumber.equal(amount);

      const userWeiSpent = await tokenSaleInstance.userWeiSpent(user);
      userWeiSpent.toNumber().should.eq(0);

      const tokensSold = await tokenSaleInstance.tokensSold();
      tokensSold.should.be.bignumber.equal(amount);

      const postTotalSupply = await tokenInstance.totalSupply();
      postTotalSupply.should.be.bignumber.equal(amount);
    });

    it('Should reject reserving more tokens than pre sale cap', async function () {
      let user = WALLET_INVESTOR_5;
      const tokensSold = await tokenSaleInstance.tokensSold();
      let amount = PRE_SALE_TOKEN_CAP.sub(tokensSold).add(1);

      await tokenSaleInstance.reserveTokens(amount, user, { from: WALLET_OWNER }).should.be.rejectedWith(EVMThrow);
    });

    //
    // Pre Sale
    //

    it('Should start the PreSale', async function () {
      await tokenSaleInstance.startPreSale({ from: WALLET_OWNER });

      const isPrivateSaleRunning = await tokenSaleInstance.isPrivateSaleRunning();
      const isPreSaleRunning = await tokenSaleInstance.isPreSaleRunning();
      const isTokenSaleRunning = await tokenSaleInstance.isTokenSaleRunning();
      const isMainSaleRunning = await tokenSaleInstance.isMainSaleRunning();
      const hasEnded = await tokenSaleInstance.hasEnded();

      assert.equal(isPrivateSaleRunning, false, "Contract is on Private state");
      assert.equal(isPreSaleRunning, true, "Contract is not on PreSale state");
      assert.equal(isTokenSaleRunning, true, "Contract is not on TokenSaleRunning state");
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
      const { logs } = await tokenSaleInstance.approveUserKYC(WALLET_INVESTOR_2, { from: WALLET_OWNER });
      const userHasKyc = await tokenSaleInstance.userHasKYC(WALLET_INVESTOR_2);
      assert.equal(userHasKyc, true, "KYC has not been flagged");

      const event = logs.find(e => e.event === 'KYC');

      should.exist(event);
      event.args.user.should.equal(WALLET_INVESTOR_2);
      event.args.isApproved.should.equal(true);
    });

    it('Should disapprove KYC of the 2nd investor wallet and read the KYC logs', async function () {
      const { logs } = await tokenSaleInstance.disapproveUserKYC(WALLET_INVESTOR_2, { from: WALLET_OWNER });
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
      const isTokenSaleRunning = await tokenSaleInstance.isTokenSaleRunning();
      const isMainSaleRunning = await tokenSaleInstance.isMainSaleRunning();
      const hasEnded = await tokenSaleInstance.hasEnded();

      assert.equal(isPrivateSaleRunning, false, "Contract is on Private state");
      assert.equal(isPreSaleRunning, false, "Contract is on PreSale state");
      assert.equal(isTokenSaleRunning, true, "Contract is not on TokenSaleRunning state");
      assert.equal(isMainSaleRunning, true, "Contract is not on MainSaleRunning state");
      assert.equal(hasEnded, false, "Has Ended should be false");
    });

    it('Should reject reserving tokens after presale ended', async function () {
      let user = WALLET_INVESTOR_5;
      let amount = new BigNumber(5).mul(TO_TOKEN_DECIMALS); // 5 tokens
      await tokenSaleInstance.reserveTokens(amount, user, { from: WALLET_OWNER }).should.be.rejectedWith(EVMThrow);
    });

    it('Should approve KYC of investor 4', async function () {
      await tokenSaleInstance.approveUserKYC(WALLET_INVESTOR_4, { from: WALLET_OWNER });
      const userHasKyc = await tokenSaleInstance.userHasKYC(WALLET_INVESTOR_4);
      assert.equal(userHasKyc, true, "KYC has not been flagged");
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

    it('calling buyTokens directly also works', async function () {
      const preUserTokenBalance = await tokenInstance.balanceOf(WALLET_INVESTOR_1);

      await tokenSaleInstance.buyTokens({ value: ONE_ETH, from: WALLET_INVESTOR_1 });

      const tokensBought = ONE_ETH.mul(TOKEN_RATE_BASE_RATE);

      // check buyer balance is ok
      const postUserTokenBalance = await tokenInstance.balanceOf(WALLET_INVESTOR_1);
      postUserTokenBalance.sub(preUserTokenBalance).should.be.bignumber.equal(tokensBought);
    });

    it('Should buy tokens for new investor', async function () {
      const tokens = await doBuy(tokenSaleInstance, WALLET_INVESTOR_4, new BigNumber(0.5).mul(ONE_ETH), TOKEN_RATE_BASE_RATE);
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

    it('Should call finishContract', async function () {
      const tokensSold = await tokenSaleInstance.tokensSold();
      const notSoldTokens = TOKEN_SALE_TOKEN_CAP.sub(tokensSold).truncated();
      const companyReserveTokens = TOTAL_TOKENS_SUPPLY.sub(TOKEN_SALE_TOKEN_CAP);

      await tokenSaleInstance.finishContract({ from: WALLET_OWNER });

      const tokenContractOwner = await tokenInstance.owner();
      assert.equal(tokenContractOwner, WALLET_OWNER, "Token should be owned by owner wallet after contract finish");

      // check balance of tokens on vault wallet, should have Not Sold Tokens + Company Reserve Tokens
      const vaultBalance = await tokenInstance.balanceOf(WALLET_VAULT);
      assert.equal(vaultBalance.toString(10), notSoldTokens.add(companyReserveTokens).toString(10) , "Vault wallet final balance is wrong");

      // check all supply has been minted
      const totalSupply = await tokenInstance.totalSupply();
      assert.equal(totalSupply.toString(10), TOTAL_TOKENS_SUPPLY.toString(10), "All token supply should have been minted");

      // check states
      const isPrivateSaleRunning = await tokenSaleInstance.isPrivateSaleRunning();
      const isPreSaleRunning = await tokenSaleInstance.isPreSaleRunning();
      const isTokenSaleRunning = await tokenSaleInstance.isTokenSaleRunning();
      const isMainSaleRunning = await tokenSaleInstance.isMainSaleRunning();
      const hasEnded = await tokenSaleInstance.hasEnded();

      assert.equal(isPrivateSaleRunning, false, "Contract is on Private state");
      assert.equal(isPreSaleRunning, false, "Contract is on PreSale state");
      assert.equal(isTokenSaleRunning, false, "Contract is on TokenSaleRunning state");
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
      await tokenSaleInstance.reserveTokens(amount, user, { from: WALLET_OWNER }).should.be.rejectedWith(EVMThrow);
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
});