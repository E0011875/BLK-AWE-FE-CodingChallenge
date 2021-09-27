import { Prices, FREQUENCY } from './typings';
import dayjs, { OpUnitType } from 'dayjs';

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
export function filterDataByFrequency(
  data: [string, Prices][],
  frequency: FREQUENCY
) {
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
}
