import './styles/gantt.css';

import date_utils from './date_utils';
import { addLocales, gettext } from './i18n';
import { $, createSVG } from './svg_utils';

import { DEFAULT_OPTIONS } from './defaults';

import Arrow from './arrow';
import {
    DateInfo,
    GanttConfig,
    InternalTask,
    Options,
    Task,
    TaskGroup,
    ViewModeDef,
} from './types';
import { deepMerge, generate_id, sanitize } from './utils';
import Bar from './bar';
import EventEmitter from 'eventemitter3';

export default class Gantt extends EventEmitter {
    private _options: Options;
    private _$main_wrapper: HTMLElement;
    private _$svg: SVGGraphicsElement;
    private _$container: HTMLElement;
    private _$side_header: HTMLElement;
    private _task_groups: TaskGroup[];
    private _original_options: Options;
    private _tasks: InternalTask[];
    private _dependency_map: Record<string, string[]>;
    private _$left_sidebar_list_container: HTMLElement;
    private _$left_sidebar_list_fixer_container: HTMLElement;
    private _config: GanttConfig;
    private _gantt_start: Date;
    private _gantt_end: Date;
    private _dates: Date[];
    private _layers: {
        bar: SVGGElement;
        arrow: SVGGElement;
        grid: SVGGraphicsElement;
        progress: SVGGElement;
    };
    private _$extras: HTMLElement;
    private _$adjust: HTMLElement;
    private _grid_height: number;
    private _$header: HTMLElement;
    private _$upper_header: HTMLElement;
    private _$lower_header: HTMLElement;
    private _$current_highlight: HTMLElement;
    private bars: Bar[];
    private current_date: Date;
    private $current: HTMLElement;
    private upperTexts: HTMLElement[];
    private arrows: Arrow[];

    constructor(
        wrapper: HTMLElement | string,
        tasks: Task[],
        options: Options = {},
        task_groups: TaskGroup[] = [],
    ) {
        super();
        this.setup_wrapper(wrapper);
        this.setup_options(options);
        if (this._options.locales) {
            addLocales(this._options.locales);
        }
        this.setup_task_groups(task_groups);
        this.setup_tasks(tasks);
        this.setupEvents();
        this.change_view_mode();
    }

    /**
     * Setup the wrapper
     * @param element
     */
    setup_wrapper(element: HTMLElement | string) {
        let svg_element: SVGGraphicsElement, wrapper_element: HTMLElement;

        let realElement: Element;
        // CSS Selector is passed
        if (typeof element === 'string') {
            let el = document.querySelector(element);
            if (!el) {
                throw new ReferenceError(
                    `CSS selector "${element}" could not be found in DOM`,
                );
            }
            realElement = el;
        } else {
            realElement = element;
        }

        // get the SVGGraphicsElement
        if (realElement instanceof HTMLElement) {
            wrapper_element = realElement;
            svg_element = realElement.querySelector('svg')!;
        } else {
            throw new TypeError(
                'Frappe Gantt only supports usage of a string CSS selector,' +
                    " HTML DOM element or SVG DOM element for the 'element' parameter",
            );
        }

        this._$main_wrapper = this.create_el({
            classes: 'gantt-wrapper',
            append_to: wrapper_element,
        });

        // svg element
        if (!svg_element) {
            // create it
            this._$svg = createSVG('svg', {
                append_to: this._$main_wrapper,
                class: 'gantt',
            });
        } else {
            this._$svg = svg_element;
            this._$svg.classList.add('gantt');
        }

        // wrapper element
        this._$container = this.create_el({
            classes: 'gantt-container',
            append_to: this._$svg.parentElement!,
        });

        this._$container.appendChild(this._$svg);
    }

    /**
     * Merge default options with provided ones
     * @param options
     */
    setup_options(options: Options) {
        this._original_options = options || {};
        const default_copy = { ...DEFAULT_OPTIONS };
        this._options = deepMerge(default_copy, options);
        const CSS_VARIABLES: Record<string, string> = {
            'grid-height': 'container_height',
            'bar-height': 'bar_height',
            'lower-header-height': 'lower_header_height',
            'upper-header-height': 'upper_header_height',
        };
        for (let name in CSS_VARIABLES) {
            let setting = this._options[CSS_VARIABLES[name]];
            if (setting !== 'auto')
                this._$main_wrapper.style.setProperty(
                    '--gv-' + name,
                    setting + 'px',
                );
        }

        if (
            !this._options.scroll_to &&
            this._options.enable_left_sidebar_list
        ) {
            this._options.scroll_to = 'start';
        }
    }

    /**
     * Update options
     * @param options
     */
    update_options(options: Options) {
        this.setup_options({ ...this._original_options, ...options });
        this.change_view_mode(undefined, true);
    }

    /**
     * Updated task groups
     * @param task_groups
     */
    setup_task_groups(task_groups: TaskGroup[]) {
        if (!Array.isArray(task_groups)) {
            throw new TypeError('task_groups must be an array when defined');
        }

        this._task_groups = task_groups;
        this._options.task_groups_enabled = this._task_groups.length > 0;
    }

    /**
     * Setup the tasks
     * @param tasks The tasks
     */
    setup_tasks(tasks: Task[]) {
        this._tasks = tasks
            .map((otask, i) => {
                //@ts-ignore: After is set
                const task: InternalTask = { ...otask };

                if (!task.start) {
                    console.error(
                        gettext('task_no_start_date', this._options.language!, {
                            id: task.id || '',
                        }),
                    );
                    return;
                }

                task._start = date_utils.parse(task.start)!;
                if (task.end) {
                    task._end = date_utils.parse(task.end)!;
                } else if (task.duration !== undefined) {
                    let { duration, scale } = date_utils.parse_duration(
                        task.duration,
                    );
                    task._end = date_utils.add(task._start, duration, scale);
                }

                if (!task._end) {
                    console.error(
                        gettext('task_no_end_date', this._options.language!, {
                            id: task.id || '',
                        }),
                    );
                    return;
                }

                let diff = date_utils.diff(task._end, task._start, 'year');
                if (diff < 0) {
                    console.error(
                        gettext(
                            'task_start_after_end',
                            this._options.language!,
                            {
                                id: task.id || '',
                            },
                        ),
                    );
                    return;
                }

                // make task invalid if duration too large
                if (date_utils.diff(task._end, task._start, 'year') > 10) {
                    console.error(
                        gettext(
                            'task_duration_too_long',
                            this._options.language!,
                            { id: task.id || '' },
                        ),
                    );
                    return;
                }

                const { is_valid, message } = this.cache_index(task, i);
                if (!is_valid) {
                    console.error(message);
                    return;
                }

                // if hours is not set, assume the last day is full day
                // e.g: 2018-09-09 becomes 2018-09-09 23:59:59
                const task_end_values = date_utils.get_date_values(task._end);
                if (task_end_values.slice(3).every((d) => d === 0)) {
                    task._end = date_utils.add(task._end, 24, 'hour');
                }

                // dependencies
                if (
                    typeof task.dependencies === 'string' ||
                    !task.dependencies
                ) {
                    let deps: string[] = [];
                    if (task.dependencies) {
                        deps = task.dependencies
                            .split(',')
                            .map((d) => d.trim().replaceAll(' ', '_'))
                            .filter((d) => d);
                    }
                    task.dependencies = deps;
                }

                // uids
                if (!task.id) {
                    task.id = generate_id(task);
                } else if (typeof task.id === 'string') {
                    task.id = task.id.replaceAll(' ', '_');
                } else {
                    task.id = `${task.id}`;
                }

                return task;
            })
            .filter((t) => !!t);

        this.setup_dependencies();
    }

    cache_index(task: InternalTask, index: number) {
        if (!this._options.task_groups_enabled) {
            // set to default behavior
            task._index = index;
            return { is_valid: true };
        }

        if (!task.task_group_id) {
            return {
                is_valid: false,
                message: `missing "task_group_id" property on task "${task.id}" since "task_groups" are defined`,
            };
        }

        const task_group_index = this._task_groups.findIndex(
            (task_group) => task_group.id === task.task_group_id,
        );
        if (task_group_index < 0) {
            return {
                is_valid: false,
                message: `"task_group_id" not found in "task_groups" for task "${task.id}"`,
            };
        }

        task._index = task_group_index;
        return { is_valid: true };
    }

    setup_dependencies() {
        this._dependency_map = {};
        for (let t of this._tasks) {
            if (t.dependencies)
                for (let d of t.dependencies) {
                    this._dependency_map[d] = this._dependency_map[d] || [];
                    this._dependency_map[d].push(t.id);
                }
        }
    }

    refresh(
        tasks: Task[],
        task_groups: TaskGroup[] = [],
        reset_scroll = false,
    ) {
        this.setup_task_groups(task_groups);
        this.setup_tasks(tasks);
        this.change_view_mode(undefined, !reset_scroll);
    }

    update_task(id: string, new_details: InternalTask) {
        let task = this._tasks.find((t) => t.id === id);
        if (!task) return;

        let bar = this.bars[task._index];
        Object.assign(task, new_details);
        bar.refresh();
    }

    change_view_mode(
        modeName = this._options.view_mode!,
        maintain_pos = false,
    ) {
        const mode = this._options.view_modes_def![modeName];
        let old_pos, old_scroll_op;
        if (maintain_pos) {
            old_pos = this._$container.scrollLeft;
            old_scroll_op = this._options.scroll_to;
            this._options.scroll_to = undefined;
        }
        this._options.view_mode = mode.name;
        //@ts-ignore: changed after
        this._config = {};
        this._config.view_mode = mode;
        this.update_view_scale(mode);
        this.setup_dates(maintain_pos);
        this.render();
        if (maintain_pos) {
            this._$container.scrollLeft = old_pos!;
            this._options.scroll_to = old_scroll_op;
        }

        this.emit('view-change', { mode });
    }

    update_view_scale(mode: ViewModeDef) {
        let { duration, scale } = date_utils.parse_duration(mode.step);
        this._config.step = duration;
        this._config.unit = scale;
        this._config.column_width =
            this._options.column_width || mode.column_width || 45;
        this._$container.style.setProperty(
            '--gv-column-width',
            this._config.column_width + 'px',
        );
        this._config.header_height =
            this._options.lower_header_height! +
            this._options.upper_header_height! +
            10;
    }

    setup_dates(refresh = false) {
        this.setup_gantt_dates(refresh);
        this.setup_date_values();
    }

    setup_gantt_dates(refresh: boolean) {
        let gantt_start, gantt_end;
        if (!this._tasks.length) {
            gantt_start = new Date();
            gantt_end = new Date();
        }

        // custom start/end
        if (this._options.start_date) gantt_start = this._options.start_date;
        if (this._options.end_date) gantt_end = this._options.end_date;

        for (let task of this._tasks) {
            if (!gantt_start || task._start < gantt_start) {
                gantt_start = task._start;
            }
            if (!gantt_end || task._end > gantt_end) {
                gantt_end = task._end;
            }
        }

        gantt_start = date_utils.start_of(gantt_start!, this._config.unit);
        gantt_end = date_utils.start_of(gantt_end!, this._config.unit);

        if (!refresh) {
            let [padding_start, padding_end] = [
                date_utils.parse_duration(this._config.view_mode.padding),
                date_utils.parse_duration(this._config.view_mode.padding),
            ];
            this._gantt_start = date_utils.add(
                gantt_start,
                -padding_start.duration,
                padding_start.scale,
            );
            this._gantt_end = date_utils.add(
                gantt_end,
                padding_end.duration,
                padding_end.scale,
            );
        }
        this._config.date_format = this._config.view_mode.date_format;
        this._gantt_start.setHours(0, 0, 0, 0);
    }

    setup_date_values() {
        let cur_date = this._gantt_start;
        this._dates = [cur_date];

        while (cur_date < this._gantt_end) {
            cur_date = date_utils.add(
                cur_date,
                this._config.step,
                this._config.unit,
            );
            this._dates.push(cur_date);
        }
    }

    setupEvents() {
        let x_on_scroll_start = 0;
        this._$container.addEventListener('scroll', (e) => {
            const target = e.currentTarget as HTMLElement;

            let localBars = [];
            const ids = this.bars.map(({ group }) =>
                group.getAttribute('data-id'),
            );
            let dx;
            if (x_on_scroll_start) {
                dx = target.scrollLeft - x_on_scroll_start;
            }

            // Calculate current scroll position's upper text
            this.current_date = date_utils.add(
                this._gantt_start,
                (target.scrollLeft / this.config.column_width) *
                    this.config.step,
                this.config.unit,
            );

            //@ts-ignore: checked before
            let current_upper = this.config.view_mode.upper_text(
                this.current_date,
                null,
                this.options.language,
            );
            let $el = this.upperTexts.find(
                (el) => el.textContent === current_upper,
            )!;

            // Recalculate for smoother experience
            this.current_date = date_utils.add(
                this._gantt_start,
                ((target.scrollLeft + $el.clientWidth) /
                    this.config.column_width) *
                    this.config.step,
                this.config.unit,
            );

            //@ts-ignore: checked before
            current_upper = this.config.view_mode.upper_text(
                this.current_date,
                null,
                this.options.language,
            );
            $el = this.upperTexts.find(
                (el) => el.textContent === current_upper,
            )!;

            if ($el !== this.$current) {
                if (this.$current)
                    this.$current.classList.remove('current-upper');

                $el.classList.add('current-upper');
                this.$current = $el;
            }

            x_on_scroll_start = target.scrollLeft;
            let [min_start, max_start, max_end] =
                this.get_start_end_positions();

            if (x_on_scroll_start > max_end + 100) {
                this._$adjust.innerHTML = '&larr;';
                this._$adjust.classList.remove('hide');
                this._$adjust.onclick = () => {
                    this._$container.scrollTo({
                        left: max_start,
                        behavior: 'smooth',
                    });
                };
            } else if (
                x_on_scroll_start + target.offsetWidth <
                min_start - 100
            ) {
                this._$adjust.innerHTML = '&rarr;';
                this._$adjust.classList.remove('hide');
                this._$adjust.onclick = () => {
                    this._$container.scrollTo({
                        left: min_start,
                        behavior: 'smooth',
                    });
                };
            } else {
                this._$adjust.classList.add('hide');
            }

            if (dx) {
                localBars = ids.map((id) => this.get_bar(id!)!);
                if (this.options.auto_move_label) {
                    localBars.forEach((bar) => {
                        bar.update_label_position_on_horizontal_scroll({
                            x: dx,
                            sx: target.scrollLeft,
                        });
                    });
                }
            }
        });
    }

    render() {
        this.clear();
        this.setup_layers();
        this.make_grid();
        this.make_dates();
        this.make_grid_extras();
        this.make_bars();
        this.make_arrows();
        this.map_arrows_on_bars();
        this.fill_left_sidebar_list();
        this.set_dimensions();
        this.set_scroll_position(this._options.scroll_to!);
    }

    setup_layers() {
        this._layers = {
            grid: createSVG('g', {
                class: 'grid',
                append_to: this._$svg,
            }) as SVGGElement,
            arrow: createSVG('g', {
                class: 'arrow',
                append_to: this._$svg,
            }) as SVGGElement,
            progress: createSVG('g', {
                class: 'progress',
                append_to: this._$svg,
            }) as SVGGElement,
            bar: createSVG('g', {
                class: 'bar',
                append_to: this._$svg,
            }) as SVGGElement,
        };

        this._$extras = this.create_el({
            classes: 'extras',
            append_to: this._$main_wrapper,
        });
        this._$adjust = this.create_el({
            classes: 'adjust hide',
            append_to: this._$extras,
            type: 'button',
        });
        this._$adjust.innerHTML = '&larr;';
    }

    make_grid() {
        this.make_grid_background();
        this.make_grid_rows();
        this.make_grid_header();
        this.make_left_sidebar_list();
        this.make_side_header();
    }

    make_grid_extras() {
        this.highlight_holidays();
        this.highlight_current();
        this.make_grid_ticks();
    }

    make_grid_background() {
        const grid_width = this._dates.length * this._config.column_width;
        const sidebar_list_items = this._options.task_groups_enabled
            ? this._task_groups
            : this._tasks;
        const grid_height = Math.max(
            this._config.header_height +
                this._options.padding! +
                (this._options.bar_height! + this._options.padding!) *
                    sidebar_list_items.length -
                10,
            this._options.container_height! !== 'auto'
                ? this._options.container_height!
                : 0,
        );

        createSVG('rect', {
            x: 0,
            y: 0,
            width: grid_width,
            height: grid_height,
            class: 'grid-background',
            append_to: this._$svg,
        });

        $.attr(this._$svg, {
            height: grid_height,
            width: '100%',
        });
        this._grid_height = grid_height;
        if (this._options.container_height === 'auto')
            this._$container.style.height = grid_height + 20 + 'px';
    }

    make_grid_rows() {
        const rows_layer = createSVG('g', { append_to: this._layers.grid });

        const row_width = this._dates.length * this._config.column_width;
        const row_height = this._options.bar_height! + this._options.padding!;

        for (
            let y = this._config.header_height;
            y < this._grid_height;
            y += row_height
        ) {
            createSVG('rect', {
                x: 0,
                y,
                width: row_width,
                height: row_height,
                class: 'grid-row',
                append_to: rows_layer,
            });
        }
    }

    make_grid_header() {
        this._$header = this.create_el({
            width: this._dates.length * this._config.column_width,
            classes: 'grid-header',
            append_to: this._$container,
        });
        this._$header.style.zIndex = '' + this._options.base_z_index + 1;

        this._$upper_header = this.create_el({
            classes: 'upper-header',
            append_to: this._$header,
        });
        this._$lower_header = this.create_el({
            classes: 'lower-header',
            append_to: this._$header,
        });
    }

    make_left_sidebar_list() {
        if (!this._options.enable_left_sidebar_list) {
            return;
        }

        this._$left_sidebar_list_fixer_container = this.create_el({
            classes: 'left-sidebar-list-fixer',
            prepend_to: this._$main_wrapper,
        });

        this._$left_sidebar_list_container = this.create_el({
            classes: 'left-sidebar-list',
            append_to: this._$main_wrapper,
        });
        this._$left_sidebar_list_container.style.zIndex =
            '' + this._options.base_z_index + 2;
    }

    make_side_header() {
        this._$side_header = this.create_el({ classes: 'side-header' });
        this._$side_header.style.zIndex = '' + this._options.base_z_index + 1;
        this._$upper_header.prepend(this._$side_header);

        // Create view mode change select
        if (this._options.view_mode_select) {
            const $select = document.createElement('select');
            $select.classList.add('viewmode-select');

            const $el = document.createElement('option');
            $el.selected = true;
            $el.disabled = true;
            $el.textContent = gettext('Mode', this._options.language!);
            $select.appendChild($el);

            for (const name of this._options.view_modes!) {
                const mode = this._options.view_modes_def![name];
                if (!mode) continue;

                const $option = document.createElement('option');
                $option.value = name;
                $option.textContent = gettext(
                    mode.name,
                    this._options.language!,
                );
                if (mode.name === this._config.view_mode.name)
                    $option.selected = true;
                $select.appendChild($option);
            }

            $select.addEventListener('change', () => {
                this.change_view_mode($select.value, true);
            });
            this._$side_header.appendChild($select);
        }

        // Create today button
        if (this._options.today_button) {
            let $today_button = document.createElement('button');
            $today_button.classList.add('today-button');
            $today_button.textContent = gettext(
                'Today',
                this._options.language!,
            );
            $today_button.onclick = this.scroll_current.bind(this);
            this._$side_header.prepend($today_button);
        }
    }

    make_grid_ticks() {
        if (this._options.lines === 'none') return;
        let tick_x = 0;
        let tick_y = this._config.header_height;
        let tick_height = this._grid_height - this._config.header_height;

        let $lines_layer = createSVG('g', {
            class: 'lines_layer',
            append_to: this._layers.grid,
        });

        let row_y = this._config.header_height;

        const row_width = this._dates.length * this._config.column_width;
        const row_height = this._options.bar_height! + this._options.padding!;
        if (this._options.lines !== 'vertical') {
            for (
                let y = this._config.header_height;
                y < this._grid_height;
                y += row_height
            ) {
                createSVG('line', {
                    x1: 0,
                    y1: row_y + row_height,
                    x2: row_width,
                    y2: row_y + row_height,
                    class: 'row-line',
                    append_to: $lines_layer,
                });
                row_y += row_height;
            }
        }
        if (this._options.lines === 'horizontal') return;

        for (let date of this._dates) {
            let tick_class = 'tick';
            if (
                this._config.view_mode.thick_line &&
                this._config.view_mode.thick_line(date)
            ) {
                tick_class += ' thick';
            }

            createSVG('path', {
                d: `M ${tick_x} ${tick_y} v ${tick_height}`,
                class: tick_class,
                append_to: this._layers.grid,
            });

            if (this.view_is('month')) {
                tick_x +=
                    (date_utils.get_days_in_month(date) *
                        this._config.column_width) /
                    30;
            } else if (this.view_is('year')) {
                tick_x +=
                    (date_utils.get_days_in_year(date) *
                        this._config.column_width) /
                    365;
            } else {
                tick_x += this._config.column_width;
            }
        }
    }

    highlight_holidays() {
        let labels = {};
        if (!this._options.holidays) return;

        for (let color in this._options.holidays) {
            let fnHighlight;
            let check_highlight = this._options.holidays[color];
            if (check_highlight === 'weekend') {
                fnHighlight = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
            } else {
                for (let hi of check_highlight) {
                    let dateObj = new Date(hi.date + ' ');
                    fnHighlight = (d: Date) =>
                        dateObj.getTime() === d.getTime();
                    //@ts-ignore: To fix
                    labels[dateObj] = check_highlight.name;
                }
            }

            // highlight holidays
            for (
                let d = new Date(this._gantt_start);
                d <= this._gantt_end;
                d.setDate(d.getDate() + 1)
            ) {
                if (fnHighlight && fnHighlight(d)) {
                    const x =
                        (date_utils.diff(
                            d,
                            this._gantt_start,
                            this._config.unit,
                        ) /
                            this._config.step) *
                        this._config.column_width;
                    const height =
                        this._grid_height - this._config.header_height;

                    const bar_holiday = createSVG('rect', {
                        x: Math.round(x),
                        y: this._config.header_height,
                        width:
                            this._config.column_width /
                            date_utils.convert_scales(
                                this._config.view_mode.step,
                                'day',
                            ),
                        height,
                        style: `fill: ${color};`,
                        append_to: this._layers.grid,
                    });

                    //@ts-ignore: To fix
                    if (d && labels[d]) {
                        // this means is a holiday
                        //@ts-ignore: To fix
                        bar_holiday.setAttribute('label', labels[d]);
                        bar_holiday.setAttribute(
                            'date',
                            date_utils.format(
                                d,
                                'YYYY-MM-DD',
                                this._options.language,
                            ),
                        );
                        bar_holiday.classList.add('holiday-highlight');
                    }
                }
            }
        }
    }

    /**
     * Compute the horizontal x-axis distance and associated date for the current date and view.
     *
     * @returns Object containing the x-axis distance and date of the current date, or null if the current date is out of the gantt range.
     */
    highlight_current() {
        const res = this.get_closest_date();
        if (!res) return;

        const { el } = res;
        el.classList.add('current-date-highlight');

        const diff_in_units = date_utils.diff(
            new Date(),
            this._gantt_start,
            this.config.unit,
        );

        const left =
            (diff_in_units / this.config.step) * this.config.column_width;

        this._$current_highlight = this.create_el({
            top: this.config.header_height,
            left,
            height: this._grid_height - this.config.header_height,
            classes: 'current-highlight',
            append_to: this._$container,
        });
        this.create_el({
            top: this.config.header_height - 6,
            left: left - 2.5,
            width: 6,
            height: 6,
            classes: 'current-ball-highlight',
            append_to: this._$header,
        });
    }

    create_el({
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

    make_dates() {
        this.get_dates_to_draw().forEach((date, i) => {
            if (date.lower_text) {
                let $lower_text = this.create_el({
                    left: date.x,
                    top: date.lower_y,
                    classes: 'lower-text date_' + sanitize(date.formatted_date),
                    append_to: this._$lower_header,
                });
                $lower_text.innerText = date.lower_text;
            }

            if (date.upper_text) {
                let $upper_text = this.create_el({
                    left: date.x,
                    top: date.upper_y,
                    classes: 'upper-text',
                    append_to: this._$upper_header,
                });
                $upper_text.innerText = date.upper_text;
            }
        });
        this.upperTexts = Array.from(
            this._$container.querySelectorAll('.upper-text'),
        );
    }

    get_dates_to_draw() {
        let last_date_info: DateInfo | undefined = undefined;
        const dates = this._dates.map((date, i) => {
            const d = this.get_date_info(date, last_date_info);
            last_date_info = d;
            return d;
        });
        return dates;
    }

    get_date_info(date: Date, last_date_info?: DateInfo): DateInfo {
        let last_date = last_date_info ? last_date_info.date : null;

        const x = last_date_info
            ? last_date_info.x + last_date_info.column_width
            : 0;

        let upper_text = this._config.view_mode.upper_text;
        let lower_text = this._config.view_mode.lower_text;

        if (!upper_text) {
            this._config.view_mode.upper_text = () => '';
        } else if (typeof upper_text === 'string') {
            this._config.view_mode.upper_text = (date: Date) =>
                date_utils.format(date, upper_text, this._options.language);
        }

        if (!lower_text) {
            this._config.view_mode.lower_text = () => '';
        } else if (typeof lower_text === 'string') {
            this._config.view_mode.lower_text = (date: Date) =>
                date_utils.format(date, lower_text, this._options.language);
        }

        return {
            date,
            formatted_date: sanitize(
                date_utils.format(
                    date,
                    this._config.date_format,
                    this._options.language,
                ),
            ),
            column_width: this._config.column_width,
            x,
            //@ts-ignore: i've lready check
            upper_text: this._config.view_mode.upper_text(
                date,
                last_date,
                this._options.language,
            ),
            //@ts-ignore: i've lready check
            lower_text: this._config.view_mode.lower_text(
                date,
                last_date,
                this._options.language,
            ),
            upper_y: 17,
            lower_y: this._options.upper_header_height! + 5,
        };
    }

    fill_left_sidebar_list() {
        if (!this._options.enable_left_sidebar_list) {
            return;
        }

        const sidebar_list_items = this._options.task_groups_enabled
            ? this._task_groups
            : this._tasks;

        sidebar_list_items.forEach((item, index) => {
            const row = this.create_el({
                classes: 'left-sidebar-list-row',
                append_to: this._$left_sidebar_list_container,
            });
            row.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    ${item.thumbnail ? `<img class="left-sidebar-list-img" src="${item.thumbnail}" alt="${item.name}"/> ` : ''}
                    <span>${item.name}</span>
                </div>
            `;

            row.style.height =
                this._options.bar_height! + this._options.padding! + 'px';
        });

        // add empty row for cover little empty row from grid
        const emptyRow = this.create_el({
            classes: 'left-sidebar-list-row',
            append_to: this._$left_sidebar_list_container,
        });

        // adding -1 to remove unnecessary scroll
        emptyRow.style.height = -1 + this._options.padding! / 2 + 'px';
    }

    make_bars() {
        this.bars = this._tasks.map((task) => {
            const bar = new Bar(this, task);
            this._layers.bar.appendChild(bar.group);
            return bar;
        });
    }

    make_arrows() {
        this.arrows = [];
        for (let task of this._tasks) {
            let arrows = [];
            arrows = task.dependencies
                .map((task_id) => {
                    const dependency = this.get_task(task_id);
                    if (!dependency) return;
                    const arrow = new Arrow(
                        this,
                        this.bars[dependency._index], // from_task
                        this.bars[task._index], // to_task
                    );
                    this._layers.arrow.appendChild(arrow.element);
                    return arrow;
                })
                .filter((a) => !!a); // filter falsy values
            this.arrows = this.arrows.concat(arrows);
        }
    }

    map_arrows_on_bars() {
        for (let bar of this.bars) {
            bar.setArrows(
                this.arrows.filter((arrow) => {
                    return (
                        arrow.fromTask.task.id === bar.task.id ||
                        arrow.toTask.task.id === bar.task.id
                    );
                }),
            );
        }
    }

    set_dimensions() {
        const { width: cur_width } = this._$svg.getBoundingClientRect();
        const actual_width = this._$svg.querySelector('.grid .grid-row')
            ? this._$svg.querySelector('.grid .grid-row')!.getAttribute('width')
            : '0';
        if (cur_width < parseInt(actual_width!)) {
            this._$svg.setAttribute('width', actual_width!);
        }
    }

    set_scroll_position(date: 'start' | 'end' | 'today' | string | Date) {
        if (!date || date === 'start') {
            date = this._gantt_start;
        } else if (date === 'end') {
            date = this._gantt_end;
        } else if (date === 'today') {
            return this.scroll_current();
        } else if (typeof date === 'string') {
            date = date_utils.parse(date)!;
        }

        // Weird bug where infinite padding results in one day offset in scroll
        // Related to header-body displacement
        const units_since_first_task = date_utils.diff(
            date,
            this._gantt_start,
            this._config.unit,
        );
        const scroll_pos =
            (units_since_first_task / this._config.step) *
            this._config.column_width;

        this._$container.scrollTo({
            left: scroll_pos - this._config.column_width / 6,
            behavior: 'smooth',
        });

        // Calculate current scroll position's upper text
        if (this.$current) {
            this.$current.classList.remove('current-upper');
        }

        this.current_date = date_utils.add(
            this._gantt_start,
            this._$container.scrollLeft / this._config.column_width,
            this._config.unit,
        );
        //@ts-ignore: i've lready check
        let current_upper = this._config.view_mode.upper_text(
            this.current_date,
            null,
            this._options.language,
        );
        let $el = this.upperTexts.find(
            (el) => el.textContent === current_upper,
        )!;

        // Recalculate
        this.current_date = date_utils.add(
            this._gantt_start,
            (this._$container.scrollLeft + $el.clientWidth) /
                this._config.column_width,
            this._config.unit,
        );
        //@ts-ignore: i've lready check
        current_upper = this._config.view_mode.upper_text(
            this.current_date,
            null,
            this._options.language,
        );
        $el = this.upperTexts.find((el) => el.textContent === current_upper)!;
        $el.classList.add('current-upper');
        this.$current = $el;
    }

    scroll_current() {
        let res = this.get_closest_date();
        if (res) this.set_scroll_position(res.date);
    }

    get_closest_date() {
        let now = new Date();
        if (now < this._gantt_start || now > this._gantt_end) return null;

        let current = new Date(),
            el = this._$container.querySelector(
                '.date_' +
                    sanitize(
                        date_utils.format(
                            current,
                            this._config.date_format,
                            this._options.language,
                        ),
                    ),
            );

        // safety check to prevent infinite loop
        let c = 0;
        while (!el && c < this._config.step) {
            current = date_utils.add(current, -1, this._config.unit);
            el = this._$container.querySelector(
                '.date_' +
                    sanitize(
                        date_utils.format(
                            current,
                            this._config.date_format,
                            this._options.language,
                        ),
                    ),
            );
            c++;
        }
        return {
            date: new Date(
                date_utils.format(
                    current,
                    this._config.date_format,
                    this._options.language,
                ) + ' ',
            ),
            el: el!,
        };
    }

    get_start_end_positions() {
        if (!this.bars.length) return [0, 0, 0];
        let { x, width } = this.bars[0].group.getBBox();
        let min_start = x;
        let max_start = x;
        let max_end = x + width;
        Array.prototype.forEach.call(this.bars, function ({ group }, i) {
            let { x, width } = group.getBBox();
            if (x < min_start) min_start = x;
            if (x > max_start) max_start = x;
            if (x + width > max_end) max_end = x + width;
        });
        return [min_start, max_start, max_end];
    }

    get_all_dependent_tasks(task_id: string) {
        let out: string[] = [];
        let to_process = [task_id];
        while (to_process.length) {
            const deps = to_process.reduce((acc, curr) => {
                acc = acc.concat(this._dependency_map[curr]);
                return acc;
            }, [] as string[]);

            out = out.concat(deps);
            to_process = deps.filter((d) => !to_process.includes(d));
        }

        return out.filter(Boolean);
    }

    view_is(mode: string) {
        return this._config.view_mode.name === mode;
    }

    get_task(id: string) {
        return this._tasks.find((task) => {
            return task.id === id;
        });
    }

    get_bar(id: string) {
        return this.bars.find((bar) => {
            return bar.task.id === id;
        });
    }

    get_task_group_for_task(task: Task) {
        return this._task_groups.find(
            (task_group) => task_group.id === task.task_group_id,
        );
    }

    /**
     * Clear all elements from the parent svg element
     *
     * @memberof Gantt
     */
    clear() {
        this._$svg.innerHTML = '';
        this._$header?.remove?.();
        this._$side_header?.remove?.();
        this._$current_highlight?.remove?.();
        this._$extras?.remove?.();
        this._$left_sidebar_list_fixer_container?.remove?.();
        this._$left_sidebar_list_container?.remove?.();
    }

    get options() {
        return this._options;
    }

    get config() {
        return this._config;
    }

    get container() {
        return this._$container;
    }

    get ganttStart() {
        return this._gantt_start;
    }
}

export { DEFAULT_OPTIONS };
