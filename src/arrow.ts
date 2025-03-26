import { Gantt } from '.';
import Bar from './bar';
import { createSVG } from './svg_utils';

export default class Arrow {
    private _gantt: Gantt;
    private _from_task: Bar;
    private _to_task: Bar;
    private _path: string;
    private _element: SVGGraphicsElement;

    constructor(gantt: Gantt, from_task: Bar, to_task: Bar) {
        this._gantt = gantt;
        this._from_task = from_task;
        this._to_task = to_task;

        this.calculate_path();
        this.draw();
    }

    calculate_path() {
        let start_x =
            this._from_task.bar.getX() + this._from_task.bar.getWidth() / 2;

        const condition = () =>
            this._to_task.bar.getX() < start_x + this._gantt.options.padding! &&
            start_x > this._from_task.bar.getX() + this._gantt.options.padding!;

        while (condition()) {
            start_x -= 10;
        }
        start_x -= 10;

        let start_y =
            this._gantt.config.header_height +
            this._gantt.options.bar_height! +
            (this._gantt.options.padding! + this._gantt.options.bar_height!) *
                this._from_task.task._index +
            this._gantt.options.padding! / 2;

        let end_x = this._to_task.bar.getX() - 13;
        let end_y =
            this._gantt.config.header_height +
            this._gantt.options.bar_height! / 2 +
            (this._gantt.options.padding! + this._gantt.options.bar_height!) *
                this._to_task.task._index +
            this._gantt.options.padding! / 2;

        const from_is_below_to =
            this._from_task.task._index > this._to_task.task._index;

        let curve = this._gantt.options.arrow_curve!;
        const clockwise = from_is_below_to ? 1 : 0;
        let curve_y = from_is_below_to ? -curve : curve;

        if (
            this._to_task.bar.getX() <=
            this._from_task.bar.getX() + this._gantt.options.padding!
        ) {
            let down_1 = this._gantt.options.padding! / 2 - curve;
            if (down_1 < 0) {
                down_1 = 0;
                curve = this._gantt.options.padding! / 2;
                curve_y = from_is_below_to ? -curve : curve;
            }
            const down_2 =
                this._to_task.bar.getY() +
                this._to_task.bar.getHeight() / 2 -
                curve_y;
            const left =
                this._to_task.bar.getX() - this._gantt.options.padding!;
            this._path = `
                M ${start_x} ${start_y}
                v ${down_1}
                a ${curve} ${curve} 0 0 1 ${-curve} ${curve}
                H ${left}
                a ${curve} ${curve} 0 0 ${clockwise} ${-curve} ${curve_y}
                V ${down_2}
                a ${curve} ${curve} 0 0 ${clockwise} ${curve} ${curve_y}
                L ${end_x} ${end_y}
                m -5 -5
                l 5 5
                l -5 5`;
        } else {
            if (end_x < start_x + curve) curve = end_x - start_x;

            let offset = from_is_below_to ? end_y + curve : end_y - curve;

            this._path = `
              M ${start_x} ${start_y}
              V ${offset}
              a ${curve} ${curve} 0 0 ${clockwise} ${curve} ${curve}
              L ${end_x} ${end_y}
              m -5 -5
              l 5 5
              l -5 5`;
        }
    }

    draw() {
        this._element = createSVG('path', {
            d: this._path,
            'data-from': this._from_task.task.id,
            'data-to': this._to_task.task.id,
        });
    }

    update() {
        this.calculate_path();
        this._element.setAttribute('d', this._path);
    }

    get fromTask() {
        return this._from_task;
    }

    get toTask() {
        return this._to_task;
    }

    get element() {
        return this._element;
    }
}
