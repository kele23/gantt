import { gettext } from './i18n';
import date_utils from './date_utils';
import { formatWeek, getDecade } from './utils';
import { Options, Task, ViewModeDef } from './types';

const DEFAULT_VIEW_MODES_DEFS: Record<string, ViewModeDef> = {
    hour: {
        name: 'Hour',
        padding: '7d',
        step: '1h',
        date_format: 'YYYY-MM-DD HH:',
        lower_text: 'HH',
        upper_text: (d, ld, lang) =>
            !ld || d.getDate() !== ld.getDate()
                ? date_utils.format(d, 'D MMMM', lang)
                : '',
        upper_text_frequency: 24,
    },
    qday: {
        name: 'Quarter Day',
        padding: '7d',
        step: '6h',
        date_format: 'YYYY-MM-DD HH:',
        lower_text: 'HH',
        upper_text: (d, ld, lang) =>
            !ld || d.getDate() !== ld.getDate()
                ? date_utils.format(d, 'D MMM', lang)
                : '',
        upper_text_frequency: 4,
    },
    hday: {
        name: 'Half Day',
        padding: '14d',
        step: '12h',
        date_format: 'YYYY-MM-DD HH:',
        lower_text: 'HH',
        upper_text: (d, ld, lang) =>
            !ld || d.getDate() !== ld.getDate()
                ? d.getMonth() !== d.getMonth()
                    ? date_utils.format(d, 'D MMM', lang)
                    : date_utils.format(d, 'D', lang)
                : '',
        upper_text_frequency: 2,
    },
    day: {
        name: 'Day',
        padding: '7d',
        date_format: 'YYYY-MM-DD',
        step: '1d',
        lower_text: (d, ld, lang) =>
            !ld || d.getDate() !== ld.getDate()
                ? date_utils.format(d, 'D', lang)
                : '',
        upper_text: (d, ld, lang) =>
            !ld || d.getMonth() !== ld.getMonth()
                ? date_utils.format(d, 'MMMM', lang)
                : '',
        thick_line: (d) => d.getDay() === 1,
    },
    week: {
        name: 'Week',
        padding: '1m',
        step: '7d',
        date_format: 'YYYY-MM-DD',
        column_width: 140,
        lower_text: formatWeek,
        upper_text: (d, ld, lang) =>
            !ld || d.getMonth() !== ld.getMonth()
                ? date_utils.format(d, 'MMMM', lang)
                : '',
        thick_line: (d) => d.getDate() >= 1 && d.getDate() <= 7,
        upper_text_frequency: 4,
    },
    month: {
        name: 'Month',
        padding: '2m',
        step: '1m',
        column_width: 120,
        date_format: 'YYYY-MM',
        lower_text: 'MMMM',
        upper_text: (d, ld, lang) =>
            !ld || d.getFullYear() !== ld.getFullYear()
                ? date_utils.format(d, 'YYYY', lang)
                : '',
        thick_line: (d) => d.getMonth() % 3 === 0,
        snap_at: '7d',
    },
    year: {
        name: 'Year',
        padding: '2y',
        step: '1y',
        column_width: 120,
        date_format: 'YYYY',
        upper_text: (d, ld, _lang) =>
            !ld || getDecade(d) !== getDecade(ld) ? getDecade(d) : '',
        lower_text: 'YYYY',
        snap_at: '30d',
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
    holidays: { 'var(--g-weekend-highlight-color)': 'weekend' },
    ignore: [],
    infinite_padding: false,
    language: 'en',
    left_sidebar_list_config: {
        width: 200,
    },
    end_date: undefined,
    start_date: undefined,
    lines: 'both',
    lower_header_height: 30,
    move_dependencies: true,
    padding: 18,
    popup: (task: Task) => {
        return 'ciao';
    },
    readonly: false,
    readonly_dates: false,
    scroll_to: 'today',
    show_expected_progress: false,
    snap_at: undefined,
    task_groups_enabled: false,
    today_button: true,
    upper_header_height: 45,
    view_mode: 'day',
    view_mode_select: false,
    view_modes: ['year', 'month', 'week', 'day', 'hday', 'qday', 'hour'],
    view_modes_def: DEFAULT_VIEW_MODES_DEFS,
};

export { DEFAULT_OPTIONS };
