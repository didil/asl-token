pragma solidity ^0.4.18;

import './AslToken.sol';
import './zeppelin/lifecycle/Pausable.sol';

contract AslTokenSale is Pausable {
  using SafeMath for uint256;

  /**
  * @dev Supporter structure, which allows us to track
  * how much the user has bought so far, and if he's flagged as known
  */
  struct Supporter {
    uint256 weiSpent; // the total amount of Wei this address has sent to this contract
    bool hasKYC; // if the user has KYC flagged
  }

  /**
   * @dev Token Sale States
   */
  enum TokenSaleState {Private, Pre, Main, Finished}

  // Variables
  mapping(address => Supporter) public supportersMap; // Mapping with all the campaign supporters
  AslToken public token; // ERC20 Token contract address
  address public fundWallet; // Wallet address to forward all Ether to
  address public kycManagerWallet; // Wallet address that manages the approval of KYC
  uint256 public tokensSold; // How many tokens sold have been sold in total
  uint256 public weiRaised; // Total amount of raised money in Wei
  uint256 public maxTxGas; // Maximum transaction gas price allowed for fair-chance transactions
  TokenSaleState public currentState; // current Sale state

  uint256 public constant ONE_MILLION = 10 ** 6; // One million for token cap calculation reference
  uint256 public constant PRE_SALE_TOKEN_CAP = 384 * ONE_MILLION * 10 ** 18; // Maximum amount that can be sold during the Pre Sale period
  uint256 public constant TOKEN_SALE_CAP = 492 * ONE_MILLION * 10 ** 18; // Maximum amount of tokens that can be sold by this contract
  uint256 public constant MIN_ETHER = 0.1 ether; // Minimum ETH Contribution allowed during the crowd sale

  /* Allowed Contribution in Ether */
  uint256 public constant PRE_SALE_MINIMUM = 1 ether; // Minimum 1 Ether to get 10% Bonus Tokens
  uint256 public constant PRE_SALE_15_BONUS_MIN = 60 ether; // Minimum 60 Ether to get 15% Bonus Tokens
  uint256 public constant PRE_SALE_20_BONUS_MIN = 300 ether; // Minimum 300 Ether to get 20% Bonus Tokens

  /* Bonus Tokens based on the ETH Contributed in single transaction */
  uint256 public constant TOKEN_RATE_BASE_RATE = 2500; // Base Price for reference only
  uint256 public constant TOKEN_RATE_10_PERCENT_BONUS = 3125; // 10% Bonus Tokens, During PreSale when >= 1 ETH & < 60 ETH
  uint256 public constant TOKEN_RATE_15_PERCENT_BONUS = 3250; // 15% Bonus Tokens, During PreSale when >= 60 ETH & < 300 ETH
  uint256 public constant TOKEN_RATE_20_PERCENT_BONUS = 3500; // 20% Bonus Tokens, During PreSale when >= 300 ETH

  /**
  * @dev Modifier to only allow KYCManager Wallet
  * to execute a function
  */
  modifier onlyKycManager() {
    require(msg.sender == kycManagerWallet);
    _;
  }

  /**
  * Event for token purchase logging
  * @param purchaser The wallet address that bought the tokens
  * @param value How many Weis were paid for the purchase
  * @param amount The amount of tokens purchased
  */
  event TokenPurchase(address indexed purchaser, uint256 value, uint256 amount);

  /**
   * Event for kyc status change logging
   * @param user User who has had his KYC status changed
   * @param isApproved A boolean representing the KYC approval the user has been changed to
   */
  event KYC(address indexed user, bool isApproved);

  /**
   * Constructor
   * @param _fundWallet Address to forward all received Ethers to
   * @param _kycManagerWallet KYC Manager wallet to approve / disapprove user's KYC
   * @param _maxTxGas Maximum gas price a transaction can have before being reverted
   */
  function AslTokenSale(
    address _fundWallet,
    address _kycManagerWallet,
    uint256 _maxTxGas
  )
  public
  {
    require(_fundWallet != address(0));
    require(_kycManagerWallet != address(0));
    require(_maxTxGas > 0);

    fundWallet = _fundWallet;
    kycManagerWallet = _kycManagerWallet;
    maxTxGas = _maxTxGas;

    token = new AslToken();

    // init sale state;
    currentState = TokenSaleState.Private;
  }

  /* fallback function can be used to buy tokens */
  function() public payable {
    buyTokens();
  }

  /* low level token purchase function */
  function buyTokens() public payable whenNotPaused {
    // Do not allow if gasprice is bigger than the maximum
    // This is for fair-chance for all contributors, so no one can
    // set a too-high transaction price and be able to buy earlier
    require(tx.gasprice <= maxTxGas);

    // Check we're in pre or main sale period
    require(isTokenSaleRunning());

    // check if KYC ok
    require(userHasKYC(msg.sender));

    // check user is sending enough Wei for the stage's rules
    require(aboveMinimumPurchase());

    address sender = msg.sender;
    uint256 weiAmountSent = msg.value;

    // calculate token amount to be created
    uint256 rate = getRate(weiAmountSent);
    uint256 newTokens = weiAmountSent.mul(rate);

    // look if we have not yet reached the cap
    uint256 totalTokensSold = tokensSold.add(newTokens);
    if (isMainSaleRunning()) {
      require(totalTokensSold <= TOKEN_SALE_CAP);
    } else if (isPreSaleRunning()) {
      require(totalTokensSold <= PRE_SALE_TOKEN_CAP);
    }

    // update supporter state
    Supporter storage sup = supportersMap[sender];
    uint256 totalWei = sup.weiSpent.add(weiAmountSent);
    sup.weiSpent = totalWei;

    // update contract state
    weiRaised = weiRaised.add(weiAmountSent);
    tokensSold = totalTokensSold;

    // mint the coins
    token.mint(sender, newTokens);
    TokenPurchase(sender, weiAmountSent, newTokens);

    // forward the funds to the wallet
    fundWallet.transfer(msg.value);
  }

  /**
  * @dev Start Presale
  */
  function startPreSale() public onlyOwner {
    // make sure we're in the private sale state
    require(currentState == TokenSaleState.Private);

    // move to presale
    currentState = TokenSaleState.Pre;
  }

  /**
  * @dev Start Main sale
  */
  function startMainSale() public onlyOwner {
    // make sure we're in the presale state
    require(currentState == TokenSaleState.Pre);

    // move to main sale
    currentState = TokenSaleState.Main;
  }

  /**
  * @dev Ends the operation of the contract
  */
  function finishContract() public onlyOwner {
    // make sure we are in the main sale period
    require(currentState == TokenSaleState.Main);

    // mark sale as finished
    currentState = TokenSaleState.Finished;

    // send the tokens not sold to the fund wallet
    uint256 notSoldTokens = TOKEN_SALE_CAP.sub(tokensSold);
    token.mint(fundWallet, notSoldTokens);

    // finish the minting of the token, so the system allows transfers
    token.finishMinting();

    // transfer ownership of the token contract to the fund wallet,
    // so it isn't locked to be a child of the crowd sale contract
    token.transferOwnership(fundWallet);
  }

  /**
  * @dev Updates the maximum allowed transaction cost that can be received
  * on the buyTokens() function.
  * @param _newMaxTxGas The new maximum transaction cost
  */
  function updateMaxTxGas(uint256 _newMaxTxGas) public onlyKycManager {
    require(_newMaxTxGas > 0);
    maxTxGas = _newMaxTxGas;
  }

  /**
  * @dev Flag an user as known
  * @param _user The user to flag as known
  */
  function approveUserKYC(address _user) onlyKycManager public {
    require(_user != address(0));

    Supporter storage sup = supportersMap[_user];
    sup.hasKYC = true;
    KYC(_user, true);
  }

  /**
   * @dev Flag an user as unknown/disapproved
   * @param _user The user to flag as unknown / suspecious
   */
  function disapproveUserKYC(address _user) onlyKycManager public {
    require(_user != address(0));

    Supporter storage sup = supportersMap[_user];
    sup.hasKYC = false;
    KYC(_user, false);
  }

  /**
  * @dev Changes the KYC manager to a new address
  * @param _newKYCManagerWallet The new address that will be managing KYC approval
  */
  function setKYCManager(address _newKYCManagerWallet) onlyOwner public {
    require(_newKYCManagerWallet != address(0));
    kycManagerWallet = _newKYCManagerWallet;
  }

  /**
  * @dev check if pre sale or main sale are running
  */
  function isTokenSaleRunning() public constant returns (bool) {
    return (isPreSaleRunning() || isMainSaleRunning());
  }

  /**
  * @dev check if pre sale is running
  */
  function isPreSaleRunning() public constant returns (bool) {
    return (currentState == TokenSaleState.Pre);
  }

  /**
  * @dev check if main sale is running
  */
  function isMainSaleRunning() public constant returns (bool) {
    return (currentState == TokenSaleState.Main);
  }

  /**
  * @dev check if sale has ended
  */
  function hasEnded() public constant returns (bool) {
    return (currentState == TokenSaleState.Finished);
  }

  /**
  * @dev Returns if an user has KYC approval or not
  * @return A boolean representing the user's KYC status
  */
  function userHasKYC(address _user) public constant returns (bool) {
    return supportersMap[_user].hasKYC;
  }

  /**
   * @dev Returns the weiSpent of a user
   */
  function userWeiSpent(address _user) public constant returns (uint256) {
    return supportersMap[_user].weiSpent;
  }

  /**
   * @dev Returns the rate the user will be paying at
   */
  function getRate(uint256 _weiAmount) internal constant returns (uint256) {
    if (isMainSaleRunning()) {
      return TOKEN_RATE_BASE_RATE;
    }
    else if (isPreSaleRunning()) {
      if (_weiAmount >= PRE_SALE_20_BONUS_MIN) {return TOKEN_RATE_20_PERCENT_BONUS;}
      else if (_weiAmount >= PRE_SALE_15_BONUS_MIN) {return TOKEN_RATE_15_PERCENT_BONUS;}
      else if (_weiAmount >= PRE_SALE_MINIMUM) {return TOKEN_RATE_10_PERCENT_BONUS;}
    }
  }

  /**
   * @dev Check if the user is buying above minimum
   */
  function aboveMinimumPurchase() internal constant returns (bool) {
    if (isMainSaleRunning()) {
      return msg.value >= MIN_ETHER;
    }
    else if (isPreSaleRunning()) {
      // presale restrictions
      return msg.value >= PRE_SALE_MINIMUM;
    } else {
      return false;
    }
  }
}