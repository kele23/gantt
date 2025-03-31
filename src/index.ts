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
    ScrollPosition,
    Task,
    TaskGroup,
    ViewModeDef,
} from './types';
import { deepMerge, generate_id, sanitize } from './utils';
import Bar from './bar';
import EventEmitter from 'eventemitter3';

class Gantt extends EventEmitter {
    private _options: Options;
    private _$main_wrapper: HTMLElement;
    private _$svg: SVGGraphicsElement;
    private _$container: HTMLElement;
    private _$side_header: HTMLElement;
    private _task_groups: TaskGroup[];
    private _tasks: InternalTask[];
    private _dependency_map: Record<string, string[]>;
    private _$sidebar: SVGGElement;
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
    private _$colHighlighter: SVGRectElement;
    private _$header: HTMLElement;
    private _$upper_header: HTMLElement;
    private _$lower_header: HTMLElement;
    private bars: Bar[];
    private current_date_start: Date;
    private $current: HTMLElement;
    private upperTexts: HTMLElement[];
    private arrows: Arrow[];
    private _$rowHighlighter: SVGRectElement;
    private _stickyTimeout: any;
    private _$datesHighlighter: SVGRectElement;
    current_date: Date;

    constructor(
        wrapper: HTMLElement | string,
        tasks: Task[],
        options: Options = {},
        task_groups: TaskGroup[] = [],
    ) {
        super();
        //@ts-ignore: After is initialized
        this._config = {};
        this._setup_wrapper(wrapper);
        this._setup_options(options);
        if (this._options.locales) {
            addLocales(this._options.locales);
        }
        this._setup_task_groups(task_groups);
        this._setup_tasks(tasks);
        this._setupEvents();
    }

    /**
     * Setup the wrapper
     * @param element
     */
    private _setup_wrapper(element: HTMLElement | string) {
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

        this._$main_wrapper = this._create_el({
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
        this._$container = this._create_el({
            classes: 'gantt-container',
            append_to: this._$svg.parentElement!,
        });

        this._$container.appendChild(this._$svg);
    }

    /**
     * Merge default options with provided ones
     * @param options
     */
    private _setup_options(options: Options) {
        const default_copy = { ...DEFAULT_OPTIONS };
        this._options = deepMerge(default_copy, options);
        const CSS_VARIABLES: Record<string, string> = {
            'bar-height': 'bar_height',
            'lower-header-height': 'lower_header_height',
            'upper-header-height': 'upper_header_height',
        };
        for (let name in CSS_VARIABLES) {
            //@ts-ignore: i know
            let setting = this._options[CSS_VARIABLES[name]];
            if (setting !== 'auto')
                this._$main_wrapper.style.setProperty(
                    '--gv-' + name,
                    setting + 'px',
                );
        }
    }

    /**
     * Updated task groups
     * @param task_groups
     */
    private _setup_task_groups(task_groups: TaskGroup[]) {
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
    private _setup_tasks(tasks: Task[]) {
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

                task._start = task.start;
                if (task.end) {
                    task._end = task.end;
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

                const { is_valid, message } = this._cache_index(task, i);
                if (!is_valid) {
                    console.error(message);
                    return;
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

        this._setup_dependencies();
    }

    private _cache_index(task: InternalTask, index: number) {
        if (!this._options.task_groups_enabled) {
            // set to default behavior
            task._index = index;
            return { is_valid: true };
        }

        if (!task.task_group_key) {
            return {
                is_valid: false,
                message: `missing "task_group_key" property on task "${task.id}" since "task_groups" are defined`,
            };
        }

        const task_group_index = this._task_groups.findIndex(
            (task_group) => task_group.key === task.task_group_key,
        );
        if (task_group_index < 0) {
            return {
                is_valid: false,
                message: `"task_group_key" not found in "task_groups" for task "${task.id}"`,
            };
        }

        task._index = task_group_index;
        return { is_valid: true };
    }

    private _setup_dependencies() {
        this._dependency_map = {};
        for (let t of this._tasks) {
            if (t.dependencies)
                for (let d of t.dependencies) {
                    this._dependency_map[d] = this._dependency_map[d] || [];
                    this._dependency_map[d].push(t.id);
                }
        }
    }

    /**
     * Update options
     * @param options
     */
    update_options(options: Options) {
        this._setup_options(options);
    }

    refresh(tasks: Task[], task_groups: TaskGroup[] = []) {
        this._setup_task_groups(task_groups);
        this._setup_tasks(tasks);
    }

    update_task(id: string, new_details: InternalTask) {
        let task = this._tasks.find((t) => t.id === id);
        if (!task) return;

        let bar = this.bars[task._index];
        Object.assign(task, new_details);
        bar.refresh();
    }

    changeViewMode(modeName = 'day', currentScroll: ScrollPosition = 'today') {
        const mode = this._options.view_modes_def![modeName];
        if (!mode) throw new Error('Invalid view mode');

        this.config.view_mode_name = modeName;
        this.config.view_mode = mode;

        this._update_view_scale(mode);
        this._setup_dates();
        this._render(currentScroll);

        this.emit('view-change', { mode });
    }

    getCurrentViewMode(): string {
        return this.config.view_mode_name;
    }

    getCurrentDate(): Date | undefined {
        return this.current_date;
    }

    isHighlightingDates() {
        return !!this.config?.highlightStart;
    }

    highlightDates(startDate: Date, endDate: Date) {
        // set highlighting dates
        this.config.highlightStart = startDate;
        this.config.highlightEnd = endDate;
        this._$datesHighlighter.classList.remove('tw:hidden');

        // get start position
        const leftStartDiff = date_utils.diff(
            startDate,
            this._gantt_start,
            this.config.unit,
        );
        const startLeft =
            (leftStartDiff / this.config.step) * this.config.column_width;

        // get duration
        let duration =
            date_utils.diff(endDate, startDate, this.config.unit) /
            this.config.step;
        switch (this.config.unit) {
            case 'day':
            case 'hour':
                duration += 1; // add 1 day or hour in day/hour view
                break;
        }

        // set attributes
        this._$datesHighlighter.setAttribute('x', `${startLeft}`);
        this._$datesHighlighter.setAttribute(
            'width',
            `${duration * this.config.column_width}`,
        );
    }

    resetHighlightDates() {
        this.config.highlightStart = undefined;
        this.config.highlightEnd = undefined;
        this._$datesHighlighter.classList.add('tw:hidden');
    }

    private _update_view_scale(mode: ViewModeDef) {
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

    private _setup_dates() {
        this._setup_gantt_dates();
        this._setup_date_values();
    }

    private _setup_gantt_dates() {
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

        this._config.date_format = this._config.view_mode.date_format;
        this._gantt_start.setHours(0, 0, 0, 0);
    }

    private _setup_date_values() {
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

    private _setupEvents() {
        let lastScrollX = 0;
        this._$container.addEventListener('scroll', (e) => {
            const target = e.currentTarget as HTMLElement;

            // Calculate current scroll position's upper text
            this.current_date_start = date_utils.add(
                this._gantt_start,
                (target.scrollLeft / this.config.column_width) *
                    this.config.step,
                this.config.unit,
            );

            // calculate center position date
            const centerPos =
                ((target.scrollLeft + this._$container.clientWidth / 2) /
                    this.config.column_width) *
                this.config.step;
            this.current_date = date_utils.add(
                this._gantt_start,
                centerPos,
                this.config.unit,
            );

            //@ts-ignore: checked before
            let current_upper = this.config.view_mode.upper_text(
                this.current_date_start,
                null,
                this.options.language,
            );
            let $el = this.upperTexts.find(
                (el) => el.textContent === current_upper,
            )!;

            // Recalculate for smoother experience
            this.current_date_start = date_utils.add(
                this._gantt_start,
                ((target.scrollLeft + $el.clientWidth) /
                    this.config.column_width) *
                    this.config.step,
                this.config.unit,
            );

            //@ts-ignore: checked before
            current_upper = this.config.view_mode.upper_text(
                this.current_date_start,
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

            let x_on_scroll_start = target.scrollLeft;
            let [min_start, max_end] = this._get_start_end_positions();

            if (x_on_scroll_start > max_end + 100) {
                this._$adjust.innerHTML = '&larr;';
                this._$adjust.classList.remove('tw:hidden');
                this._$adjust.onclick = () => {
                    this.setScrollPosition('max', 'smooth');
                };
            } else if (
                x_on_scroll_start + target.offsetWidth <
                min_start - 100
            ) {
                this._$adjust.innerHTML = '&rarr;';
                this._$adjust.classList.remove('tw:hidden');
                this._$adjust.onclick = () => {
                    this.setScrollPosition('min', 'smooth');
                };
            } else {
                this._$adjust.classList.add('tw:hidden');
            }

            // handle text move during scroll
            let dx;
            if (x_on_scroll_start) dx = target.scrollLeft - x_on_scroll_start;

            if (this.options.auto_move_label && dx) {
                let localBars = [];
                const ids = this.bars.map(({ group }) =>
                    group.getAttribute('data-id'),
                );
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

            // sticky sidebar
            if (lastScrollX != target.scrollLeft) {
                if (this._stickyTimeout) clearTimeout(this._stickyTimeout);
                this._$sidebar.setAttribute('opacity', '0');
                this._stickyTimeout = setTimeout(() => {
                    this._$sidebar.setAttribute('opacity', '1');
                    this._$sidebar?.setAttribute(
                        'transform',
                        `translate(${this._$container.scrollLeft}, 0)`,
                    );
                }, 200);
            }

            lastScrollX = target.scrollLeft;
        });

        /**
         * COL Highlighter
         */
        this._$svg.addEventListener(
            'mousemove',
            (e) => {
                const target = e.target as SVGGraphicsElement;

                // handle col highlight
                this._$colHighlighter.classList.remove('tw:opacity-0');
                const rect = this._$container.getBoundingClientRect();
                const x = e.clientX - rect.left + this._$container.scrollLeft;

                const p =
                    Math.floor(x / this.config.column_width) *
                    this.config.column_width;
                this._$colHighlighter.setAttribute('x', `${p}`);

                // handle row highlight
                const row = target.closest('.gantt-sidebar-row') as SVGElement;
                if (row) {
                    const y = row.getY();
                    this._$rowHighlighter?.classList.remove('tw:opacity-0');
                    this._$rowHighlighter?.setAttribute('y', `${y}`);
                } else {
                    this._$rowHighlighter?.classList.add('tw:opacity-0');
                }
            },
            { passive: true },
        );
        this._$svg.addEventListener(
            'mouseleave',
            (e) => {
                const target = e.target as SVGGraphicsElement;

                this._$colHighlighter.classList.add('tw:opacity-0');

                const row = target.closest('.gantt-sidebar-row');
                if (!row) this._$rowHighlighter?.classList.add('tw:opacity-0');
            },
            { passive: true },
        );
    }

    private _render(currentScroll: ScrollPosition) {
        this.clear();
        this._setup_layers();
        this._make_grid();
        this._make_dates();
        this._make_grid_extras();
        this._make_bars();
        this._make_arrows();
        this._map_arrows_on_bars();
        this._fill_left_sidebar_list();
        this._set_dimensions();
        this.setScrollPosition(currentScroll);
    }

    private _setup_layers() {
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

        this._$extras = this._create_el({
            classes: 'extras',
            append_to: this._$main_wrapper,
        });
        this._$adjust = this._create_el({
            classes: 'adjust tw:hide',
            append_to: this._$extras,
            type: 'button',
        });
        this._$adjust.innerHTML = '&larr;';
    }

    private _make_grid() {
        this._make_grid_background();
        this._make_grid_rows();
        this._make_grid_header();
        this._make_side_header();
    }

    private _make_grid_extras() {
        this._highlight_holidays();
        this._highlight_current();
        this._make_grid_highlighter();
        this._make_grid_ticks();
    }

    private _make_grid_background() {
        const grid_width = this._dates.length * this._config.column_width;
        const sidebar_list_items = this._options.task_groups_enabled
            ? this._task_groups
            : this._tasks;

        // set container height
        if (typeof this._options.container_height! != 'string')
            this._$container.style.height =
                this._options.container_height! + 'px';
        else this._$container.style.height = this._options.container_height!;

        const realContainerHeight = this._$container.clientHeight - 20;

        const grid_height = Math.max(
            this._config.header_height +
                this._options.padding! +
                (this._options.bar_height! + this._options.padding!) *
                    sidebar_list_items.length -
                10,
            realContainerHeight,
        );
        this._grid_height = grid_height;

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
    }

    private _make_grid_rows() {
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

    private _make_grid_header() {
        this._$header = this._create_el({
            width: this._dates.length * this._config.column_width,
            classes: 'grid-header',
            append_to: this._$container,
        });

        this._$upper_header = this._create_el({
            classes: 'upper-header',
            append_to: this._$header,
        });
        this._$lower_header = this._create_el({
            classes: 'lower-header',
            append_to: this._$header,
        });
    }

    private _make_side_header() {
        this._$side_header = this._create_el({ classes: 'side-header' });
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
                if (mode.name === this._config.view_mode_name)
                    $option.selected = true;
                $select.appendChild($option);
            }

            $select.addEventListener('change', () => {
                this.changeViewMode(
                    $select.value,
                    this.current_date || 'today',
                );
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
            $today_button.onclick = () => {
                this.setScrollPosition('today', 'smooth');
            };
            this._$side_header.prepend($today_button);
        }
    }

    private _make_grid_ticks() {
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

            if (this._view_is('month')) {
                tick_x +=
                    (date_utils.get_days_in_month(date) *
                        this._config.column_width) /
                    30;
            } else if (this._view_is('year')) {
                tick_x +=
                    (date_utils.get_days_in_year(date) *
                        this._config.column_width) /
                    365;
            } else {
                tick_x += this._config.column_width;
            }
        }
    }

    private _make_grid_highlighter() {
        this._$colHighlighter = createSVG('rect', {
            x: 0,
            y: 0,
            width: this._config.column_width,
            height: '100%',
            class: 'tw:fill-gray-100 tw:opacity-0',
            append_to: this._layers.grid,
        }) as SVGRectElement;

        this._$rowHighlighter = createSVG('rect', {
            x: 0,
            y: 0,
            width: '100%',
            height: this._options.bar_height! + this._options.padding!,
            class: 'tw:fill-gray-100 tw:opacity-0',
            append_to: this._layers.grid,
        }) as SVGRectElement;

        this._$datesHighlighter = createSVG('rect', {
            x: 0,
            y: 0,
            width: this._config.column_width,
            height: '100%',
            class: 'tw:fill-green-100 tw:hidden',
            append_to: this._layers.grid,
        }) as SVGRectElement;

        if (this.config.highlightStart) {
            this.highlightDates(
                this.config.highlightStart,
                this.config.highlightEnd!,
            );
        }
    }

    private _highlight_holidays() {
        let labels = {};
        if (!this._options.holidays) return;

        for (let color in this._options.holidays) {
            let fnHighlight;
            let check_highlight = this._options.holidays[color];
            if (check_highlight === 'weekend') {
                fnHighlight = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
            } else {
                for (let hi of check_highlight) {
                    let dateObj = hi.date;
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
    private _highlight_current() {
        const { el } = this._get_closest_date(new Date());
        el.classList.add('current-date-highlight');

        const diff_in_units = date_utils.diff(
            new Date(),
            this._gantt_start,
            this.config.unit,
        );

        const left =
            (diff_in_units / this.config.step) * this.config.column_width;

        createSVG('rect', {
            y: 0,
            x: left,
            height: '100%',
            width: 1,
            append_to: this._$svg,
            fill: '#000000',
        });
    }

    private _create_el({
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

    private _make_dates() {
        this._get_dates_to_draw().forEach((date) => {
            if (date.lower_text) {
                let $lower_text = this._create_el({
                    left: date.x,
                    top: date.lower_y,
                    classes: 'lower-text date_' + sanitize(date.formatted_date),
                    append_to: this._$lower_header,
                });
                $lower_text.innerText = date.lower_text;
            }

            if (date.upper_text) {
                let $upper_text = this._create_el({
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

    private _get_dates_to_draw() {
        let last_date_info: DateInfo | undefined = undefined;
        const dates = this._dates.map((date) => {
            const d = this._get_date_info(date, last_date_info);
            last_date_info = d;
            return d;
        });
        return dates;
    }

    private _get_date_info(date: Date, last_date_info?: DateInfo): DateInfo {
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

    private _fill_left_sidebar_list() {
        if (
            !this._options.enable_left_sidebar_list ||
            !this._options.task_groups_enabled
        ) {
            return;
        }

        // make sidebar
        this._$sidebar = createSVG('g', {
            append_to: this._$svg,
        });

        const width = this._options.sidebar_config!.sidebar_width!;
        const height = this._options.bar_height! + this._options.padding!;

        // full sidebar rect
        createSVG('rect', {
            x: 0,
            y: 0,
            width: width,
            height: '100%',
            append_to: this._$sidebar,
            class: 'tw:fill-white tw:drop-shadow-sm',
        });

        // make rows
        const sidebar_list_items = this._task_groups;
        sidebar_list_items.forEach((item, index) => {
            const y = this._config.header_height + index * height;

            const innerHtml = this._options.sidebar_config?.get_label
                ? this._options.sidebar_config?.get_label(item)
                : item.name;

            const obj = createSVG('foreignObject', {
                x: 0,
                y: y,
                width: width,
                height: height,
                innerHTML: innerHtml,
                class: 'gantt-sidebar-row tw:border-b tw:border-gray-100',
                append_to: this._$sidebar,
            });

            // bind click event
            obj.addEventListener('click', () => {
                this.emit('side-click', { group: item });
            });
        });
    }

    private _make_bars() {
        this.bars = this._tasks.map((task) => {
            const bar = new Bar(this, task);
            this._layers.bar.appendChild(bar.group);
            return bar;
        });
    }

    private _make_arrows() {
        this.arrows = [];
        for (let task of this._tasks) {
            let arrows = [];
            arrows = task.dependencies
                .map((task_id) => {
                    const dependency = this._get_task(task_id);
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

    private _map_arrows_on_bars() {
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

    private _set_dimensions() {
        const { width: cur_width } = this._$svg.getBoundingClientRect();
        const actual_width = this._$svg.querySelector('.grid .grid-row')
            ? this._$svg.querySelector('.grid .grid-row')!.getAttribute('width')
            : '0';
        if (cur_width < parseInt(actual_width!)) {
            this._$svg.setAttribute('width', actual_width!);
        }
    }

    setScrollPosition(
        nDate: 'start' | 'end' | 'today' | 'max' | 'min' | Date,
        behavior: 'auto' | 'instant' | 'smooth' = 'instant',
    ) {
        let date = this._gantt_start;

        if (nDate === 'start') {
            date = this._gantt_start;
        } else if (nDate === 'end') {
            date = this._gantt_end;
        } else if (nDate === 'today') {
            let { date: d } = this._get_closest_date(new Date());
            date = d;
        } else if (nDate == 'max') {
            const max = Math.max(
                ...this._tasks.map((item) => item._end.getTime()),
            );
            date = new Date(max);
        } else if (nDate == 'min') {
            const min = Math.min(
                ...this._tasks.map((item) => item._end.getTime()),
            );
            date = new Date(min);
        } else if (date <= this._gantt_end && date >= this._gantt_start) {
            date = nDate;
        }

        let left = this._getScrollByDate(date);
        this._$container.scrollTo({
            left,
            behavior,
        });
    }

    private _getScrollByDate(date: Date) {
        const units_since_first_task = date_utils.diff(
            date,
            this._gantt_start,
            this._config.unit,
        );
        const scroll_pos =
            (units_since_first_task / this._config.step) *
            this._config.column_width;

        let left =
            scroll_pos -
            this._config.column_width / 6 -
            this._$container.offsetWidth / 2;
        if (left < 0) left = 0;
        if (left > this._$container.scrollWidth)
            left = this._$container.scrollWidth;
        return left;
    }

    private _get_closest_date(date: Date) {
        if (date < this._gantt_start || date > this._gantt_end) {
            throw new Error('Invalid date');
        }

        let current = new Date(date);
        let el = this._$container.querySelector(
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
            date: current,
            el: el!,
        };
    }

    private _get_start_end_positions() {
        if (!this.bars.length) return [0, 0, 0];
        let { x, width } = this.bars[0].group.getBBox();
        let min_start = x;
        let max_start = x;
        let max_end = x + width;

        this.bars.forEach(({ group }) => {
            let { x, width } = group.getBBox();
            if (x < min_start) min_start = x;
            if (x > max_start) max_start = x;
            if (x + width > max_end) max_end = x + width;
        });
        return [min_start, max_start, max_end];
    }

    private _view_is(mode: string) {
        return this._config.view_mode_name === mode;
    }

    private _get_task(id: string) {
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
            (task_group) => task_group.key === task.task_group_key,
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
        this._$extras?.remove?.();
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

export { Gantt, DEFAULT_OPTIONS, date_utils };
export * from './types';
