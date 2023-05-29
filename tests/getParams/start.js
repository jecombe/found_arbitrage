import OpenSea from "./OpenSea.js";

// USE THIS FOR GOERLI

const opensea = new OpenSea("0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC");
const buyNft = async (tokenId, collecitonAddr) => {
  const tx = await opensea.buy(collecitonAddr, tokenId);
  //console.log("Tx: ", tx);
};

buyNft("478", "0x3bfc3134645ebe0393f90d6a19bcb20bd732964f");
