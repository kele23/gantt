import date_utils from './date_utils';
import { Task } from './types';

export function generate_id(task: Task) {
    return task.name + '_' + Math.random().toString(36).slice(2, 12);
}

export function sanitize(s: string) {
    return s.replaceAll(' ', '_').replaceAll(':', '_').replaceAll('.', '_');
}

export function deepMerge<T>(target: T, source: T) {
    for (const key in source) {
        if (
            source[key] &&
            typeof source[key] === 'object' &&
            !Array.isArray(source[key]) &&
            !Object.prototype.toString.call(source[key]).includes('Date')
        ) {
            //@ts-ignore: T is ok
            target[key] = deepMerge(target[key] || {}, source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
}

export function getDecade(d: Date) {
    const year = d.getFullYear();
    return year - (year % 10) + '';
}

export function formatWeek(d: Date, ld: Date, lang: string) {
    let endOfWeek = date_utils.add(d, 6, 'day');
    let endFormat = endOfWeek.getMonth() !== d.getMonth() ? 'd MMM' : 'd';
    let beginFormat = !ld || d.getMonth() !== ld.getMonth() ? 'd MMM' : 'd';
    return `${date_utils.format(d, beginFormat, lang)} - ${date_utils.format(endOfWeek, endFormat, lang)}`;
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart
export function padStart(str: string, targetLength: number, padString: string) {
    str = str + '';
    targetLength = targetLength >> 0;
    padString = String(typeof padString !== 'undefined' ? padString : ' ');
    if (str.length > targetLength) {
        return String(str);
    } else {
        targetLength = targetLength - str.length;
        if (targetLength > padString.length) {
            padString += padString.repeat(targetLength / padString.length);
        }
        return padString.slice(0, targetLength) + String(str);
    }
}
