import ArbitrageNft from "./exchanges/ArbitrageNft.js";

const options = {
  platforms: ["OPENSEA", "X2Y2"],
  tokenLoan: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  addrFlashloan: "0x97E2D08BeFd9B3C5CBe917fdf5362F66dC5791cF",
  chain: "mainnet",
};

const arbitrage = new ArbitrageNft(options);

arbitrage.start();
