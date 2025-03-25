export function $(expr: string | Element, con: HTMLElement) {
    return typeof expr === 'string'
        ? (con || document).querySelector(expr)
        : expr || null;
}

export function createSVG(tag: string, attrs: any): SVGGraphicsElement {
    const elem = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (let attr in attrs) {
        if (attr === 'append_to') {
            const parent = attrs.append_to;
            parent.appendChild(elem);
        } else if (attr === 'innerHTML') {
            elem.innerHTML = attrs.innerHTML;
        } else if (attr === 'clipPath') {
            elem.setAttribute('clip-path', 'url(#' + attrs[attr] + ')');
        } else {
            elem.setAttribute(attr, attrs[attr]);
        }
    }
    return elem as SVGGraphicsElement;
}

export function animateSVG(
    SVGGraphicsElement: SVGGraphicsElement,
    attr: string,
    from: string | number,
    to: string | number,
) {
    const animatedSvgElement = getAnimationElement(
        SVGGraphicsElement,
        attr,
        from,
        to,
    );

    if (animatedSvgElement === SVGGraphicsElement) {
        // triggered 2nd time programmatically
        // trigger artificial click event
        const event = document.createEvent('HTMLEvents');
        event.initEvent('click', true, true);
        //@ts-expect-error: i don't know what it means
        event.eventName = 'click';
        animatedSvgElement.dispatchEvent(event);
    }
}

function getAnimationElement(
    SVGGraphicsElement: SVGGraphicsElement,
    attr: string,
    from: string | number,
    to: string | number,
    dur = '0.4s',
    begin = '0.1s',
) {
    const animEl = SVGGraphicsElement.querySelector('animate');
    if (animEl) {
        $.attr(animEl, {
            attributeName: attr,
            from,
            to,
            dur,
            begin: 'click + ' + begin, // artificial click
        });
        return SVGGraphicsElement;
    }

    const animateElement = createSVG('animate', {
        attributeName: attr,
        from,
        to,
        dur,
        begin,
        calcMode: 'spline',
        values: from + ';' + to,
        keyTimes: '0; 1',
        keySplines: cubic_bezier('ease-out'),
    });
    SVGGraphicsElement.appendChild(animateElement);

    return SVGGraphicsElement;
}

function cubic_bezier(name: string) {
    return {
        ease: '.25 .1 .25 1',
        linear: '0 0 1 1',
        'ease-in': '.42 0 1 1',
        'ease-out': '0 0 .58 1',
        'ease-in-out': '.42 0 .58 1',
    }[name];
}

$.on = (
    element: SVGGraphicsElement,
    event: string,
    selector: string | ((e?: Event, handle?: Element) => void),
    callback?: (e?: Event, handle?: Element) => void,
) => {
    if (!callback) {
        //@ts-ignore: it works
        callback = selector;
        $.bind(element, event, callback!);
    } else if (typeof selector == 'string') {
        $.delegate(element, event, selector, callback);
    }
};

$.off = (element: SVGGraphicsElement, event: string, handler: () => void) => {
    element.removeEventListener(event, handler);
};

$.bind = (
    element: SVGGraphicsElement,
    event: string,
    callback: (e?: Event, handle?: Element) => void,
) => {
    event.split(/\s+/).forEach(function (event) {
        element.addEventListener(event, callback);
    });
};

$.delegate = (
    element: SVGGraphicsElement,
    event: string,
    selector: string,
    callback: (e?: Event, handle?: Element) => void,
) => {
    element.addEventListener(event, function (e) {
        const target = e.target as Element;
        const delegatedTarget = target.closest(selector);
        if (delegatedTarget) {
            //@ts-ignore: ignore
            e.delegatedTarget = delegatedTarget;
            //@ts-ignore: ignore
            callback.call(this, e, delegatedTarget);
        }
    });
};

$.closest = (
    selector: string,
    element?: SVGGraphicsElement,
): SVGGraphicsElement | undefined => {
    if (!element) return undefined;

    if (element.matches(selector)) {
        return element;
    }
    const pnode = element.parentNode || undefined;
    return $.closest(selector, pnode as SVGGraphicsElement);
};

$.attr = (
    element: SVGElement,
    attr: string | Record<string, any>,
    value?: any,
) => {
    if (!value && typeof attr === 'string') {
        return element.getAttribute(attr);
    }

    if (typeof attr === 'object') {
        for (let key in attr) {
            $.attr(element, key, attr[key]);
        }
        return;
    }

    element.setAttribute(attr, value);
};

const init = () => {
    SVGGraphicsElement.prototype.getX = function () {
        return +this.getAttribute('x')!;
    };
    SVGGraphicsElement.prototype.getY = function () {
        return +this.getAttribute('y')!;
    };
    SVGGraphicsElement.prototype.getWidth = function () {
        return +this.getAttribute('width')!;
    };
    SVGGraphicsElement.prototype.getHeight = function () {
        return +this.getAttribute('height')!;
    };
    SVGGraphicsElement.prototype.getEndX = function () {
        return this.getX() + this.getWidth();
    };
};

init();
