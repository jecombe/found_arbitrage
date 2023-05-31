import axios from "axios";
import _ from "lodash";
import Logger from "../../utils/Logger.js";
import { BigNumber } from "ethers";

export default class {
  constructor(utils) {
    this.exchange = "sudoswap";
    this.collections = {};
    this.utils = utils;
  }

  async request(url, data = {}, method, headers) {
    let opt = {};
    if (method === "GET") {
      opt = {
        url,
        params: data,
        method,
        headers,
      };
    } else {
      opt = {
        url,
        data,
        method,
        headers,
      };
    }
    return axios(opt);
  }

  getSlug(addr, collections) {
    const keys = Object.keys(collections);

    if (keys.includes(addr)) {
      return collections[addr].slug;
    } else {
      return null;
    }
  }

  async getNft(collections) {
    try {
      const rep = await fetch("https://sudoapi.xyz/v1/defined", {
        headers: {
          "content-type": "application/json",
          "sec-ch-ua":
            '"Google Chrome";v="113", "Chromium";v="113", "Not-A.Brand";v="24"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"macOS"',
          Referer: "https://sudoswap.xyz/",
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
        body: '{"query":"{\\n          filterNftPoolCollections(\\n            limit: 25,\\n            filters: {\\n              exchange: \\"0xb16c1342e617a5b6e4b631eb114483fdb289c0a4\\",\\n              volumeUSD24: {gt: \\"300\\"}\\n              nftVolume24: {gt: \\"1\\"}\\n              nftBalance: {gt: \\"1\\"}\\n            },\\n            rankings: {\\n              attribute: nftVolume24,\\n              direction: DESC\\n            }) {\\n              results {\\n                collectionAddress\\n                imageUrl\\n                name\\n                volumeUSD24\\n                volumeNBT24\\n                nftVolume24\\n                floorNBT\\n                offerNBT\\n                nftBalance\\n              }\\n          }\\n        }"}',
        method: "POST",
      });
      const nfts = await rep.json();
      return nfts.data.filterNftPoolCollections.results.reduce((acc, el) => {
        if (el.offerNBT)
          acc[el.collectionAddress] = {
            sellQuote: el.offerNBT,
            name: el.name,
            slug: this.getSlug(el.collectionAddress, collections),
          };
        return acc;
      }, {});
    } catch (error) {
      return error;
    }
  }

  async getTrendingCollections(collections) {
    try {
      Logger.debug("Update trending collection sudoswap");

      const collectionsTrending = await this.getNft(collections);

      this.collections = collectionsTrending;
      return this.collections;
    } catch (error) {
      Logger.error(error);
      return error;
    }
  }

  async getPoolInfos(collection, price) {
    try {
      const rep = await fetch("https://sudoapi.xyz/v1/defined", {
        headers: {
          "content-type": "application/json",
          "sec-ch-ua":
            '"Google Chrome";v="113", "Chromium";v="113", "Not-A.Brand";v="24"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"macOS"',
          Referer: "https://sudoswap.xyz/",
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
        body: `{"query":"{\\n          getNftPoolsByCollectionAndExchange(\\n            collectionAddress: \\"${collection}\\",\\n            networkId: 1,\\n            exchangeAddress: \\"0xb16c1342E617A5B6E4b631EB114483FDB289c0A4\\",\\n            limit: 500) {\\n            items {\\n              assetRecipientAddress\\n              balanceT\\n              bondingCurveAddress\\n              collectionAddress\\n              delta\\n              fee\\n              nftBalance\\n              poolAddress\\n              owner\\n              spotPriceT\\n              spotPriceNBT\\n              tokenAddress\\n              poolType\\n              nftAssets {\\n                tokenId\\n                name\\n                originalImage\\n                attributes {\\n                  class\\n                  css\\n                  displayType\\n                  maxValue\\n                  name\\n                  value\\n                  valueType\\n                }        \\n                media {\\n                  thumbLg\\n                }\\n              }\\n              poolVariant\\n            }\\n          }\\n        }"}`,
        method: "POST",
      });

      const data = await rep.json();
      if (!data.data.getNftPoolsByCollectionAndExchange) {
        Logger.error("NOT getNftPoolsByCollectionAndExchange");
        return [];
      }
      return data.data.getNftPoolsByCollectionAndExchange.items.reduce(
        (acc, el) => {
          if (el.poolType === "BUY" || el.poolType === "BUY_AND_SELL") {
            const balance = Number(this.utils.convertToEth(el.balanceT));
            if (balance >= Number(price)) {
              acc.push({
                poolAddress: el.poolAddress,
                balance,
              });
            }
          }
          return acc;
        },
        []
      );
    } catch (error) {
      Logger.error(error);
      return error;
    }
  }

  async getPoolData(collection, price) {
    try {
      const rep = await fetch("https://sudoapi.xyz/v1/defined", {
        headers: {
          "content-type": "application/json",
          "sec-ch-ua":
            '"Google Chrome";v="113", "Chromium";v="113", "Not-A.Brand";v="24"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"macOS"',
          Referer: "https://sudoswap.xyz/",
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
        body: `{"query":"{\\n          getNftPoolsByCollectionAndExchange(\\n            collectionAddress: \\"${collection}\\",\\n            networkId: 1,\\n            exchangeAddress: \\"0xb16c1342E617A5B6E4b631EB114483FDB289c0A4\\",\\n            limit: 500) {\\n            items {\\n              assetRecipientAddress\\n              balanceT\\n              bondingCurveAddress\\n              collectionAddress\\n              delta\\n              fee\\n              nftBalance\\n              poolAddress\\n              owner\\n              spotPriceT\\n              spotPriceNBT\\n              tokenAddress\\n              poolType\\n              nftAssets {\\n                tokenId\\n                name\\n                originalImage\\n                attributes {\\n                  class\\n                  css\\n                  displayType\\n                  maxValue\\n                  name\\n                  value\\n                  valueType\\n                }        \\n                media {\\n                  thumbLg\\n                }\\n              }\\n              poolVariant\\n            }\\n          }\\n        }"}`,
        method: "POST",
      });

      const data = await rep.json();

      return data.data.getNftPoolsByCollectionAndExchange.items.reduce(
        (acc, el) => {
          if (el.poolType === "BUY" || el.poolType === "BUY_AND_SELL") {
            if (Number(el.balanceT) >= Number(price) && Number(el.spotPriceT)) {
              if (el.delta === "0") {
                acc.push({
                  address: el.poolAddress,
                  balance: BigNumber.from(el.balanceT),
                  spotPrice: BigNumber.from(el.spotPriceT),
                  delta: el.delta || null,
                  fee: el.fee || null,
                });
              }
            }
          }
          return acc;
        },
        []
      );
    } catch (error) {
      Logger.error(error);
      return error;
    }
  }

  getParams(pair, nftIds) {
    const model = {
      encodeParams: {
        pair: "address",
        nftIds: "uint256[]",
      },
    };

    const payload = {
      pair,
      nftIds,
    };
    return this.utils.encodeAbi(model, payload);
  }

  getPriceSellCollection(addr) {
    // return fetch("https://sudoapi.xyz/v1/defined", {
    //   headers: {
    //     "content-type": "application/json",
    //     "sec-ch-ua":
    //       '"Google Chrome";v="113", "Chromium";v="113", "Not-A.Brand";v="24"',
    //     "sec-ch-ua-mobile": "?0",
    //     "sec-ch-ua-platform": '"macOS"',
    //     Referer: "https://sudoswap.xyz/",
    //     "Referrer-Policy": "strict-origin-when-cross-origin",
    //   },
    //   body: '{\ngetNftPoolCollection(collectionAddress: "0x42f1654B8eeB80C96471451B1106b63D0B1a9fe1", exchangeAddress: "0xb16c1342E617A5B6E4b631EB114483FDB289c0A4", networkId: 1) {\n            volumeAllTimeNBT\n          }\n        }',
    //   // `{\"query\":\"{\\n          getNftEvents(address: \\\"${addr}\\\", networkId: 1, exchangeAddress: \\\"0xb16c1342E617A5B6E4b631EB114483FDB289c0A4\\\", limit: 50) {\\n            items {\\n              tokenId\\n              maker\\n              taker\\n              totalPriceNetworkBaseToken\\n              paymentTokenAddress\\n              individualPrice\\n              eventType\\n              transactionHash\\n              timestamp\\n              numberOfTokens\\n              poolAddress\\n              data{\\n                maker\\n                taker\\n              }\\n            }\\n          }\\n        }\"}`,
    //   method: "POST",
    // });
    return fetch("https://sudoapi.xyz/v1/defined", {
      headers: {
        "content-type": "application/json",
        "sec-ch-ua":
          '"Google Chrome";v="113", "Chromium";v="113", "Not-A.Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        Referer: "https://sudoswap.xyz/",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
      body: `{"query":"{\\n          getNftPoolCollection(collectionAddress: \\"${addr}\\", exchangeAddress: \\"0xb16c1342E617A5B6E4b631EB114483FDB289c0A4\\", networkId: 1) {\\n            offerNBT\\n          }\\n        }"}`,
      method: "POST",
    });
  }
}
