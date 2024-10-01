import { ZWS, cantFocusEmptyTextNodes } from '../Constants';
import {
    createElement,
    getClosest,
    areAlike,
    getLength,
    detach,
    empty,
} from './Node';
import { isInline, isContainer } from './Category';

// ---

const fixCursor = (node: Node): Node => {
    // In Webkit and Gecko, block level elements are collapsed and
    // unfocusable if they have no content.
    // Webkit can use CSS :empty::before{content:'\200B'},
    // but the Enter key should do a BR, yet it does splitBlock(),
    // so just add the <BR> in every browser.
    if (
        (node instanceof Element || node instanceof DocumentFragment) &&
        !isInline(node) &&
        !node.children.length && !node.textContent.length
    ) {
        node.appendChild(createElement('BR'));
    }

    return node;
};

// Examine container nodes and wrap any inline children.
// This should only be needed on the root node
const fixContainer = (
    container: Node,
): Node => {
    let wrapper: HTMLElement | null = null;
    [...container.childNodes].forEach((child) => {
        if (isInline(child)) {
            wrapper || (wrapper = createElement('DIV'));
            wrapper.append(child);
        } else if (wrapper) {
            (wrapper.children.length || wrapper.textContent.trim().length)
            && container.insertBefore(wrapper, child);
            wrapper = null;
        }
    });
    wrapper && container.append(wrapper);
    return container;
};

const split = (
    node: Node,
    offset: number | Node | null,
    stopNode: Node,
    root: Element | DocumentFragment,
): Node | null => {
    if (node instanceof Text && node !== stopNode) {
        if (typeof offset !== 'number') {
            throw new Error('Offset must be a number to split text node!');
        }
        if (!node.parentNode) {
            throw new Error('Cannot split text node with no parent!');
        }
        return split(node.parentNode, node.splitText(offset), stopNode, root);
    }

    let nodeAfterSplit: Node | null =
        typeof offset === 'number'
            ? offset < node.childNodes.length
                ? node.childNodes[offset]
                : null
            : offset;
    const parent = node.parentNode;
    if (!parent || node === stopNode || !(node instanceof Element)) {
        return nodeAfterSplit;
    }

    // Clone node without children
    const clone = node.cloneNode(false) as Element;

    // Add right-hand siblings to the clone
    while (nodeAfterSplit) {
        const next = nodeAfterSplit.nextSibling;
        clone.append(nodeAfterSplit);
        nodeAfterSplit = next;
    }

    // Maintain li numbering if inside a quote.
    if (
        node instanceof HTMLOListElement &&
        getClosest(node, root, 'BLOCKQUOTE')
    ) {
        (clone as HTMLOListElement).start =
            (+node.start || 1) + node.childNodes.length - 1;
    }

    // DO NOT NORMALISE. This may undo the fixCursor() call
    // of a node lower down the tree!
    // We need something in the element in order for the cursor to appear.
    fixCursor(node);
    fixCursor(clone);

    // Inject clone after original node
    node.after(clone);

    // Keep on splitting up the tree
    return split(parent, clone, stopNode, root);
};

const _mergeInlines = (
    node: Node,
    fakeRange: {
        startContainer: Node;
        startOffset: number;
        endContainer: Node;
        endOffset: number;
    },
): void => {
    const children = node.childNodes;
    let l = children.length;
    const frags: DocumentFragment[] = [];
    while (l--) {
        const child = children[l];
        const prev = l ? children[l - 1] : null;
        if (prev && isInline(child) && areAlike(child, prev)) {
            if (fakeRange.startContainer === child) {
                fakeRange.startContainer = prev;
                fakeRange.startOffset += getLength(prev);
            }
            if (fakeRange.endContainer === child) {
                fakeRange.endContainer = prev;
                fakeRange.endOffset += getLength(prev);
            }
            if (fakeRange.startContainer === node) {
                if (fakeRange.startOffset > l) {
                    --fakeRange.startOffset;
                } else if (fakeRange.startOffset === l) {
                    fakeRange.startContainer = prev;
                    fakeRange.startOffset = getLength(prev);
                }
            }
            if (fakeRange.endContainer === node) {
                if (fakeRange.endOffset > l) {
                    --fakeRange.endOffset;
                } else if (fakeRange.endOffset === l) {
                    fakeRange.endContainer = prev;
                    fakeRange.endOffset = getLength(prev);
                }
            }
            detach(child);
            if (child instanceof Text) {
                (prev as Text).appendData(child.data);
            } else {
                frags.push(empty(child));
            }
        } else if (child instanceof Element) {
            let frag: DocumentFragment | undefined;
            while ((frag = frags.pop())) {
                child.append(frag);
            }
            _mergeInlines(child, fakeRange);
        }
    }
};

const mergeInlines = (node: Node, range: Range): void => {
    const element = node instanceof Text ? node.parentNode : node;
    if (element instanceof Element) {
        const fakeRange = {
            startContainer: range.startContainer,
            startOffset: range.startOffset,
            endContainer: range.endContainer,
            endOffset: range.endOffset,
        };
        _mergeInlines(element, fakeRange);
        range.setStart(fakeRange.startContainer, fakeRange.startOffset);
        range.setEnd(fakeRange.endContainer, fakeRange.endOffset);
    }
};

const mergeWithBlock = (
    block: Node,
    next: Node,
    range: Range,
    root: Element,
): void => {
    let container = next;
    let parent: Node | null;
    let offset: number;
    while (
        (parent = container.parentNode) &&
        parent !== root &&
        parent instanceof Element &&
        parent.childNodes.length === 1
    ) {
        container = parent;
    }
    detach(container);

    offset = block.childNodes.length;

    // Remove extra <BR> fixer if present.
    const last = block.lastChild;
    if (last && last.nodeName === 'BR') {
        last.remove();
        --offset;
    }

    block.append(empty(next));

    range.setStart(block, offset);
    range.collapse(true);
    mergeInlines(block, range);
};

const mergeContainers = (node: Node, root: Element): void => {
    const prev = node.previousSibling;
    const first = node.firstChild;
    const isListItem = node.nodeName === 'LI';

    // Do not merge LIs, unless it only contains a UL
    if (isListItem && (!first || !/^[OU]L$/.test(first.nodeName))) {
        return;
    }

    if (prev && areAlike(prev, node)) {
        if (!isContainer(prev)) {
            if (!isListItem) {
                return;
            }
            const block = createElement('DIV');
            block.append(empty(prev));
            prev.append(block);
        }
        detach(node);
        const needsFix = !isContainer(node);
        prev.append(empty(node));
        needsFix && fixContainer(prev);
        first && mergeContainers(first, root);
    } else if (isListItem) {
        const block = createElement('DIV');
        node.insertBefore(block, first);
        fixCursor(block);
    }
};

// ---

export {
    fixContainer,
    fixCursor,
    mergeContainers,
    mergeInlines,
    mergeWithBlock,
    split,
};
