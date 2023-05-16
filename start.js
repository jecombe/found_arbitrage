import ArbitrageNft from "./exchanges/ArbitrageNft.js";

const options = {
  platforms: ["OPENSEA", "X2Y2"],
  numberTrending: 5,
  numberNfts: 5,
  tokenLoan: "0x65aFADD39029741B3b8f0756952C74678c9cEC93",
};

const arbitrage = new ArbitrageNft(options);

arbitrage.start();
