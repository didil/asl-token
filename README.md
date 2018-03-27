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

To deploy to Testnet/Mainnet, set the proper network settings in truffle.js, then for example for kovan (replace MY_VAULT_ADDRESS, MY_AIRDROP_ADDRESS, MY_KYC_ADDRESS, TOKEN_BASE_RATE and REFERRAL_BONUS_RATE with the actual values)
```
VAULT_ADDRESS=MY_VAULT_ADDRESS AIRDROP_ADDRESS=MY_AIRDROP_ADDRESS KYC_ADDRESS=MY_KYC_ADDRESS TOKEN_BASE_RATE=MY_TOKEN_BASE_RATE REFERRAL_BONUS_RATE=MY_REFERRAL_BONUS_RATE truffle migrate --network=kovan
```


## Airdrop
From the project root folder :

1/ Calculate the airdrop amounts 
```
truffle exec truffle-scripts/airdrop-save-amounts.js 
```

this creates a file "airdrop-amounts-(timestamp).json" 

2/ Run the distribution (GAS_PRICE_IN_WEI is an optional param, the default is se to 10 GWei ie 10 * 10 ** 9 Wei)
```
AIRDROP_AMOUNTS_FILE=airdrop-amounts-(timestamp).json GAS_PRICE=[GAS_PRICE_IN_WEI] truffle exec truffle-scripts/airdrop-distribute.js
```
The distribution supports failure of one of the transfers. Running the same command again should continue the distribution as the amounts json file is updated every time a transfer is done 

