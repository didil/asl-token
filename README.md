# ASL Token/Token Sale 

Required: Node 8.x latest

Install truffle (v4) and ganache-cli
```
npm i -g truffle
npm i -g ganache-cli
```

Install packages
```
npm install
```

Init truffle config
```
cp truffle.js.example truffle.js
```

Run ganache-cli
```
ganache-cli -e 1000000
```

Run tests
```
truffle test
```

To deploy to Testnet/Mainnet, set the proper network settings in truffle.js, then for example for kovan (replace MY_VAULT_ADDRESS, MY_AIRDROP_WALLET, and MY_KYC_ADDRESS with the actual wallet addresses)
```
VAULT_ADDRESS=MY_VAULT_ADDRESS AIRDROP_WALLET=MY_AIRDROP_WALLET KYC_ADDRESS=MY_KYC_ADDRESS truffle migrate --network=kovan
```