import request from "../lib/request"
import { getFullUrl } from "../lib/request";


export const getResellers = ({ assetId, cursor, limit }) => {
  // No resellers on the self-contained site.
  return Promise.resolve({ data: [] });
}

export const getRobux = ({ userId }) => {
  // Local Supabase-backed wallet (feeds the navbar R$/Tix counters).
  return request('GET', '/api/web/economy').then(d => {
    const w = (d.data && d.data.data) || d.data || {};
    return { robux: w.robux || 0, tickets: w.tix || 0, tix: w.tix || 0 };
  });
}

export const getRobuxGroup = ({ groupId }) => {
  return request('GET', getFullUrl('economy', '/v1/groups/' + groupId + '/currency')).then(d => d.data);
}

export const getResellableCopies = ({ assetId, userId }) => {
  return Promise.resolve({ data: [] });
}

export const purchaseItem = ({ productId, assetId, sellerId, userAssetId, price, expectedCurrency }) => {
  // Local Supabase-backed purchase against the starter wallet.
  return request('POST', '/api/web/catalog/' + assetId + '/buy', {
    expectedCurrency: expectedCurrency,
    expectedPrice: price,
  }).then(d => {
    return { purchased: true, ...d.data.data };
  }).catch(e => {
    const message = (e.response && e.response.data && e.response.data.errors && e.response.data.errors[0] && e.response.data.errors[0].message) || '';
    if (String(message).toLowerCase().includes('funds') || String(message).toLowerCase().includes('currency')) {
      return { purchased: false, reason: 'InsufficientFunds' };
    }
    return { purchased: false, reason: message || 'PURCHASE_ERROR' };
  });
}

export const setResellableAssetPrice = ({ assetId, userAssetId, price }) => {
  if (!Number.isSafeInteger(price) || price < 0 || isNaN(price)) {
    throw new Error('Invalid Price "' + price + '"');
  }
  return request('PATCH', getFullUrl('economy', `/v1/assets/${assetId}/resellable-copies/${userAssetId}`), {
    price,
  }).then(d => d.data);
}

export const takeResellableAssetOffSale = ({ assetId, userAssetId }) => {
  return setResellableAssetPrice({
    assetId,
    userAssetId,
    price: 0,
  });
}

export const getResaleData = ({ assetId }) => {
  // No resale market on the self-contained site.
  return Promise.resolve({
    recentAveragePrice: 0,
    priceDataPoints: [],
    volumeDataPoints: [],
    sales: 0,
  });
}

export const getTransactions = ({ userId, cursor, type }) => {
  return request('GET', getFullUrl('economy', `/v2/users/${userId}/transactions?cursor=${encodeURIComponent(cursor || '')}&transactionType=${encodeURIComponent(type)}`)).then(d => d.data);
}

export const getGroupTransactions = ({ groupId, cursor, type }) => {
  return request('GET', getFullUrl('economy', `/v2/groups/${groupId}/transactions?cursor=${encodeURIComponent(cursor || '')}&transactionType=${encodeURIComponent(type)}`)).then(d => d.data);
}

export const getTransactionSummary = ({ userId, timePeriod }) => {
  return request('GET', getFullUrl('economy', `/v2/users/${userId}/transaction-totals?timeFrame=${timePeriod}&transactionType=summary`)).then(d => d.data);
}

export const getGroupTransactionSummary = ({ groupId, timePeriod }) => {
  return request('GET', getFullUrl('economy', `/v2/groups/${groupId}/transaction-totals?timeFrame=${timePeriod}&transactionType=summary`)).then(d => d.data);
}


const fNum = (num) => {
  if (!num) return '';
  return num.toLocaleString();
}

export const formatSummaryResponse = (resp, type = 'User') => {
  const isUser = type === 1 || type === 'User';

  const result = [
    isUser && [
      'Builders Club Stipend',
      fNum(resp.premiumStipendsTotal),
    ],
    isUser && [
      'Builders Club Stipend Bonus',
      '',
    ],
    [
      'Sale of Goods',
      fNum(resp.salesTotal),
    ],
    isUser && [
      'Currency Purchase',
      fNum(resp.currencyPurchasesTotal),
    ],
    isUser && [
      'Trade System Trades',
      fNum(resp.tradeSystemEarningsTotal),
    ],
    [
      'Promoted Page Conversion Revenue',
      '',
    ],
    [
      'Game Page Conversion Revenue',
      '',
    ],
    [
      'Pending Sales',
      fNum(resp.pendingRobuxTotal),
    ],
    isUser && [
      'Group Payouts',
      fNum(resp.groupPayoutsTotal),
    ],
  ].filter(v => !!v);
  return result;
};

// Extension - these don't exist on real roblox

export const getMarketActivity = () => {
  return request('GET', getFullUrl('economy', '/v2/currency-exchange/market/activity')).then(d => d.data);
}

export const createCurrencyExchangeOrder = async ({
  currency,
  amount,
  isMarketOrder,
                                                    desiredRate,
}) => {
  return request('POST', getFullUrl('economy', '/v2/currency-exchange/orders/create'), {
    amount,
    sourceCurrency: currency,
    isMarketOrder,
    desiredRate,
  })
}

/**
 * Get open position count for authenticated user
 * @returns {Promise<number>}
 */
export const countOpenPositions = async ({currency}) => {
  return request('GET', getFullUrl('economy', '/v2/currency-exchange/orders/my/count?currency=' + currency)).then(d => d.data.total);
}

export const getOpenPositions = async ({startId, limit,currency}) => {
  return request('GET', getFullUrl('economy', '/v2/currency-exchange/orders/my?limit=' + limit + '&startId=' + startId + '&currency=' + currency)).then(d => d.data);
}

export const closePosition = async({orderId}) => {
  return request('POST', getFullUrl('economy', '/v2/currency-exchange/orders/' + orderId + '/close'));
}