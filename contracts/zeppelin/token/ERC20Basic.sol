pragma solidity ^0.4.18;

// https://github.com/OpenZeppelin/zeppelin-solidity/blob/c5d66183abcb63a90a2528b8333b2b17067629fc/contracts/token/ERC20/ERC20Basic.sol
/**
 * @title ERC20Basic
 * @dev Simpler version of ERC20 interface
 * @dev see https://github.com/ethereum/EIPs/issues/179
 */
contract ERC20Basic {
  function totalSupply() public view returns (uint256);
  function balanceOf(address who) public view returns (uint256);
  function transfer(address to, uint256 value) public returns (bool);
  event Transfer(address indexed from, address indexed to, uint256 value);
}
