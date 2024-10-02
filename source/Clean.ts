import { notWS } from './Constants';
import { TreeIterator, SHOW_ELEMENT_OR_TEXT } from './node/TreeIterator';
import { createTreeWalker } from './node/TreeWalker';
import { createElement, empty, detach, replaceWith } from './node/Node';
import { isInline, isLeaf } from './node/Category';
import { fixContainer } from './node/MergeSplit';
import { isLineBreak } from './node/Whitespace';

import type { SquireConfig } from './Editor';

// ---

type StyleRewriter = (
    node: HTMLElement,
    parent: Node,
    config: SquireConfig,
) => HTMLElement;

// ---

const styleToSemantic: Record<
    string,
    { regexp: RegExp; replace: (x: any, y: string) => HTMLElement }
> = {
    'font-weight': {
        regexp: /^bold|^700/i,
        replace(): HTMLElement {
            return createElement('B');
        },
    },
    'font-style': {
        regexp: /^italic/i,
        replace(): HTMLElement {
            return createElement('I');
        },
    },
    'font-family': {
        regexp: notWS,
        replace(
            classNames: { fontFamily: string },
            family: string,
        ): HTMLElement {
            return createElement('SPAN', {
                class: classNames.fontFamily,
                style: 'font-family:' + family,
            });
        },
    },
    'font-size': {
        regexp: notWS,
        replace(classNames: { fontSize: string }, size: string): HTMLElement {
            return createElement('SPAN', {
                class: classNames.fontSize,
                style: 'font-size:' + size,
            });
        },
    },
    'text-decoration': {
        regexp: /^underline/i,
        replace(): HTMLElement {
            return createElement('U');
        },
    },
};

const replaceStyles = (
    node: HTMLElement,
    _: Node,
    config: SquireConfig,
): HTMLElement => {
    const style = node.style;
    let newTreeBottom: HTMLElement | undefined;
    let newTreeTop: HTMLElement | undefined;

    for (const attr in styleToSemantic) {
        const converter = styleToSemantic[attr];
        const css = style.getPropertyValue(attr);
        if (css && converter.regexp.test(css)) {
            const el = converter.replace(config.classNames, css);
            if (
                el.nodeName === node.nodeName &&
                el.className === node.className
            ) {
                continue;
            }
            if (!newTreeTop) {
                newTreeTop = el;
            }
            if (newTreeBottom) {
                newTreeBottom.append(el);
            }
            newTreeBottom = el;
            node.style.removeProperty(attr);
        }
    }

    if (newTreeTop && newTreeBottom) {
        newTreeBottom.append(empty(node));
        if (node.style.cssText) {
            node.append(newTreeTop);
        } else {
            replaceWith(node, newTreeTop);
        }
    }

    return newTreeBottom || node;
};

const replaceWithTag = (tag: string) => {
    return (node: HTMLElement, parent: Node) => {
        const el = createElement(tag);
        const attributes = node.attributes;
        for (let i = 0, l = attributes.length; i < l; ++i) {
            const attribute = attributes[i];
            el.setAttribute(attribute.name, attribute.value);
        }
        parent.replaceChild(el, node);
        el.append(empty(node));
        return el;
    };
};

const fontSizes: Record<string, string> = {
    "1": "x-small",
    "2": "small",
    "3": "medium",
    "4": "large",
    "5": "x-large",
    "6": "xx-large",
    "7": "xxx-large",
    "-1": "smaller",
    "+1": "larger"
};

const stylesRewriters: Record<string, StyleRewriter> = {
    STRONG: replaceWithTag('B'),
    EM: replaceWithTag('I'),
    INS: replaceWithTag('U'),
    STRIKE: replaceWithTag('S'),
    SPAN: replaceStyles,
    FONT: (
        node: HTMLElement,
        parent: Node,
        config: SquireConfig,
    ): HTMLElement => {
        const font = node as HTMLFontElement;
        const face = font.face;
        const size = font.size;
        let color = font.color;
        let newTag = createElement("SPAN");
        let css = newTag.style;
        newTag.style.cssText = node.style.cssText;
        if (face) {
            css.fontFamily = face;
        }
        if (size) {
            css.fontSize = fontSizes[size];
        }
        if (color && /^#?([\dA-F]{3}){1,2}$/i.test(color)) {
            if (color.charAt(0) !== "#") {
                color = "#" + color;
            }
            css.color = color;
        }
        replaceWith(node, newTag);
        newTag.append(empty(node));
        return newTag;
    },
    TT: (node: Node, parent: Node, config: SquireConfig): HTMLElement => {
        const el = createElement('SPAN', {
            class: config.classNames.fontFamily,
            style: 'font-family:menlo,consolas,"courier new",monospace',
        });
        replaceWith(node, el);
        el.append(empty(node));
        return el;
    },
};

const allowedBlock =
    /^(?:A(?:DDRESS|RTICLE|SIDE|UDIO)|BLOCKQUOTE|CAPTION|D(?:[DLT]|IV)|F(?:IGURE|IGCAPTION|OOTER)|H[1-6]|HEADER|L(?:ABEL|EGEND|I)|O(?:L|UTPUT)|P(?:RE)?|SECTION|T(?:ABLE|BODY|D|FOOT|H|HEAD|R)|COL(?:GROUP)?|UL)$/;

const blacklist = new Set(["HEAD", "META", "STYLE"]);

/*
    Two purposes:

    1. Remove nodes we don't want, such as weird <o:p> tags, comment nodes
       and whitespace nodes.
    2. Convert inline tags into our preferred format.
*/
const cleanTree = (
    node: Node,
    config: SquireConfig,
    preserveWS?: boolean,
): Node => {
    const children = node.childNodes;

    let nonInlineParent = node;
    while (isInline(nonInlineParent)) {
        nonInlineParent = nonInlineParent.parentNode!;
    }

//    const walker = new TreeIterator<Element | Text>(
    const walker = createTreeWalker<Element | Text>(
        nonInlineParent,
        SHOW_ELEMENT_OR_TEXT,
    );

    let i = children.length;
    while (i--) {
        let child = children[i];
        const nodeName = child.nodeName;
        if (child instanceof HTMLElement) {
            const childLength = child.childNodes.length;
            if (stylesRewriters[nodeName]) {
                child = stylesRewriters[nodeName](child, node, config);
            } else if (blacklist.has(nodeName)) {
                child.remove();
                continue;
            } else if (!allowedBlock.test(nodeName) && !isInline(child)) {
                i += childLength;
                replaceWith(child, empty(child));
                continue;
            }
            if (childLength) {
                cleanTree(child, config, preserveWS || nodeName === 'PRE');
            }
/*
        } else {
            if (child instanceof Text && !preserveWS) {
                let data = child.data;
                const startsWithWS = !notWS.test(data.charAt(0));
                // Iterate through the nodes; if we hit some other content
                // before the start of a new block we don't trim
                if (startsWithWS) {
                    walker.currentNode = child;
                    let sibling;
                    while ((sibling = walker.previousPONode())) {
                        if (
                            sibling.nodeName === 'IMG' ||
                            (sibling instanceof Text &&
                                notWS.test(sibling.data))
                        ) {
                            break;
                        }
                        if (!isInline(sibling)) {
                            sibling = null;
                            break;
                        }
                    }
//                    data = (sibling ? ' ' : '') + data.trimStart();
                    data = data.replace(/^[ \t\r\n]+/g, sibling ? ' ' : '');
                }
                const endsWithWS = !notWS.test(data.charAt(data.length - 1));
                if (!startsWithWS && !endsWithWS) {
                    continue;
                }
                if (endsWithWS) {
                    walker.currentNode = child;
                    let sibling;
                    while ((sibling = walker.nextNode())) {
                        if (
                            sibling.nodeName === 'IMG' ||
                            (sibling instanceof Text &&
                                notWS.test(sibling.data))
                        ) {
                            break;
                        }
                        if (!isInline(sibling)) {
                            sibling = null;
                            break;
                        }
                    }
//                    data = data.trimEnd()() + (sibling ? ' ' : '');
                    data = data.replace(/[ \t\r\n]+$/g, sibling ? ' ' : '');
                }
                if (data) {
                    child.data = data;
                    continue;
                }
            }
            node.removeChild(child);
*/
        }
    }
    return node;
};

// ---

const removeEmptyInlines = (node: Node): void => {
    const children = node.childNodes;
    let l = children.length;
    while (l--) {
        const child = children[l];
        if (child instanceof Element && !isLeaf(child)) {
            removeEmptyInlines(child);
            if (isInline(child) && !child.firstChild) {
                node.removeChild(child);
            }
        } else if (child instanceof Text && !child.length) {
            node.removeChild(child);
        }
    }
};

// ---

// <br> elements are treated specially, and differently depending on the
// browser, when in rich text editor mode. When adding HTML from external
// sources, we must remove them, replacing the ones that actually affect
// line breaks by wrapping the inline text in a <div>. Browsers that want <br>
// elements at the end of each block will then have them added back in a later
// fixCursor method call.
const cleanupBRs = (
    node: Element | DocumentFragment,
): void => {
    const brs: NodeListOf<HTMLBRElement> = node.querySelectorAll('BR:last-child');
    let l = brs.length;
    while (l--) {
        const br = brs[l];
        // TODO: if there are more BR at the end of a block, it creates empty lines
        // Example: <br></div> does nothing, <br><br></div> does create empty line
//        const prev = br.previousSibling; // br.previousElementSibling;
//        (prev && br.parentNode?.lastChild === br && prev.nodeName !== 'BR')
        // If it doesn't break a line, just remove it; it's not doing
        // anything useful. We'll add it back later if required by the
        // browser.
        if (!isLineBreak(br)) {
            br.remove();
        }
    }
};

// ---

const escapeHTML = (text: string): string => {
    return text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
};

// ---

export { cleanTree, cleanupBRs, removeEmptyInlines, escapeHTML };
