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
        for (const attr in props) {
            const value = props[attr];
            if (value !== undefined) {
                el.setAttribute(attr, value);
            }
        }
    }
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
        (
            !(node instanceof HTMLElement && node2 instanceof HTMLElement)
            || (node.nodeName !== "A" &&
                node.className === node2.className &&
                node.style?.cssText === node2.style?.cssText
            )
        )
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

const getNodeAfterOffset = (node: Node, offset: number): Node | null => {
    let returnNode: Node | null = node;
    if (isElement(returnNode)) {
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
    return isElement(node) || node instanceof DocumentFragment
        ? node.childNodes.length
        : node instanceof CharacterData
        ? node.length
        : 0;
};

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
const isElement = (node: Node) => node instanceof Element;
const isTextNode = (node: Node) => node instanceof Text;
//  isBrElement = (node: Node) => node instanceof HTMLBRElement;
const isBrElement = (node: Node) => "BR" === node?.nodeName;

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
};
