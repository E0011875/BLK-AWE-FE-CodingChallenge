export enum FREQUENCY {
  // ONE_DAY = '1 Day',
  ONE_WEEK = '1 Week',
  ONE_MONTH = '1 Month',
  ONE_YEAR = '1 Year',
}
export enum TIME_SERIES_PARAM {
  INTRADAY = 'TIME_SERIES_INTRADAY',
  DAILY = 'TIME_SERIES_DAILY',
  MONTHLY = 'TIME_SERIES_MONTHLY',
}
export enum TIME_SERIES_FIELD {
  INTRADAY = 'Time Series (60min)',
  DAILY = 'Time Series (Daily)',
  MONTHLY = 'Monthly Time Series',
}
export enum INTERVAL {
  ONE_MINUTE = '1min',
  FIVE_MINUTE = '5min',
  FIFTEEN_MINUTE = '15min',
  THIRTY_MINUTE = '30min',
  SIXTY_MINUTE = '60min',
}
export enum OUTPUT_SIZE {
  COMPACT = 'compact',
  FULL = 'full',
}
export enum DATA_TYPE {
  JSON = 'json',
  CSV = 'csv',
}
export type Prices = {
  '1. open': string;
  '2. high': string;
  '3. low': string;
  '4. close': string;
  '5. volume': string;
};
export type RequestParams = {
  symbol: string;
  apikey: string;
  datatype?: DATA_TYPE;
} & (
  | {
      function: Exclude<TIME_SERIES_PARAM, TIME_SERIES_PARAM.INTRADAY>;
    }
  | {
      function: TIME_SERIES_PARAM.INTRADAY;
      interval: INTERVAL;
      adjusted?: boolean;
      outputsize?: OUTPUT_SIZE;
    }
);
export type RawTickerData = {
  'Meta Data'?: {
    '1. Information': string;
    '2. Symbol': string;
    '3. Last Refreshed': string;
    '4. Interval'?: string;
    '5. Output Size': string;
    '6. Time Zone': string;
  };
  'Error Message'?: string;
  Information?: string;
  Note?: string;
} & {
  [timeSeries in TIME_SERIES_FIELD]?: Record<string, Prices>;
};
export type Ticker = {
  symbol: string;
  timeZone: string;
  lastUpdate: number;
  frequency?: FREQUENCY;
  data: {
    timestamp: string;
    price: number;
  }[];
};
export type RawSearchTicketData = {
  bestMatches: Record<string, string>[];
  'Error Message'?: string;
  Information?: string;
  Note?: string;
};
export type ChartData = {
  timestamp: string;
  price: number;
  symbol: string;
};
export type OptionsType = { label: string; value: string };
