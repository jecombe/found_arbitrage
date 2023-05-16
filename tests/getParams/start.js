import OpenSea from "./OpenSea.js";

// USE THIS FOR GOERLI

const opensea = new OpenSea("0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC");
const buyNft = async (tokenId, collecitonAddr) => {
  const tx = await opensea.buy(collecitonAddr, tokenId);
  //console.log("Tx: ", tx);
};

buyNft("52", "0x05a0b0985ba3b7bd9ade8a7478caa2fa4fda24e5");
