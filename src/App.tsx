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
  DeleteOutlined,
  LoadingOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  Prices,
  Ticker,
  INTERVAL,
  FREQUENCY,
  RawTickerData,
  TIME_SERIES_FIELD,
  TIME_SERIES_PARAM,
} from './typings';
import debounce from 'lodash/debounce';
import relativeTime from 'dayjs/plugin/relativeTime';
import dayjs, { OpUnitType } from 'dayjs';

dayjs.extend(relativeTime);

const API_KEY = '3IU26SL7Y4EAM8BY';
const frequencyTimeSeriesInfo = {
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
const App: React.FC = () => {
  const [frequency, setFrequency] = React.useState<FREQUENCY>(
    // FREQUENCY.ONE_DAY
    FREQUENCY.ONE_WEEK
  );
  const [watchList, setWatchList] = React.useState<string[]>(['IBM']);
  const [dataSource, setDataSource] = React.useState<Ticker[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [isSearchLoading, setIsSearchLoading] = React.useState<boolean>(false);
  const [alertProps, setAlertProps] = React.useState<AlertProps>();
  const [suggestions, setSuggestions] = React.useState<
    { label: string; value: string }[]
  >([]);

  function formatDateByFrequency(date: string, frequency: FREQUENCY) {
    let formatString;
    switch (frequency) {
      case FREQUENCY.ONE_YEAR:
        formatString = 'MMM YYYY';
        break;
      case FREQUENCY.ONE_MONTH:
      default:
      case FREQUENCY.ONE_WEEK:
        formatString = 'DD MMM';
      // break;
      // default:
      // case FREQUENCY.ONE_DAY:
      //   formatString = 'h:mm A';
    }
    return dayjs(date).format(formatString);
  }
  const filterDataByFrequency = React.useCallback(
    (data: [string, Prices][]) => {
      const sortedData = [...data].sort(([firstDate], [secondDate]) =>
        dayjs(firstDate).diff(dayjs(secondDate))
      );
      const lastTradingDate = sortedData[sortedData.length - 1][0];
      return sortedData.reduce(
        (filteredData, [date, prices]) => {
          let unit: OpUnitType;
          switch (frequency) {
            case FREQUENCY.ONE_YEAR:
              unit = 'year';
              break;
            case FREQUENCY.ONE_MONTH:
              unit = 'month';
              break;
            default:
            case FREQUENCY.ONE_WEEK:
              unit = 'week';
            // break;
            // default:
            // case FREQUENCY.ONE_DAY:
            //   unit = 'day';
          }
          return filteredData.concat(
            dayjs(lastTradingDate).isSame(dayjs(date), unit)
              ? {
                  timestamp: formatDateByFrequency(date, frequency),
                  price: +prices['4. close'],
                }
              : []
          );
        },
        [] as {
          timestamp: string;
          price: number;
        }[]
      );
    },
    [frequency]
  );
  React.useEffect(() => {
    const { missingTickers, validDataSource } = watchList.reduce(
      ({ missingTickers, validDataSource }, symbol) => {
        const tickerData = dataSource.find(
          (ticker) => ticker.symbol === symbol && ticker.frequency === frequency
        );
        return {
          missingTickers: missingTickers.concat(tickerData ? [] : symbol),
          validDataSource: validDataSource.concat(tickerData ? tickerData : []),
        };
      },
      {
        missingTickers: [] as string[],
        validDataSource: [] as Ticker[],
      }
    );
    if (missingTickers.length) {
      setAlertProps(undefined);
      setIsLoading(true);
      const defaultParams = {
        function: frequencyTimeSeriesInfo[frequency].param,
        apikey: API_KEY,
        // ...(frequency === FREQUENCY.ONE_DAY
        //   ? {
        //       interval: INTERVAL.SIXTY_MINUTE,
        //     }
        //   : {}),
      };
      Promise.all(
        missingTickers.map((symbol) =>
          fetch(
            'https://www.alphavantage.co/query?' +
              new URLSearchParams({ ...defaultParams, symbol }).toString()
          )
        )
      )
        .then((responses) => {
          const jsonRequests = responses.reduce((jsonRequests, response) => {
            if (response.status === 200) {
              jsonRequests.push(response.json());
            }
            return jsonRequests;
          }, [] as Promise<RawTickerData>[]);
          Promise.all(jsonRequests)
            .then((rawData) => {
              const fetchedDataSource = rawData.reduce(
                (dataSource, rawTickerData) => {
                  if (rawTickerData.Information || rawTickerData.Note) {
                    throw Error(
                      'Alpha Vantage API call frequency is limit to 5 calls per minute & 500 calls per day'
                    );
                  }
                  const metaTickerFields = Object.entries(
                    rawTickerData['Meta Data'] || {}
                  ).reduce(
                    (tickerFields, [key, value]) => ({
                      ...tickerFields,
                      ...(key.includes('Symbol')
                        ? {
                            symbol: value,
                          }
                        : {}),
                      ...(key.includes('Time Zone')
                        ? {
                            timeZone: value,
                          }
                        : {}),
                      ...(key.includes('Last Refreshed')
                        ? {
                            lastUpdate: dayjs(value).valueOf(),
                          }
                        : {}),
                    }),
                    {
                      symbol: '',
                      timeZone: '-',
                      lastUpdate: NaN,
                      frequency,
                    }
                  );
                  const tickerData = filterDataByFrequency(
                    Object.entries(
                      rawTickerData[frequencyTimeSeriesInfo[frequency].field] ||
                        {}
                    )
                  );
                  dataSource.push({
                    ...metaTickerFields,
                    data: tickerData,
                  });
                  return dataSource;
                },
                [] as Ticker[]
              );
              setDataSource(fetchedDataSource.concat(validDataSource));
            })
            .catch(({ message }) => {
              setDataSource([]);
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
                  <Button
                    size="small"
                    onClick={() => setWatchList([...watchList])} // trigger a re-fetch
                  >
                    Try Again
                  </Button>
                ),
              });
            })
            .finally(() => setIsLoading(false));
        })
        .catch((error) => console.error(error))
        .finally(() => setIsLoading(false));
    } else {
      setDataSource(validDataSource);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frequency, watchList, filterDataByFrequency]);

  function addTicker(symbol: string) {
    if (symbol) {
      if (suggestions.some(({ value }) => value === symbol)) {
        setWatchList((currentWatchList) => [symbol, ...currentWatchList]);
        notification.success({
          message: 'Ticker added successfully',
          description: `We have successfully added "${symbol}" to your watch list.`,
        });
      } else {
        notification.error({
          message: 'Operation unsuccessful',
          description: `Cannot find "${symbol}" in the database.`,
        });
      }
    }
  }
  function removeTicker(symbol: string) {
    setWatchList((currentWatchList) =>
      currentWatchList.filter((tickerSymbol) => tickerSymbol !== symbol)
    );
    notification.success({
      message: 'Ticker removed successfully',
      description: `We have successfully removed "${symbol}" from your watch list.`,
    });
  }
  const columns: ColumnsType<Ticker> = [
    {
      dataIndex: 'symbol',
      title: 'Ticker',
      width: 120,
    },
    {
      dataIndex: 'lastUpdate',
      title: 'Last Update',
      width: 200,
      render: (lastUpdate: number) => dayjs(lastUpdate).fromNow(),
    },
    {
      dataIndex: 'action',
      title: 'Action',
      align: 'center',
      width: 80,
      render: (_text: string, { symbol }: Ticker) => (
        <DeleteOutlined
          className={styles.delete}
          onClick={() => removeTicker(symbol)}
        />
      ),
    },
  ];
  const lineConfig: LineOptions = React.useMemo(
    () => ({
      data: dataSource.reduce(
        (chartData, { data, symbol }) =>
          chartData.concat(data.map((dataInfo) => ({ ...dataInfo, symbol }))),
        [] as {
          timestamp: string;
          price: number;
          symbol: string;
        }[]
      ),
      xField: 'timestamp',
      yField: 'price',
      seriesField: 'symbol',
      legend: {
        position: 'bottom',
      },
      // yAxis: { title: { text: 'Price' } },
    }),
    [dataSource]
  );
  const searchTicker = React.useMemo(
    () =>
      debounce((value: string) => {
        setSuggestions([]);
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
                .then((result) =>
                  setSuggestions(
                    result.bestMatches?.reduce(
                      (
                        suggestions: { label: string; value: string }[],
                        match: Record<string, string>
                      ) => {
                        const symbolEntry = Object.entries(match).find(
                          ([key]) => key.includes('symbol')
                        );
                        return suggestions.concat(
                          symbolEntry
                            ? {
                                label: symbolEntry[1],
                                value: symbolEntry[1],
                              }
                            : []
                        );
                      },
                      []
                    )
                  )
                )
                .catch((error) => console.error(error))
                .finally(() => setIsSearchLoading(false));
            }
          })
          .catch((error) => {
            console.error(error);
            setIsSearchLoading(false);
          });
      }, 500),
    []
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
              onSearch={(value: string) => searchTicker(value)}
              options={suggestions}
              notFoundContent={
                isSearchLoading ? 'Loading...' : 'No Match Found'
              }
            >
              <Input.Search
                placeholder="Enter a symbol, e.g., NYC"
                size="large"
                allowClear={true}
                enterButton={isLoading ? undefined : <PlusOutlined />}
                loading={isLoading}
                onPressEnter={({ currentTarget: { value } }) =>
                  addTicker(value.toUpperCase())
                }
                onSearch={(value) => addTicker(value.toUpperCase())}
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
        Designed by Leslie Ho Zong Hong on 25 Sep, 2021. Powered by{' '}
        <a href="www.alphavantage.co">www.alphavantage.co</a>
      </div>
    </div>
  );
};

export default App;
