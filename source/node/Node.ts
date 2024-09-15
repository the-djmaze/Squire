import { isLeaf } from './Category';

// ---

const createElement = (
    tag: string,
    props?: Record<string, string> | null,
    children?: Node[],
): HTMLElement => {
    const el = document.createElement(tag);
    if (props instanceof Array) {
        children = props;
        props = null;
    }
    if (props) {
        setAttributes(el, props);
    }
    if (children) {
        children.forEach((node) => el.append(node));
    }
    return el;
};

// --- Tests

const areAlike = (
    node: HTMLElement | Node,
    node2: HTMLElement | Node,
): boolean => {
    if (isLeaf(node)) {
        return false;
    }
    if (node.nodeType !== node2.nodeType || node.nodeName !== node2.nodeName) {
        return false;
    }
    if (node instanceof HTMLElement && node2 instanceof HTMLElement) {
        return (
            node.nodeName !== 'A' &&
            node.className === node2.className &&
            node.style.cssText === node2.style.cssText
        );
    }
    return true;
};

const hasTagAttributes = (
    node: Node | Element,
    tag: string,
    attributes?: Record<string, string> | null,
): boolean => {
    if (node.nodeName !== tag) {
        return false;
    }
    for (const attr in attributes) {
        if (
            !('getAttribute' in node) ||
            node.getAttribute(attr) !== attributes[attr]
        ) {
            return false;
        }
    }
    return true;
};

// --- Traversal

const getNearest = (
    node: Node | null,
    root: Element | DocumentFragment,
    tag: string,
    attributes?: Record<string, string> | null,
): Node | null => {
    while (node && node !== root) {
        if (hasTagAttributes(node, tag, attributes)) {
            return node;
        }
        node = node.parentNode;
    }
    return null;
};

const getNodeBeforeOffset = (node: Node, offset: number): Node => {
    let children = node.childNodes;
    while (offset && node instanceof Element) {
        node = children[offset - 1];
        children = node.childNodes;
        offset = children.length;
    }
    return node;
};

const getNodeAfterOffset = (node: Node, offset: number): Node | null => {
    let returnNode: Node | null = node;
    if (returnNode instanceof Element) {
        const children = returnNode.childNodes;
        if (offset < children.length) {
            returnNode = children[offset];
        } else {
            while (returnNode && !returnNode.nextSibling) {
                returnNode = returnNode.parentNode;
            }
            if (returnNode) {
                returnNode = returnNode.nextSibling;
            }
        }
    }
    return returnNode;
};

const getLength = (node: Node): number => {
    return node instanceof Element || node instanceof DocumentFragment
        ? node.childNodes.length
        : node instanceof CharacterData
          ? node.length
          : 0;
};

// --- Manipulation

const empty = (node: Node): DocumentFragment => {
    const frag = document.createDocumentFragment();
    let child = node.firstChild;
    while (child) {
        frag.append(child);
        child = node.firstChild;
    }
    return frag;
};

const detach = (node: Node): Node => {
    const parent = node.parentNode;
    if (parent) {
        parent.removeChild(node);
    }
    return node;
};

const replaceWith = (node: Node, node2: Node): void => {
    const parent = node.parentNode;
    if (parent) {
        parent.replaceChild(node2, node);
    }
};

/**
 * SnappyMail
 */

const getClosest = (node, root, selector) => {
    node = ((node && !node.closest) ? node.parentElement : node)?.closest(selector);
    return (node && root.contains(node)) ? node : null;
};

const setAttributes = (node, props) => {
    props && Object.entries(props).forEach(([k, v]) => {
        if (null == v) {
            node.removeAttribute(k);
        } else if ("style" === k && typeof v === "object") {
            Object.entries(v).forEach(([k2, v2]) => node.style[k2] = v2);
        } else {
            node.setAttribute(k, v);
        }
    });
};

// --- Export

export {
    areAlike,
    createElement,
    detach,
    empty,
    getLength,
    getNearest,
    getNodeAfterOffset,
    getNodeBeforeOffset,
    hasTagAttributes,
    replaceWith,
    getClosest,
    setAttributes,
};
