import _ from "lodash";
import Sudoswap from "./amm/Sudoswap.js";
import OpenSea from "./classic/OpenSea.js";
import Logger from "../utils/Logger.js";
import Utils from "../utils/Utils.js";

export default class {
  constructor(params) {
    this.tokenLoan = params.tokenLoan;
    this.amount = params.amount;
    this.utils = new Utils();
    this.exchanges = [
      {
        amm: new Sudoswap(this.utils),
        toCompare: [new OpenSea(this.utils)],
      },
    ];
  }

  isProfitableGas() {
    // calculate price gas and call flashloan cost
    return true;
  }

  getNumOfExchange(exchange1) {
    if (exchange1 === "opensea") return 1;

    if (exchange1 === "sudoswsap") return 2;
  }

  encodingAllParams(exchange1) {
    const model = {
      encodeParams: {
        token: "address",
        amount: "uint256",
        exchange1: "uint256",
        byteExchange1: "bytes",
        byteExchange2: "bytes",
        collection: "address",
      },
    };

    const payload = {
      token: this.tokenLoan,
      amount: 1000000,
      exchange1: this.getNumOfExchange(exchange1.name),
      byteExchange1: exchange1.bytes,
      byteExchange2: exchange1.bytes2,
      collection: exchange1.collection,
    };
    return this.utils.encodeAbi(model, payload);
  }

  async getParamsEncoding(exchangeToBuy, nft, collectionAddr, poolAddr, amm) {
    try {
      const bytesParams = await exchangeToBuy.getParams(
        nft.tokenId,
        collectionAddr
      );
      const bytesParams2 = amm.getParams(poolAddr, [nft.tokenId]);

      const encodeParamsExchange1 = {
        token: "",
        amount: "",
        exchangeClassic: bytesParams,
        exchangeAmm: bytesParams2,
        name: exchangeToBuy.exchange,
        collection: collectionAddr,
      };
      return this.encodingAllParams(encodeParamsExchange1, "", nft.price);
    } catch (error) {
      return error;
    }
  }

  callFlashloan(bytesAllParams) {
    // call flashloan with all params for flashloan and arbitrage parameters encoding
  }

  async comparePrices(nfts, amm, collectionAddr, exchangeToBuy) {
    const priceInEth = this.utils.convertToEth(
      amm.collections[collectionAddr].sellQuote
    );
    const difference = priceInEth - Number(nfts[0].price);

    if (difference > 0) {
      const pools = await amm.getPoolInfos(collectionAddr, priceInEth);

      if (_.isEmpty(pools)) {
        Logger.debug(
          `POOL ON COLLECTION ${amm.collections[collectionAddr].name} IS EMPTY BECAUSE ANY POOLS HAVE CORRECT BALANCES`
        );
        return;
      }

      Logger.info(
        `Maybe profitable arbitrage ${nfts[0].tokenId} on collection ${amm.collections[collectionAddr].name} buy on ${exchangeToBuy.exchange}: ${nfts[0].price} sell to ${amm.exchange}: ${priceInEth} DIFFERENCE: ${difference}`
      );
      if (this.isProfitableGas()) {
        try {
          const bytesAllParams = await this.getParamsEncoding(
            exchangeToBuy,
            nfts[0],
            collectionAddr,
            pools[0].poolAddress,
            amm
          );
          //this.callFlashloan(bytesAllParams);
        } catch (error) {
          Logger.error("CONMPARE PRICE ENCODING", error);
        }
      }
    }
  }

  async manageArbitrage(element) {
    const { amm, toCompare } = element;

    await amm.getTrendingCollections();
    for await (const collectionAddr of Object.keys(amm.collections)) {
      for await (const exchange of toCompare) {
        const nfts = await exchange.getNftsOnCollection(collectionAddr);
        //  console.log(nfts);
        if (_.isEmpty(nfts))
          Logger.warn(
            `Collection ${amm.collections[collectionAddr].name} not found on ${exchange.exchange}`
          );
        else await this.comparePrices(nfts, amm, collectionAddr, exchange);
      }
    }
  }

  async start() {
    Logger.trace("START ARBITRAGE");
    try {
      this.exchanges.forEach((element) => {
        this.manageArbitrage(element);
      });
    } catch (error) {
      console.log(error);
    }
  }
}
