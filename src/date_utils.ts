import {
    addDays,
    addHours,
    addMilliseconds,
    addMinutes,
    addMonths,
    addSeconds,
    addWeeks,
    addYears,
    differenceInDays,
    differenceInHours,
    differenceInMilliseconds,
    differenceInMinutes,
    differenceInSeconds,
    format,
    getDaysInMonth,
    getDaysInYear,
    getDecade,
    startOfDay,
    startOfHour,
    startOfMinute,
    startOfMonth,
    startOfSecond,
    startOfToday,
    startOfWeek,
    startOfYear,
} from 'date-fns';
import { getDateFnsLocale } from './i18n';
import { DateScale } from './types';

export default {
    parse_duration(duration: string): { duration: number; scale: DateScale } {
        const regex = /([0-9]+)(y|m|w|d|h|min|s|ms)/gm;
        const matches = regex.exec(duration);
        if (!matches) throw new Error('Invalid duration');

        if (matches[2] === 'y') {
            return { duration: parseInt(matches[1]), scale: `year` };
        } else if (matches[2] === 'm') {
            return { duration: parseInt(matches[1]), scale: `month` };
        } else if (matches[2] === 'w') {
            return { duration: parseInt(matches[1]), scale: `week` };
        } else if (matches[2] === 'd') {
            return { duration: parseInt(matches[1]), scale: `day` };
        } else if (matches[2] === 'h') {
            return { duration: parseInt(matches[1]), scale: `hour` };
        } else if (matches[2] === 'min') {
            return { duration: parseInt(matches[1]), scale: `minute` };
        } else if (matches[2] === 's') {
            return { duration: parseInt(matches[1]), scale: `second` };
        } else if (matches[2] === 'ms') {
            return { duration: parseInt(matches[1]), scale: `millisecond` };
        } else {
            throw new Error('Invalid duration');
        }
    },

    getDecade(date: Date) {
        return getDecade(date);
    },

    format(date: Date, date_format = 'yyyy-MM-dd HH:mm:ss.SSS', lang = 'en') {
        return format(date, date_format, { locale: getDateFnsLocale(lang) });
    },

    diff(date_a: Date, date_b: Date, scale: DateScale = 'day') {
        switch (scale) {
            case 'year':
                return differenceInDays(date_a, date_b) / 365;
            case 'month':
                return differenceInDays(date_a, date_b) / 30;
            case 'week':
                return differenceInHours(date_a, date_b) / (24 * 7);
            case 'day':
                return differenceInHours(date_a, date_b) / 24;
            case 'hour':
                return differenceInHours(date_a, date_b);
            case 'minute':
                return differenceInMinutes(date_a, date_b);
            case 'second':
                return differenceInSeconds(date_a, date_b);
            case 'millisecond':
                return differenceInMilliseconds(date_a, date_b);
        }
    },

    today() {
        return startOfToday();
    },

    now() {
        return new Date();
    },

    add(date: Date, qty: number, scale: DateScale) {
        switch (scale) {
            case 'year':
                return addYears(date, qty);
            case 'month':
                return addMonths(date, qty);
            case 'week':
                return addWeeks(date, qty);
            case 'day':
                return addDays(date, qty);
            case 'hour':
                return addHours(date, qty);
            case 'minute':
                return addMinutes(date, qty);
            case 'second':
                return addSeconds(date, qty);
            case 'millisecond':
                return addMilliseconds(date, qty);
        }
    },

    start_of(date: Date, scale: DateScale, lang = 'en') {
        switch (scale) {
            case 'year':
                return startOfYear(date);
            case 'month':
                return startOfMonth(date);
            case 'week':
                return startOfWeek(date, { locale: getDateFnsLocale(lang) });
            case 'day':
                return startOfDay(date);
            case 'hour':
                return startOfHour(date);
            case 'minute':
                return startOfMinute(date);
            case 'second':
                return startOfSecond(date);
            case 'millisecond':
                return date;
        }
    },

    clone(date: Date) {
        //@ts-ignore: it works
        return new Date(...this.get_date_values(date));
    },

    get_date_values(date: Date) {
        return [
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            date.getHours(),
            date.getMinutes(),
            date.getSeconds(),
            date.getMilliseconds(),
        ];
    },

    convert_scales(period: string, to_scale: DateScale) {
        const TO_DAYS = {
            millisecond: 1 / 60 / 60 / 24 / 1000,
            second: 1 / 60 / 60 / 24,
            minute: 1 / 60 / 24,
            hour: 1 / 24,
            day: 1,
            week: 7,
            month: 30,
            year: 365,
        };
        const { duration, scale } = this.parse_duration(period);
        let in_days = duration * TO_DAYS[scale];
        return in_days / TO_DAYS[to_scale];
    },

    get_days_in_month(date: Date) {
        return getDaysInMonth(date);
    },

    get_days_in_year(date: Date) {
        return getDaysInYear(date);
    },
};
