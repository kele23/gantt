import Bar from './bar';

declare global {
    interface SVGElement {
        getX(): number;
        getY(): number;
        getEndX(): number;
        getHeight(): number;
        getWidth(): number;
    }
}

export type BarConfig = {
    show_label_on_offset: boolean;
    get_label?: ({
        task,
        task_group,
    }: {
        task: Task;
        task_group?: TaskGroup;
    }) => string;
    on_click?: ({
        task,
        task_group,
    }: {
        task: Task;
        task_group?: TaskGroup;
    }) => void;
};

export type HolidayObject = {
    name: string;
    date: string;
};
export type HolidaysConfig = Record<string, 'weekend' | HolidayObject[]>;
export type IgnoreConfig = any[];

export type ViewModeDef = {
    name: string;
    padding: string;
    step: string;
    date_format: string;
    column_width?: number;
    lower_text: string | ((d: Date, ld: Date, lang: string) => string);
    upper_text: string | ((d: Date, ld: Date, lang: string) => string);
    upper_text_frequency?: number;
    thick_line?: (d: Date) => boolean;
    snap_at?: string;
};

export type Options = {
    arrow_curve?: number;
    auto_move_label?: boolean;
    bar_corner_radius?: number;
    bar_height?: number;
    bar_config?: BarConfig;
    base_z_index?: number;
    container_height?: string | number;
    column_width?: number;
    date_format?: string;
    enable_left_sidebar_list?: boolean;
    sidebar_width?: number;
    holidays?: HolidaysConfig;
    ignore?: IgnoreConfig;
    infinite_padding?: boolean;
    language?: string;
    end_date?: Date;
    start_date?: Date;
    lines?: 'both' | 'vertical' | 'none' | 'horizontal';
    lower_header_height?: number;
    move_dependencies?: boolean;
    padding?: number;
    scroll_to?: 'start' | 'end' | 'today';
    show_expected_progress?: boolean;
    snap_at?: string;
    task_groups_enabled?: boolean;
    today_button?: boolean;
    upper_header_height?: number;
    view_mode?: string;
    view_mode_select?: boolean;
    view_modes?: string[];
    view_modes_def?: Record<string, ViewModeDef>;
    locales?: Record<string, Locale>;
};

export type Locale = Record<string, string>;

export type Task = {
    id: string;
    end?: string | Date;
    start: string | Date;
    custom_class?: string;
    duration?: string;
    dependencies?: string | string[];
    task_group_id?: string;
    name: string;
    progress?: number;
    thumbnail?: string;
    color?: string;
    color_progress?: string;
    annotations?: string;
};

export type InternalTask = Task & {
    _index: number;
    _start: Date;
    _end: Date;
    dependencies: string[];
    $bar: Bar;
    invalid: boolean;
    actual_duration?: number;
};

export type TaskGroup = {
    id: string;
    name: string;
    thumbnail?: string;
    text?: string;
};

export type DateInfo = {
    date: Date;
    formatted_date: string;
    column_width: number;
    x: number;
    upper_text: string;
    lower_text: string;
    upper_y: number;
    lower_y: number;
};

export type GanttConfig = {
    date_format: string;
    header_height: number;
    column_width: number;
    unit: DateScale;
    step: number;
    view_mode: ViewModeDef;
    view_mode_name: string;
};

export type DateScale =
    | 'year'
    | 'month'
    | 'day'
    | 'hour'
    | 'minute'
    | 'second'
    | 'millisecond';
