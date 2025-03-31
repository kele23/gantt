import { Gantt } from '.';
import Arrow from './arrow';
import date_utils from './date_utils';
import { animateSVG, createSVG } from './svg_utils';
import { InternalTask } from './types';

export default class Bar {
    private _gantt: Gantt;
    private _task: InternalTask;
    private _bar_group: SVGGElement;
    private _handle_group: SVGGElement;
    private _group: SVGGElement;
    private _name: string;
    private _height: number;
    private _image_size: number;
    private _width: number;
    private _corner_radius: number;
    private _duration: number;
    private _$bar: SVGGraphicsElement;
    private _x: number;
    private _y: number;
    private _$date_highlight: HTMLElement;
    private _arrows: Arrow[];

    constructor(gantt: Gantt, task: InternalTask) {
        this.set_defaults(gantt, task);
        this.prepare_wrappers();
        this.refresh();
    }

    refresh() {
        this._bar_group.innerHTML = '';
        this._handle_group.innerHTML = '';
        if (this._task.custom_class) {
            this._group.classList.add(this._task.custom_class);
        } else {
            this._group.classList.remove(...this._group.classList);
            this._group.classList.add('bar-wrapper');
        }

        this.prepare_values();
        this.draw();
    }

    set_defaults(gantt: Gantt, task: InternalTask) {
        this._gantt = gantt;
        this._task = task;
        this._name = this._name || '';
    }

    prepare_wrappers() {
        this._group = createSVG('g', {
            class:
                'bar-wrapper' +
                (this._task.custom_class ? ' ' + this._task.custom_class : ''),
            'data-id': this._task.id,
        }) as SVGGElement;
        this._bar_group = createSVG('g', {
            class: 'bar-group',
            append_to: this._group,
        }) as SVGGElement;
        this._handle_group = createSVG('g', {
            class: 'handle-group',
            append_to: this._group,
        }) as SVGGElement;
    }

    prepare_values() {
        this._height = this._gantt.options.bar_height!;
        this._image_size = this._height - 5;
        this._task._start = new Date(this._task._start);
        this._task._end = new Date(this._task._end);
        this.compute_x();
        this.compute_y();
        this.compute_duration();
        this._corner_radius = this._gantt.options.bar_corner_radius!;
        this._width = this._gantt.config.column_width * this._duration;
        if (!this._task.progress || this._task.progress < 0)
            this._task.progress = 0;
        if (this._task.progress > 100) this._task.progress = 100;
    }

    draw() {
        this.draw_bar();
        this.draw_label();

        if (this._task.thumbnail) {
            this.draw_thumbnail();
        }

        // bind click event
        this._$bar.addEventListener('click', () => {
            this._gantt.emit('bar-click', { task: this._task });
        });
    }

    draw_bar() {
        this._$bar = createSVG('rect', {
            x: this._x,
            y: this._y,
            width: this._width,
            height: this._height,
            rx: this._corner_radius,
            ry: this._corner_radius,
            class: 'bar',
            append_to: this._bar_group,
        });
        if (this._task.color) this._$bar.style.fill = this._task.color;
        animateSVG(this._$bar, 'width', 0, this._width);

        if (this._task.invalid) {
            this._$bar.classList.add('bar-invalid');
        }
    }

    draw_label() {
        let x_coord = this._x + this._$bar.getWidth() / 2;

        if (this._task.thumbnail) {
            x_coord = this._x + this._image_size + 5;
        }

        let label = this._task.name;
        if (typeof this._gantt.options.bar_config!.get_label === 'function') {
            label = this._gantt.options.bar_config!.get_label(this._task);
        }

        createSVG('text', {
            x: x_coord,
            y: this._y + this._height / 2,
            innerHTML: label,
            class: 'bar-label',
            append_to: this._bar_group,
        });

        // labels get BBox in the next tick
        requestAnimationFrame(() => this.update_label_position());
    }

    draw_thumbnail() {
        let x_offset = 10,
            y_offset = 2;
        let defs, clipPath;

        defs = createSVG('defs', {
            append_to: this._bar_group,
        });

        createSVG('rect', {
            id: 'rect_' + this._task.id,
            x: this._x + x_offset,
            y: this._y + y_offset,
            width: this._image_size,
            height: this._image_size,
            rx: '15',
            class: 'img_mask',
            append_to: defs,
        });

        clipPath = createSVG('clipPath', {
            id: 'clip_' + this._task.id,
            append_to: defs,
        });

        createSVG('use', {
            href: '#rect_' + this._task.id,
            append_to: clipPath,
        });

        createSVG('image', {
            x: this._x + x_offset,
            y: this._y + y_offset,
            width: this._image_size,
            height: this._image_size,
            class: 'bar-img',
            href: this._task.thumbnail,
            clipPath: 'clip_' + this._task.id,
            append_to: this._bar_group,
        });
    }

    update_bar_position({ x, width }: { x?: number; width?: number }) {
        const bar = this._$bar;

        if (x) {
            const xs = this._task.dependencies.map((dep) => {
                return this._gantt.get_bar(dep)!._$bar.getX();
            });
            const valid_x = xs.reduce((prev, curr) => {
                return prev && x >= curr;
            }, true);
            if (!valid_x) return;
            this.update_attr(bar, 'x', x);
            this._x = x;
            this._$date_highlight.style.left = x + 'px';
        }
        if (width && width > 0) {
            this.update_attr(bar, 'width', width);
            this._$date_highlight.style.width = width + 'px';
        }

        this.update_label_position();
        this.compute_duration();
        this.update_arrow_position();
    }

    update_label_position_on_horizontal_scroll({
        x,
        sx,
    }: {
        x: number;
        sx: number;
    }) {
        const container = this._gantt.container!;
        const label = this._group.querySelector('.bar-label')! as SVGGElement;
        const img = this._group.querySelector('.bar-img') as SVGGElement;
        const img_mask = this._bar_group.querySelector('.img_mask');

        let barWidthLimit = this._$bar.getX() + this._$bar.getWidth();
        let newLabelX = label.getX() + x;
        let newImgX = (img && img.getX() + x) || 0;
        let imgWidth = (img && img.getBBox().width + 7) || 7;
        let labelEndX = newLabelX + label.getBBox().width + 7;
        let viewportCentral = sx + container.clientWidth / 2;

        if (label.classList.contains('big')) return;

        if (labelEndX < barWidthLimit && x > 0 && labelEndX < viewportCentral) {
            label.setAttribute('x', `${newLabelX}`);
            if (img) {
                img.setAttribute('x', `${newImgX}`);
                if (img_mask) img_mask.setAttribute('x', `${newImgX}`);
            }
        } else if (
            newLabelX - imgWidth > this._$bar.getX() &&
            x < 0 &&
            labelEndX > viewportCentral
        ) {
            label.setAttribute('x', `${newLabelX}`);
            if (img) {
                img.setAttribute('x', `${newImgX}`);
                if (img_mask) img_mask.setAttribute('x', `${newImgX}`);
            }
        }
    }

    compute_x() {
        const { column_width } = this._gantt.config;
        const task_start = this._task._start;
        const gantt_start = this._gantt.ganttStart;

        const diff =
            date_utils.diff(task_start, gantt_start, this._gantt.config.unit) /
            this._gantt.config.step;

        // TODO: so far, 4 pixels need to be substracted
        // from the x position to match properly in the UI.
        // Is there a way to improve this?
        let x = diff * column_width;

        /* Since the column width is based on 30,
        we count the month-difference, multiply it by 30 for a "pseudo-month"
        and then add the days in the month, making sure the number does not exceed 29
        so it is within the column */

        this._x = x;
    }

    compute_y() {
        this._y =
            this._gantt.config.header_height +
            this._gantt.options.padding! / 2 +
            this._task._index * (this._height + this._gantt.options.padding!);
    }

    compute_duration() {
        this._duration =
            date_utils.diff(
                this._task._end,
                this._task._start,
                this._gantt.config.unit,
            ) / this._gantt.config.step;

        switch (this._gantt.config.unit) {
            case 'day':
            case 'hour':
                this._duration += 1; // add 1 day or hour in day/hour view
                break;
        }
    }

    update_attr(element: SVGGraphicsElement, attr: string, value: any) {
        value = +value;
        if (!isNaN(value)) {
            element.setAttribute(attr, value);
        }
        return element;
    }

    update_label_position() {
        const img_mask = this._bar_group.querySelector('.img_mask');
        const bar = this._$bar,
            label = this._group.querySelector('.bar-label') as SVGGElement,
            img = this._group.querySelector('.bar-img') as SVGGElement;

        let padding = 5;
        let x_offset_label_img = this._image_size + 10;
        const labelWidth = label.getBBox().width;
        const barWidth = bar.getWidth();
        if (labelWidth > barWidth) {
            if (this._gantt.options.bar_config!.show_label_on_offset) {
                label.classList.add('big');
                if (img) {
                    img.setAttribute('x', `${bar.getEndX() + padding}`);
                    if (img_mask)
                        img_mask.setAttribute(
                            'x',
                            `${bar.getEndX() + padding}`,
                        );
                    label.setAttribute(
                        'x',
                        `${bar.getEndX() + x_offset_label_img}`,
                    );
                } else {
                    label.setAttribute('x', `${bar.getEndX() + padding}`);
                }
            } else {
                label.style.display = 'none';
            }
        } else {
            label.classList.remove('big');
            if (img) {
                img.setAttribute('x', `${bar.getX() + padding}`);
                if (img_mask)
                    img_mask.setAttribute('x', `${bar.getX() + padding}`);
                label.setAttribute(
                    'x',
                    `${bar.getX() + barWidth / 2 + x_offset_label_img}`,
                );
            } else {
                label.setAttribute(
                    'x',
                    `${bar.getX() + barWidth / 2 - labelWidth / 2}`,
                );
            }
        }
    }

    update_arrow_position() {
        this._arrows = this._arrows || [];
        for (let arrow of this._arrows) {
            arrow.update();
        }
    }

    setArrows(arrows: Arrow[]) {
        this._arrows = arrows;
    }

    get task() {
        return this._task;
    }

    get group() {
        return this._group;
    }

    get arrows() {
        return this._arrows;
    }

    get bar() {
        return this._$bar;
    }
}
