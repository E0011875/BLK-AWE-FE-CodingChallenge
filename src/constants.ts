import { FREQUENCY, TIME_SERIES_FIELD, TIME_SERIES_PARAM } from './typings';

export const API_KEY = '3IU26SL7Y4EAM8BY';
export const ALPHAVANTAGE_API_PREFIX = 'https://www.alphavantage.co/query?';
export const frequencyTimeSeriesInfo = {
  // [FREQUENCY.ONE_DAY]: {
  //   param: TIME_SERIES_PARAM.INTRADAY,
  //   field: TIME_SERIES_FIELD.INTRADAY,
  // },
  [FREQUENCY.ONE_WEEK]: {
    param: TIME_SERIES_PARAM.DAILY,
    field: TIME_SERIES_FIELD.DAILY,
  },
  [FREQUENCY.ONE_MONTH]: {
    param: TIME_SERIES_PARAM.DAILY,
    field: TIME_SERIES_FIELD.DAILY,
  },
  [FREQUENCY.ONE_YEAR]: {
    param: TIME_SERIES_PARAM.MONTHLY,
    field: TIME_SERIES_FIELD.MONTHLY,
  },
};
