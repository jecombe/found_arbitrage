import axios from "axios";
import _ from "lodash";

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

  async getNftmetaData(contractAddress, tokenId) {
    const url = "https://sudoapi.xyz/v1/alchemy/getNFTMetadata";
    const body = {
      contractAddress,
      tokenId,
    };

    const headers = {
      "sec-ch-ua":
        '"Not_A Brand";v="99", "Google Chrome";v="109", "Chromium";v="109"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      Referer: "https://sudoswap.xyz/",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    };

    const rep = await this.request(url, body, "GET", headers);
  }

  async getNftsOnCollection(collectionAddr, name) {
    const headers = {
      "content-type": "application/json",
      "sec-ch-ua":
        '"Not_A Brand";v="99", "Google Chrome";v="109", "Chromium";v="109"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      Referer: "https://sudoswap.xyz/",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    };
    const addr = collectionAddr.toLowerCase();
    const body = `{\"query\":\"\\n      {\\n        collection(id: \\\"${addr}\\\") {\\n          pairs(first: 900, skip: 0) {\\n    id\\n    collection {\\n      id\\n    }\\n    owner {\\n      id\\n    }\\n    token {\\n      id\\n      name\\n      symbol\\n      decimals\\n    }\\n    type\\n    assetRecipient\\n    bondingCurve\\n    delta\\n    fee\\n    spotPrice\\n    nftIds\\n    ethBalance\\n    tokenBalance\\n    ethVolume}\\n        }\\n      }\"}`;

    try {
      const rep = await this.request(
        "https://api.thegraph.com/subgraphs/name/zeframlou/sudoswap",
        body,
        "POST",
        headers
      );
      return rep.data.data.collection.pairs.reduce((acc, el) => {
        //  if (name == 'Genuine Undead') console.log(el);
        if (!_.isEmpty(el.nftIds)) {
          acc.push({
            ids: el.nftIds,
            fee: el.fee,
            spotPrice: el.spotPrice,
            ownerId: el.owner.id,
          });
        }
        return acc;
      }, []);
    } catch (error) {
      return error;
    }

    // console.log(rep.data.data.collection.pairs, name);
  }

  async getNftsOnCollections() {
    for await (const collection of Object.keys(this.collections)) {
      const res = await this.getNftsOnCollection(
        collection,
        this.collections[collection].name
      );
      this.collections[collection].nfts = res;
    }
    return this.collections;
  }

  async getNft(data) {
    const header = {
      "sec-ch-ua":
        '"Not_A Brand";v="99", "Google Chrome";v="109", "Chromium";v="109"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      Referer: "https://sudoswap.xyz/",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    };
    const rep = await this.request(
      "https://sudoapi.xyz/v1/collections",
      data,
      "GET",
      header
    );
    return rep.data.collections.reduce((acc, el) => {
      //if (Number(el.analytics.volume_24_hour) !== 0)

      if (Number(el.sell_quote) && Number(el.buy_quote)) {
        acc[el.address] = {
          name: el.name,
          symbol: el.symbol,
          sellQuote: Number(el.sell_quote),
          buyQuote: Number(el.buy_quote),
          tvl: Number(el.offer_tvl),
          id: el._id,
          nfts: [],
        };
      }
      return acc;
    }, {});
  }

  async getTrendingCollections(number = 20) {
    // fetch("https://sudoapi.xyz/v1/collections?sort=volume_all_time&desc=true&pageNumber=1", {
    //     "headers": {
    //       "sec-ch-ua": "\"Not_A Brand\";v=\"99\", \"Google Chrome\";v=\"109\", \"Chromium\";v=\"109\"",
    //       "sec-ch-ua-mobile": "?0",
    //       "sec-ch-ua-platform": "\"macOS\"",
    //       "Referer": "https://sudoswap.xyz/",
    //       "Referrer-Policy": "strict-origin-when-cross-origin"
    //     },
    //     "body": null,
    //     "method": "GET"
    //   });
    let i = 1;
    const promises = [];
    while (i !== number) {
      const data = {
        sort: "volume_all_time",
        desc: true,
        pageNumber: i,
      };
      i += 1;
      promises.push(this.getNft(data));
    }
    try {
      const rep = await Promise.all(promises);
      let newObj = {};
      rep.forEach((obj) => {
        newObj = { ...newObj, ...obj };
      });
      this.collections = newObj;
      return this.collections;
    } catch (error) {}
  }

  async getPoolInfos(collection, price) {
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
}
