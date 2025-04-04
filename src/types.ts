import Bar from './elements/bar';

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
    get_label?: (item: Item) => string;
    get_popup?: (item: Item) => string;
};

export type SidebarConfig = {
    sidebar_width: number;
    get_label?: (item: ItemGroup) => string;
};

export type HolidayObject = {
    name: string;
    date: Date;
};
export type HolidaysConfig = Record<string, 'weekend' | HolidayObject[]>;

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
};

export type ScrollPosition = 'start' | 'end' | 'today' | 'max' | 'min' | Date;

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
    sidebar_config?: SidebarConfig;
    holidays?: HolidaysConfig;
    language?: string;
    end_date?: Date;
    start_date?: Date;
    lines?: 'both' | 'vertical' | 'none' | 'horizontal';
    lower_header_height?: number;
    move_dependencies?: boolean;
    padding?: number;
    show_expected_progress?: boolean;
    groupsEnabled?: boolean;
    today_button?: boolean;
    upper_header_height?: number;
    view_mode_select?: boolean;
    view_modes?: string[];
    view_modes_def?: Record<string, ViewModeDef>;
    locales?: Record<string, Locale>;
};

export type Locale = Record<string, string>;

export type BasicItem = {
    id: string;
    end: Date;
    start: Date;
    custom_class?: string;
    dependencies?: string | string[];
    groupKey?: string;
    name: string;
    thumbnail?: string;
};

export type Item = BasicItem &
    (
        | {
              color?: string;
              type: 'task';
          }
        | { type: 'disabled' }
    );

export type InternalItem = Item & {
    _index: number;
    _start: Date;
    _end: Date;
    dependencies: string[];
    $bar: Bar;
};

export type ItemGroup = {
    id: string;
    key: string;
    name: string;
    thumbnail?: string;
    text?: string;
    color?: string;
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
    highlightStart?: Date;
    highlightEnd?: Date;
};

export type DateScale =
    | 'year'
    | 'month'
    | 'week'
    | 'day'
    | 'hour'
    | 'minute'
    | 'second'
    | 'millisecond';
