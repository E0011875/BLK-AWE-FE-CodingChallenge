import * as React from 'react';
import styles from './App.module.css';
import {
  Spin,
  Input,
  Alert,
  Table,
  Radio,
  Button,
  AlertProps,
  notification,
  AutoComplete,
} from 'antd';
import { Line } from '@ant-design/charts';
import { LineOptions } from '@antv/g2plot';
import { ColumnsType } from 'antd/lib/table';
import {
  LinkOutlined,
  PlusOutlined,
  DeleteOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import {
  Ticker,
  ChartData,
  FREQUENCY,
  OptionsType,
  RawTickerData,
  RawSearchTicketData,
} from './typings';
import debounce from 'lodash/debounce';
import { filterDataByFrequency } from './utils';
import {
  API_KEY,
  frequencyTimeSeriesInfo,
  ALPHAVANTAGE_API_PREFIX,
} from './constants';
import relativeTime from 'dayjs/plugin/relativeTime';
import dayjs from 'dayjs';

dayjs.extend(relativeTime);

const App: React.FC = () => {
  const [frequency, setFrequency] = React.useState<FREQUENCY>(
    FREQUENCY.ONE_WEEK
  );
  const [dataSource, setDataSource] = React.useState<Ticker[]>([
    {
      symbol: 'BLK',
      timeZone: '-',
      lastUpdate: NaN,
      dataUrl: '',
      data: [],
    },
  ]);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [searchResults, setSearchResults] = React.useState<
    { label: string; value: string }[]
  >([]);
  const [isSearchLoading, setIsSearchLoading] = React.useState<boolean>(false);
  const [alertProps, setAlertProps] = React.useState<AlertProps>();
  function fetchTickers(
    symbols: string[],
    retry: React.MouseEventHandler,
    frequency: FREQUENCY
  ) {
    setAlertProps(undefined);
    setIsLoading(true);
    return Promise.all(
      symbols.map((symbol) =>
        fetch(
          ALPHAVANTAGE_API_PREFIX +
            new URLSearchParams({
              symbol,
              function: frequencyTimeSeriesInfo[frequency].param,
              apikey: API_KEY,
            }).toString()
        )
      )
    )
      .then((responses) => {
        let failedResponse: Response | undefined;
        const jsonRequests = responses.map((response) => {
          if (response.status !== 200) {
            failedResponse = response;
          }
          return response.json();
        });
        if (failedResponse) {
          throw Error(failedResponse.status.toString());
        }
        return Promise.all(jsonRequests)
          .then((allRawTickerData: RawTickerData[]) =>
            allRawTickerData.reduce((tickers, rawTickerData, index) => {
              if (rawTickerData['Error Message']) {
                notification.error({
                  message: 'Operation Unsuccessful',
                  description: `Unable to find ${symbols[index]}`,
                });
              } else {
                const metaTickerFields = Object.entries(
                  rawTickerData['Meta Data'] || {}
                ).reduce(
                  (tickerFields, [key, value]) => {
                    let field;
                    if (key.includes('Symbol')) {
                      field = 'symbol';
                    } else if (key.includes('Time Zone')) {
                      field = 'timeZone';
                    } else if (key.includes('Last Refreshed')) {
                      field = 'lastUpdate';
                    }
                    return field
                      ? {
                          ...tickerFields,
                          [field]:
                            field === 'symbol' ? value.toUpperCase() : value,
                        }
                      : tickerFields;
                  },
                  {
                    symbol: '',
                    timeZone: '-',
                    lastUpdate: NaN,
                    dataUrl: '',
                    frequency,
                  }
                );
                if (!metaTickerFields.symbol) {
                  throw Error(
                    'Alpha Vantage API call frequency is limit to 5 calls per minute & 500 calls per day'
                  );
                }
                tickers.push({
                  ...metaTickerFields,
                  dataUrl:
                    ALPHAVANTAGE_API_PREFIX +
                    new URLSearchParams({
                      symbol: symbols[index],
                      function: frequencyTimeSeriesInfo[frequency].param,
                      apikey: API_KEY,
                    }).toString(),
                  data: filterDataByFrequency(
                    Object.entries(
                      rawTickerData[frequencyTimeSeriesInfo[frequency].field] ||
                        {}
                    ),
                    frequency
                  ),
                });
              }
              return tickers;
            }, [] as Ticker[])
          )
          .catch(({ message }) =>
            setAlertProps({
              message: (
                <div>
                  <b>[Quota Limit]:</b> {message} - see&nbsp;
                  <a href="https://www.alphavantage.co/support/#support">
                    https://www.alphavantage.co/support
                  </a>
                  . Please wait a few minutes &amp; try again.
                </div>
              ),
              type: 'error',
              showIcon: true,
              closable: true,
              onClose: () => setAlertProps(undefined),
              action: (
                <Button size="small" onClick={retry}>
                  Try Again
                </Button>
              ),
            })
          )
          .finally(() => setIsLoading(false));
      })
      .catch(({ message }) => {
        notification.error({
          message,
          description: `Error fetching ticker.`,
        });
        setIsLoading(false);
      });
  }
  const updateDataSource = React.useCallback(() => {
    let needToUpdate = false;
    const symbols = dataSource.map(({ symbol, frequency: tickerFreq }) => {
      if (tickerFreq !== frequency) {
        needToUpdate = true;
      }
      return symbol;
    });
    if (needToUpdate) {
      fetchTickers(symbols, updateDataSource, frequency).then(
        (fetchedDataSource) =>
          setDataSource(
            (currentDataSource) =>
              fetchedDataSource ||
              currentDataSource.map((ticker) => ({
                ...ticker,
                lastUpdate: NaN,
                frequency,
                dataUrl:
                  ALPHAVANTAGE_API_PREFIX +
                  new URLSearchParams({
                    symbol: ticker.symbol,
                    function: frequencyTimeSeriesInfo[frequency].param,
                    apikey: API_KEY,
                  }).toString(),

                data: [],
              }))
          )
      );
    }
  }, [dataSource, frequency]);

  React.useEffect(() => {
    updateDataSource();
  }, [updateDataSource]);
  const addTicker = React.useCallback(
    (symbol: string) => {
      if (symbol) {
        const tickerExist = dataSource.some(
          ({ symbol: tickerSymbol }) => tickerSymbol === symbol
        );
        if (tickerExist) {
          notification.error({
            message: 'Ticker already exist',
            description: `${symbol} is already added to your watch list.`,
          });
        } else {
          fetchTickers([symbol], () => addTicker(symbol), frequency).then(
            (fetchedDataSource) => {
              if (fetchedDataSource) {
                setDataSource((currentDataSource) => [
                  ...fetchedDataSource,
                  ...currentDataSource,
                ]);
              }
            }
          );
        }
      }
    },
    [dataSource, frequency]
  );
  const removeTicker = React.useCallback(
    (symbol: string) => {
      const newDataSource = [...dataSource];
      const indexToRemove = newDataSource.findIndex(
        ({ symbol: tickerSymbol }) => tickerSymbol === symbol
      );
      newDataSource.splice(indexToRemove, 1);
      setDataSource(newDataSource);
      notification.success({
        message: 'Ticker removed successfully',
        description: `We have successfully removed "${symbol}" from your watch list.`,
      });
    },
    [dataSource]
  );
  const searchTicker = React.useMemo(
    () =>
      debounce((value: string) => {
        setSearchResults([]);
        setIsSearchLoading(true);
        fetch(
          'https://www.alphavantage.co/query?' +
            new URLSearchParams({
              function: 'SYMBOL_SEARCH',
              keywords: value,
              apikey: API_KEY,
            }).toString()
        )
          .then((response) => {
            if (response.status === 200) {
              response
                .json()
                .then(({ bestMatches }: RawSearchTicketData) =>
                  setSearchResults(
                    bestMatches?.reduce((suggestions, match) => {
                      const symbolEntry = Object.entries(match).find(([key]) =>
                        key.includes('symbol')
                      );
                      if (symbolEntry) {
                        return suggestions.concat({
                          label: symbolEntry[1],
                          value: symbolEntry[1],
                        });
                      }
                      return suggestions;
                    }, [] as OptionsType[]) || []
                  )
                )
                .finally(() => setIsSearchLoading(false));
            }
          })
          .catch(() => setIsSearchLoading(false));
      }, 500),
    []
  );
  const columns: ColumnsType<Ticker> = React.useMemo(
    () => [
      {
        dataIndex: 'symbol',
        title: 'Ticker',
        width: 120,
      },
      {
        dataIndex: 'lastUpdate',
        title: 'Last Update',
        width: 200,
        render: (lastUpdate: number) =>
          lastUpdate ? dayjs(lastUpdate).fromNow() : null,
      },
      {
        title: 'Actions',
        align: 'center',
        width: 100,
        render: (_text: string, { symbol, dataUrl }: Ticker) => (
          <div className={styles.actions}>
            <LinkOutlined
              className={styles.link}
              onClick={() => {
                navigator.clipboard.writeText(dataUrl);
                notification.info({
                  message: 'Copied Data URL to Clipboard',
                  description: `Copied ${symbol} time series url data`,
                });
              }}
            />
            <DeleteOutlined
              className={styles.delete}
              onClick={() => removeTicker(symbol)}
            />
          </div>
        ),
      },
    ],
    [removeTicker]
  );
  const lineConfig: LineOptions = React.useMemo(
    () => ({
      data: dataSource.reduce(
        (chartData, { data, symbol }) =>
          chartData.concat(data.map((dataInfo) => ({ ...dataInfo, symbol }))),
        [] as ChartData[]
      ),
      xField: 'timestamp',
      yField: 'price',
      seriesField: 'symbol',
      legend: {
        position: 'bottom',
      },
    }),
    [dataSource]
  );
  return (
    <div className={styles.App}>
      <div className={styles.header}>
        <b>
          <span className={styles.header__company}>BlackRock</span>
          &nbsp;&#169;
        </b>
        <span className={styles.header__title}>Coding Challenge</span>
      </div>
      <div className={styles.alert}>
        {alertProps ? <Alert {...alertProps} /> : null}
      </div>
      <div className={styles.body}>
        <Radio.Group
          onChange={({ target: { value } }) =>
            setFrequency((currentFrequency) =>
              currentFrequency === value ? currentFrequency : value
            )
          }
          value={frequency}
          optionType="button"
        >
          {Object.values(FREQUENCY).map((frequency) => (
            <Radio.Button key={frequency} value={frequency}>
              {frequency}
            </Radio.Button>
          ))}
        </Radio.Group>
        <div className={styles.body__content}>
          {isLoading ? (
            <Spin
              size="large"
              tip="Loading"
              className={styles.body__content__graph__loading}
              indicator={<LoadingOutlined spin />}
            />
          ) : (
            <Line {...lineConfig} />
          )}
          <div className={styles['body__content__watch-list']}>
            <AutoComplete
              options={searchResults}
              onSearch={(value: string) => searchTicker(value)}
              notFoundContent={
                isSearchLoading ? 'Searching...' : 'No Match Found'
              }
            >
              <Input.Search
                placeholder="Enter a symbol, e.g., BLK"
                size="large"
                allowClear={true}
                enterButton={isLoading ? undefined : <PlusOutlined />}
                loading={isLoading}
                onPressEnter={({ currentTarget: { value } }) =>
                  addTicker(value)
                }
                onSearch={(value) => addTicker(value)}
              />
            </AutoComplete>
            <Table
              title={() => (
                <b className={styles.body__content__tickers__header}>
                  Watch List
                </b>
              )}
              rowKey="symbol"
              bordered={true}
              columns={columns}
              dataSource={dataSource}
              className={styles.table}
              loading={isLoading}
              pagination={{
                size: 'small',
                defaultPageSize: 10,
                showSizeChanger: false,
                showTotal: (total) => `Total ${total} tickers`,
              }}
            />
          </div>
        </div>
      </div>
      <div className={styles.signature}>
        Created by Leslie Ho Zong Hong on 25 Sep, 2021. Powered by&nbsp;
        <a href="https://www.alphavantage.co">www.alphavantage.co</a>.
      </div>
    </div>
  );
};

export default App;
