import { Item } from './types';

export function generate_id(task: Item) {
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

export function createEl({
    left,
    top,
    width,
    height,
    id,
    classes,
    append_to,
    prepend_to,
    type,
}: {
    left?: number;
    top?: number;
    width?: number;
    height?: number;
    id?: string;
    classes?: string;
    append_to?: HTMLElement;
    prepend_to?: HTMLElement;
    type?: string;
}): HTMLElement {
    let $el = document.createElement(type || 'div');
    if (classes) for (let cls of classes.split(' ')) $el.classList.add(cls);
    $el.style.top = top + 'px';
    $el.style.left = left + 'px';
    if (id) $el.id = id;
    if (width) $el.style.width = width + 'px';
    if (height) $el.style.height = height + 'px';
    if (append_to) append_to.appendChild($el);
    if (prepend_to) prepend_to.prepend($el);
    return $el;
}
