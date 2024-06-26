import { notWS } from './Constants';
import { createTreeWalker, SHOW_ELEMENT_OR_TEXT } from './node/TreeIterator';
import { createElement, empty, detach, replaceWith, isElement, isTextNode } from './node/Node';
import { isInline, isLeaf } from './node/Category';
import { fixContainer } from './node/MergeSplit';
import { isLineBreak } from './node/Whitespace';

import type { SquireConfig } from './Editor';

// ---

type StyleRewriter = (
    node: HTMLElement
) => HTMLElement;

// ---

const styleToSemantic: Record<
    string,
    { regexp: RegExp; replace: (y: string) => HTMLElement }
> = {
    fontWeight: {
        regexp: /^bold|^700/i,
        replace: () => createElement('B'),
    },
    fontStyle: {
        regexp: /^italic/i,
        replace: () => createElement('I'),
    },
    fontFamily: {
        regexp: notWS,
        replace: (family: string) => createElement('SPAN', {
            style: 'font-family:' + family,
        }),
    },
    fontSize: {
        regexp: notWS,
        replace: (size: string) => createElement('SPAN', {
            style: 'font-size:' + size,
        }),
    },
    textDecoration: {
        regexp: /^underline/i,
        replace: () => createElement('U'),
    },
};

const replaceStyles = (node: HTMLElement): HTMLElement => {
    const style = node.style;
    let newTreeBottom: HTMLElement | undefined;
    let newTreeTop: HTMLElement | undefined;

    Object.entries(styleToSemantic).forEach(([attr,converter])=>{
        const css = style[attr as keyof CSSStyleDeclaration];
        if (css && converter.regexp.test(css as string)) {
            const el = converter.replace(css as string);
            if (
                el.nodeName !== node.nodeName ||
                el.className !== node.className
            ) {
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
    });

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

const replaceWithTag = (tag: string) =>
    (node: HTMLElement) => {
        const el = createElement(tag);
        Array.prototype.forEach.call(node.attributes, attr => el.setAttribute(attr.name, attr.value));
        replaceWith(node, el);
        el.append(empty(node));
        return el;
    };

const fontSizes: Record<string, string> = {
    1: 'x-small',
    2: "small",
    3: "medium",
    4: "large",
    5: 'x-large',
    6: 'xx-large',
    7: 'xxx-large',
    '-1': "smaller",
    '+1': "larger"
};

const stylesRewriters: Record<string, StyleRewriter> = {
    STRONG: replaceWithTag('B'),
    EM: replaceWithTag('I'),
    INS: replaceWithTag('U'),
    STRIKE: replaceWithTag('S'),
    SPAN: replaceStyles,
    FONT: (node: HTMLElement): HTMLElement => {
        const font = node as HTMLFontElement;
        const face = font.face;
        const size = font.size;
        let color = font.color;
        let fontSpan: HTMLElement;
        let sizeSpan: HTMLElement;
        let colorSpan: HTMLElement;
        let newTreeBottom: HTMLElement | undefined;
        let newTreeTop: HTMLElement | undefined;
        if (face) {
            fontSpan = createElement('SPAN', {
                style: 'font-family:' + face,
            });
            newTreeTop = fontSpan;
            newTreeBottom = fontSpan;
        }
        if (size) {
            sizeSpan = createElement('SPAN', {
                style: 'font-size:' + fontSizes[size] + 'px',
            });
            if (!newTreeTop) {
                newTreeTop = sizeSpan;
            }
            if (newTreeBottom) {
                newTreeBottom.append(sizeSpan);
            }
            newTreeBottom = sizeSpan;
        }
        if (color && /^#?([\dA-F]{3}){1,2}$/i.test(color)) {
            if (color.charAt(0) !== '#') {
                color = '#' + color;
            }
            colorSpan = createElement('SPAN', {
                style: 'color:' + color,
            });
            if (!newTreeTop) {
                newTreeTop = colorSpan;
            }
            if (newTreeBottom) {
                newTreeBottom.append(colorSpan);
            }
            newTreeBottom = colorSpan;
        }
        if (!newTreeTop || !newTreeBottom) {
            newTreeTop = newTreeBottom = createElement('SPAN');
        }
        replaceWith(font, newTreeTop);
        newTreeBottom.append(empty(font));
        return newTreeBottom;
    },
    TT: (node: Node): HTMLElement => {
        const el = createElement('SPAN', {
            style: 'font-family:menlo,consolas,"courier new",monospace',
        });
        replaceWith(node, el);
        el.append(empty(node));
        return el;
    },
};

const allowedBlock =
    /^(?:A(?:DDRESS|RTICLE|SIDE|UDIO)|BLOCKQUOTE|CAPTION|D(?:[DLT]|IV)|F(?:IGURE|IGCAPTION|OOTER)|H[1-6]|HEADER|L(?:ABEL|EGEND|I)|O(?:L|UTPUT)|P(?:RE)?|SECTION|T(?:ABLE|BODY|D|FOOT|H|HEAD|R)|COL(?:GROUP)?|UL)$/;

const blacklist = /^(?:HEAD|META|STYLE)/;

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
    const walker = createTreeWalker(
        nonInlineParent,
        SHOW_ELEMENT_OR_TEXT,
    );

    for (let i = 0, l = children.length; i < l; ++i) {
        let child = children[i];
        const nodeName = child.nodeName;
        const rewriter = stylesRewriters[nodeName];
        if (child instanceof HTMLElement) {
            const childLength = child.childNodes.length;
            if (rewriter) {
                child = rewriter(child);
            } else if (blacklist.test(nodeName)) {
                node.removeChild(child);
                --i;
                --l;
                continue;
            } else if (!allowedBlock.test(nodeName) && !isInline(child)) {
                --i;
                l += childLength - 1;
                replaceWith(child, empty(child));
                continue;
            }
            if (childLength) {
                cleanTree(child, config, preserveWS || nodeName === 'PRE');
            }
        } else {
            if (isTextNode(child)) {
                let data = (child as Text).data;
                const startsWithWS = !notWS.test(data.charAt(0));
                const endsWithWS = !notWS.test(data.charAt(data.length - 1));
                if (preserveWS || (!startsWithWS && !endsWithWS)) {
                    continue;
                }
                // Iterate through the nodes; if we hit some other content
                // before the start of a new block we don't trim
                if (startsWithWS) {
                    walker.currentNode = child;
                    let sibling;
                    while ((sibling = walker.previousPONode())) {
                        if (
                            sibling.nodeName === 'IMG' ||
                            (isTextNode(sibling) &&
                                notWS.test((sibling as Text).data))
                        ) {
                            break;
                        }
                        if (!isInline(sibling)) {
                            sibling = null;
                            break;
                        }
                    }
                    data = data.replace(/^[ \t\r\n]+/g, sibling ? ' ' : '');
                }
                if (endsWithWS) {
                    walker.currentNode = child;
                    let sibling;
                    while ((sibling = walker.nextNode())) {
                        if (
                            sibling.nodeName === 'IMG' ||
                            (isTextNode(sibling) &&
                                notWS.test((sibling as Text).data))
                        ) {
                            break;
                        }
                        if (!isInline(sibling)) {
                            sibling = null;
                            break;
                        }
                    }
                    data = data.replace(/[ \t\r\n]+$/g, sibling ? ' ' : '');
                }
                if (data) {
                    (child as Text).data = data;
                    continue;
                }
            }
            node.removeChild(child);
            --i;
            --l;
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
        if (isElement(child) && !isLeaf(child)) {
            removeEmptyInlines(child);
            if (!child.firstChild && isInline(child)) {
                node.removeChild(child);
            }
        } else if (!(child as Text).data && isTextNode(child)) {
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
    root: Element,
    keepForBlankLine: boolean,
): void => {
    const brs: NodeListOf<HTMLBRElement> = node.querySelectorAll('BR');
    const brBreaksLine: boolean[] = [];
    let l = brs.length;

    // Must calculate whether the <br> breaks a line first, because if we
    // have two <br>s next to each other, after the first one is converted
    // to a block split, the second will be at the end of a block and
    // therefore seem to not be a line break. But in its original context it
    // was, so we should also convert it to a block split.
    for (let i = 0; i < l; ++i) {
        brBreaksLine[i] = isLineBreak(brs[i], keepForBlankLine);
    }
    while (l--) {
        const br = brs[l];
        // Cleanup may have removed it
        const parent = br.parentNode;
        if (parent) {
            // If it doesn't break a line, just remove it; it's not doing
            // anything useful. We'll add it back later if required by the
            // browser. If it breaks a line, wrap the content in div tags
            // and replace the brs.
            if (!brBreaksLine[l]) {
                detach(br);
            } else if (!isInline(parent)) {
                fixContainer(parent, root);
            }
        }
    }
};

// ---

const escapeHTML = (text: string): string =>
    text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');

// ---

export { cleanTree, cleanupBRs, isLineBreak, removeEmptyInlines, escapeHTML };
