import date_utils from './date_utils';
import { Options, ViewModeDef } from './types';

const DEFAULT_VIEW_MODES_DEFS: Record<string, ViewModeDef> = {
    hour: {
        name: 'Hour',
        padding: '7d',
        step: '1h',
        date_format: 'yyyy-MM-dd HH:',
        lower_text: 'HH',
        upper_text: (d, ld, lang) =>
            !ld || d.getDate() !== ld.getDate()
                ? date_utils.format(d, 'd MMMM', lang)
                : '',
        upper_text_frequency: 24,
    },
    qday: {
        name: 'Quarter Day',
        padding: '7d',
        step: '6h',
        date_format: 'yyyy-MM-dd HH:',
        lower_text: 'HH',
        upper_text: (d, ld, lang) =>
            !ld || d.getDate() !== ld.getDate()
                ? date_utils.format(d, 'd MMM', lang)
                : '',
        upper_text_frequency: 4,
    },
    hday: {
        name: 'Half Day',
        padding: '7d',
        step: '12h',
        date_format: 'yyyy-MM-dd HH:',
        lower_text: 'HH',
        upper_text: (d, ld, lang) =>
            !ld || d.getDate() !== ld.getDate()
                ? date_utils.format(d, 'd MMM', lang)
                : '',
        upper_text_frequency: 2,
    },
    day: {
        name: 'Day',
        padding: '7d',
        date_format: 'yyyy-MM-dd',
        step: '1d',
        lower_text: (d, ld, lang) =>
            !ld || d.getDate() !== ld.getDate()
                ? date_utils.format(d, 'd', lang)
                : '',
        upper_text: (d, ld, lang) =>
            !ld || d.getMonth() !== ld.getMonth()
                ? date_utils.format(d, 'MMMM', lang)
                : '',
        thick_line: (d) => d.getDay() === 1,
    },
    week: {
        name: 'Week',
        padding: '14d',
        step: '1w',
        date_format: 'ww yyyy',
        column_width: 200,
        lower_text: (d: Date, ld: Date, lang: string) => {
            let endOfWeek = date_utils.add(d, 6, 'day');
            let endFormat =
                endOfWeek.getMonth() !== d.getMonth() ? 'd MMM' : 'd';
            let beginFormat =
                !ld || d.getMonth() !== ld.getMonth() ? 'd MMM' : 'd';
            return `${date_utils.format(d, beginFormat, lang)} - ${date_utils.format(endOfWeek, endFormat, lang)}`;
        },
        upper_text: (d, ld, lang) =>
            !ld || d.getMonth() !== ld.getMonth()
                ? date_utils.format(d, 'MMMM', lang)
                : '',
        thick_line: (d) => d.getDate() >= 1 && d.getDate() <= 7,
        upper_text_frequency: 4,
    },
    month: {
        name: 'Month',
        padding: '14d',
        step: '1m',
        column_width: 350,
        date_format: 'yyyy-MM',
        lower_text: 'MMMM',
        upper_text: (d, ld, lang) =>
            !ld || d.getFullYear() !== ld.getFullYear()
                ? date_utils.format(d, 'yyyy', lang)
                : '',
        thick_line: (d) => d.getMonth() % 3 === 0,
    },
    year: {
        name: 'Year',
        padding: '1y',
        step: '1y',
        column_width: 600,
        date_format: 'yyyy',
        upper_text: (d, ld, _lang) =>
            `` +
            (!ld || date_utils.getDecade(d) !== date_utils.getDecade(ld)
                ? date_utils.getDecade(d)
                : ''),
        lower_text: 'yyyy',
    },
};

const DEFAULT_OPTIONS: Options = {
    arrow_curve: 5,
    auto_move_label: false,
    bar_corner_radius: 3,
    bar_height: 30,
    bar_config: {
        show_label_on_offset: true,
    },
    base_z_index: 10,
    container_height: 'auto',
    column_width: undefined,
    date_format: 'YYYY-MM-DD HH:mm',
    enable_left_sidebar_list: false,
    sidebar_config: {
        sidebar_width: 200,
        get_label: (item) => {
            return `
                <div class="tw:flex tw:gap-2 tw:pl-4 tw:h-full tw:cursor-pointer tw:bg-white tw:hover:bg-gray-100 tw:py-1">
                    ${item.thumbnail ? `<img class="tw:block tw:w-auto tw:h-[40px]" src="${item.thumbnail}" alt="thumb"/>` : ''}
                    <div class="tw:flex tw:flex-col tw:justify-center tw:h-[40px]"><span class="tw:font-bold tw:text-[14px]">${item.name}</span> ${item.text ? `<span class="tw:text-[12px]">${item.text}</span>` : ''}</div>
                </div>    
            `;
        },
    },
    holidays: { 'var(--g-weekend-highlight-color)': 'weekend' },
    language: 'en',
    end_date: undefined,
    start_date: undefined,
    lines: 'both',
    lower_header_height: 30,
    move_dependencies: true,
    padding: 18,
    show_expected_progress: false,
    groupsEnabled: false,
    today_button: true,
    upper_header_height: 45,
    view_mode_select: false,
    view_modes: ['year', 'month', 'week', 'day', 'hday', 'qday', 'hour'],
    view_modes_def: DEFAULT_VIEW_MODES_DEFS,
};

export { DEFAULT_OPTIONS };
