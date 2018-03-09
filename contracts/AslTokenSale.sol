pragma solidity ^0.4.18;

import './AslToken.sol';
import './zeppelin/lifecycle/Pausable.sol';

contract AslTokenSale is Pausable {
  using SafeMath for uint256;

  /**
  * @dev Supporter struct to allow tracking amount spent by user and if he passed KYC
  */
  struct Supporter {
    uint256 weiSpent; // the total amount of Wei this address has sent to this contract
    bool hasKYC; // if the user has passed KYC
  }

  /**
   * @dev Token Sale States
   */
  enum TokenSaleState {Private, Pre, Main, Finished}

  // Variables
  mapping(address => Supporter) public supportersMap; // Mapping with all the Token Sale participants (Private excluded)
  AslToken public token; // ERC20 Token contract address
  address public vaultWallet; // Wallet address to which ETH any Unsold/Company Reserve Tokens get forwarded to
  uint256 public tokensSold; // How many tokens sold have been sold in total
  uint256 public weiRaised; // Total amount of raised money in Wei
  uint256 public maxTxGasPrice; // Maximum transaction gas price allowed for fair-chance transactions
  TokenSaleState public currentState; // current Sale state

  uint256 public constant ONE_MILLION = 10 ** 6; // One million for token cap calculation reference
  uint256 public constant PRE_SALE_TOKEN_CAP = 384 * ONE_MILLION * 10 ** 18; // Maximum amount that can be sold during the Pre Sale period
  uint256 public constant TOKEN_SALE_CAP = 492 * ONE_MILLION * 10 ** 18; // Maximum amount of tokens that can be sold by this contract
  uint256 public constant TOTAL_TOKENS_SUPPLY = 1200 * ONE_MILLION * 10 ** 18; // Total supply that will be minted
  uint256 public constant MIN_ETHER = 0.1 ether; // Minimum ETH Contribution allowed during the crowd sale

  /* Minimum PreSale Contributions in Ether */
  uint256 public constant PRE_SALE_MINIMUM = 1 ether; // Minimum to get 10% Bonus Tokens
  uint256 public constant PRE_SALE_15_BONUS_MIN = 60 ether; // Minimum to get 15% Bonus Tokens
  uint256 public constant PRE_SALE_20_BONUS_MIN = 300 ether; // Minimum to get 20% Bonus Tokens
  uint256 public constant PRE_SALE_30_BONUS_MIN = 1200 ether; // Minimum to get 30% Bonus Tokens

  /* Rate */
  uint256 public constant TOKEN_RATE_BASE_RATE = 10625; // Base Price

  /**
  * Event for token purchase logging
  * @param purchaser The wallet address that bought the tokens
  * @param value How many Weis were paid for the purchase
  * @param amount The amount of tokens purchased
  */
  event TokenPurchase(address indexed purchaser, uint256 value, uint256 amount);

  /**
  * Event for tokens reserved
  * @param wallet The beneficiary wallet address
  * @param amount The amount of tokens sent
  */
  event TokensReserved(address indexed wallet, uint256 amount);

  /**
   * Event for kyc status change logging
   * @param user User address
   * @param isApproved KYC approval state
   */
  event KYC(address indexed user, bool isApproved);

  /**
   * Constructor
   * @param _vaultWallet Vault address
   * @param _maxTxGasPrice Maximum gas price allowed when buying tokens
   */
  function AslTokenSale(
    address _vaultWallet,
    uint256 _maxTxGasPrice
  )
  public
  {
    require(_vaultWallet != address(0));
    require(_maxTxGasPrice > 0);

    vaultWallet = _vaultWallet;
    maxTxGasPrice = _maxTxGasPrice;

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
    require(tx.gasprice <= maxTxGasPrice);

    // make sure we're in pre or main sale period
    require(isTokenSaleRunning());

    // check if KYC ok
    require(userHasKYC(msg.sender));

    // check user is sending enough Wei for the stage's rules
    require(aboveMinimumPurchase());

    address sender = msg.sender;
    uint256 weiAmountSent = msg.value;

    // calculate token amount
    uint256 bonusMultiplier = getBonusMultiplier(weiAmountSent);
    uint256 newTokens = weiAmountSent.mul(TOKEN_RATE_BASE_RATE).mul(bonusMultiplier).div(100);

    // check that we have not yet reached the cap
    uint256 totalTokensSold = tokensSold.add(newTokens);
    if (isMainSaleRunning()) {
      require(totalTokensSold <= TOKEN_SALE_CAP);
    } else if (isPreSaleRunning()) {
      require(totalTokensSold <= PRE_SALE_TOKEN_CAP);
    }

    // update supporter state
    Supporter storage supporter = supportersMap[sender];
    uint256 totalWei = supporter.weiSpent.add(weiAmountSent);
    supporter.weiSpent = totalWei;

    // update contract state
    weiRaised = weiRaised.add(weiAmountSent);
    tokensSold = totalTokensSold;

    // mint the coins
    token.mint(sender, newTokens);
    TokenPurchase(sender, weiAmountSent, newTokens);

    // forward the funds to the vault wallet
    vaultWallet.transfer(msg.value);
  }

  /**
  * @dev Reserve Tokens
  * @param _amount Amount of tokens
  * @param _wallet Destination Address
  */
  function reserveTokens(uint _amount, address _wallet) public onlyOwner {
    // check amount positive
    require(_amount > 0);
    // check destination address not null
    require(_wallet != address(0));

    // make sure that we're in private sale or presale
    require(isPrivateSaleRunning() || isPreSaleRunning());

    uint256 totalTokensSold = tokensSold.add(_amount);
    // check that we're not passing the cap
    require(totalTokensSold <= PRE_SALE_TOKEN_CAP);

    // update contract state
    tokensSold = totalTokensSold;

    // mint the coins
    token.mint(_wallet, _amount);

    // Log Event
    TokensReserved(_wallet, _amount);
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

    // send the tokens not sold to the vault wallet
    uint256 notSoldTokens = TOKEN_SALE_CAP.sub(tokensSold);
    token.mint(vaultWallet, notSoldTokens);

    // send the tokens not for sale to the vault wallet
    uint256 notForSaleTokens = TOTAL_TOKENS_SUPPLY.sub(TOKEN_SALE_CAP);
    token.mint(vaultWallet, notForSaleTokens);

    // finish the minting of the token, so that transfers are allowed
    token.finishMinting();

    // transfer ownership of the token contract to the owner,
    // so it isn't locked to be a child of the crowd sale contract
    token.transferOwnership(owner);
  }

  /**
  * @dev Updates the maximum allowed gas price that can be used when calling buyTokens()
  * @param _newMaxTxGasPrice The new maximum gas price
  */
  function updateMaxTxGasPrice(uint256 _newMaxTxGasPrice) public onlyOwner {
    require(_newMaxTxGasPrice > 0);
    maxTxGasPrice = _newMaxTxGasPrice;
  }

  /**
  * @dev Approve user's KYC
  * @param _user User Address
  */
  function approveUserKYC(address _user) onlyOwner public {
    require(_user != address(0));

    Supporter storage sup = supportersMap[_user];
    sup.hasKYC = true;
    KYC(_user, true);
  }

  /**
   * @dev Disapprove user's KYC
   * @param _user User Address
   */
  function disapproveUserKYC(address _user) onlyOwner public {
    require(_user != address(0));

    Supporter storage sup = supportersMap[_user];
    sup.hasKYC = false;
    KYC(_user, false);
  }


  /**
  * @dev check if private sale is running
  */
  function isPrivateSaleRunning() public constant returns (bool) {
    return (currentState == TokenSaleState.Private);
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
  * @dev Check if user has passed KYC
  * @param _user User Address
  */
  function userHasKYC(address _user) public constant returns (bool) {
    return supportersMap[_user].hasKYC;
  }

  /**
   * @dev Returns the weiSpent of a user
   * @param _user User Address
   */
  function userWeiSpent(address _user) public constant returns (uint256) {
    return supportersMap[_user].weiSpent;
  }

  /**
   * @dev Returns the bonus multiplier to calculate the purchase rate
   * @param _weiAmount Purchase amount
   */
  function getBonusMultiplier(uint256 _weiAmount) internal constant returns (uint256) {
    if (isMainSaleRunning()) {
      return 100;
    }
    else if (isPreSaleRunning()) {
      if (_weiAmount >= PRE_SALE_30_BONUS_MIN) {
        // 30% bonus
        return 130;
      }
      else if (_weiAmount >= PRE_SALE_20_BONUS_MIN) {
        // 20% bonus
        return 120;
      }
      else if (_weiAmount >= PRE_SALE_15_BONUS_MIN) {
        // 15% bonus
        return 115;
      }
      else if (_weiAmount >= PRE_SALE_MINIMUM) {
        // 10% bonus
        return 110;
      }
      else {
        // Safeguard but this should never happen as aboveMinimumPurchase checks the minimum
        revert();
      }
    }
  }

  /**
   * @dev Check if the user is buying above the required minimum
   */
  function aboveMinimumPurchase() internal constant returns (bool) {
    if (isMainSaleRunning()) {
      return msg.value >= MIN_ETHER;
    }
    else if (isPreSaleRunning()) {
      return msg.value >= PRE_SALE_MINIMUM;
    } else {
      return false;
    }
  }
}