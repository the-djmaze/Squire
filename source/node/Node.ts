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
    setAttributes(el, props);
    children && el.append(...children);
    return el;
};

// --- Tests

const areAlike = (
    node: HTMLElement | Node,
    node2: HTMLElement | Node,
): boolean =>
    !isLeaf(node) && (
        node.nodeType === node2.nodeType &&
        node.nodeName === node2.nodeName &&
        node.nodeName !== "A" &&
        (node as HTMLElement).className === (node2 as HTMLElement).className &&
        (node as HTMLElement).style?.cssText === (node2 as HTMLElement).style?.cssText
    );

const hasTagAttributes = (
    node: Node | Element,
    tag: string,
    attributes?: Record<string, string> | null,
): boolean =>
    node.nodeName === tag && Object.entries(attributes || {}).every(([k,v]) => (node as Element).getAttribute(k) === v);

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
    while (offset && isElement(node)) {
        node = children[offset - 1];
        children = node.childNodes;
        offset = children.length;
    }
    return node;
};

const getNodeAfterOffset = (node: Node | null, offset: number): Node | null => {
    if (isElement(node)) {
        const children = (node as Node).childNodes;
        if (offset < children.length) {
            node = children[offset];
        } else {
            while (node && !node.nextSibling) {
                node = node.parentNode;
            }
            node && (node = node.nextSibling);
        }
    }
    return node;
};

const getLength = (node: Node): number =>
    isElement(node) || node instanceof DocumentFragment
        ? node.childNodes.length
        : (node as CharacterData).length || 0;

// --- Manipulation

const empty = (node: Node): DocumentFragment => {
    const frag = document.createDocumentFragment(),
        childNodes = node.childNodes;
    childNodes && frag.append(...childNodes);
    return frag;
};

// node.remove();
const detach = (node: Node): Node | undefined => node.parentNode?.removeChild(node);

const replaceWith = (node: Node, node2: Node): Node | undefined =>
    node.parentNode?.replaceChild(node2, node);

// --- SnappyMail
const getClosest = (node: any, root: Element, selector: string) => {
    node = (node && !node.closest) ? node.parentElement : node;
    node = node?.closest(selector);
    return (node && root.contains(node)) ? node : null;
};
const isElement = (node: Node | null | undefined) => node instanceof Element;
const isTextNode = (node: Node | null | undefined) => node instanceof Text;
//  isBrElement = (node: Node) => node instanceof HTMLBRElement;
const isBrElement = (node: Node | null) => "BR" === node?.nodeName;
const setAttributes = (node: HTMLElement, props: Object | null | undefined) => {
    props && Object.entries(props).forEach(([k,v]) => {
        if (null == v) {
            node.removeAttribute(k);
        } else if ("style" === k && typeof v === "object") {
            Object.entries(v).forEach(([k,v]) => (node.style as any)[k] = v);
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
    isElement,
    isTextNode,
    isBrElement,
    setAttributes,
};
