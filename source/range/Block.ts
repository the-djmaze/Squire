import { isInline, isBlock } from '../node/Category';
import { getPreviousBlock, getNextBlock } from '../node/Block';
import { getNodeBeforeOffset, getNodeAfterOffset, isTextNode } from '../node/Node';
import { ZWS, notWS, indexOf } from '../Constants';
import { isNodeContainedInRange } from './Boundaries';
import { createTreeWalker, SHOW_ELEMENT_OR_TEXT } from '../node/TreeIterator';

// ---

// Returns the first block at least partially contained by the range,
// or null if no block is contained by the range.
const getStartBlockOfRange = (
    range: Range,
    root: Element | DocumentFragment,
): HTMLElement | null => {
    const container = range.startContainer;
    let block: HTMLElement | null;

    // If inline, get the containing block.
    if (isInline(container)) {
        block = getPreviousBlock(container, root);
    } else if (
        container !== root &&
        container instanceof HTMLElement &&
        isBlock(container)
    ) {
        block = container;
    } else {
        const node = getNodeBeforeOffset(container, range.startOffset);
        block = getNextBlock(node, root);
    }
    // Check the block actually intersects the range
    return block && isNodeContainedInRange(range, block, true) ? block : null;
};

// Returns the last block at least partially contained by the range,
// or null if no block is contained by the range.
const getEndBlockOfRange = (
    range: Range,
    root: Element | DocumentFragment,
): HTMLElement | null => {
    const container = range.endContainer;
    let block: HTMLElement | null;

    // If inline, get the containing block.
    if (isInline(container)) {
        block = getPreviousBlock(container, root);
    } else if (
        container !== root &&
        container instanceof HTMLElement &&
        isBlock(container)
    ) {
        block = container;
    } else {
        let node = getNodeAfterOffset(container, range.endOffset);
        if (!node || !root.contains(node)) {
            node = root;
            let child: Node | null;
            while ((child = node.lastChild)) {
                node = child;
            }
        }
        block = getPreviousBlock(node, root);
    }
    // Check the block actually intersects the range
    return block && isNodeContainedInRange(range, block, true) ? block : null;
};

const createContentWalker = (root: Node) =>
    createTreeWalker(root, SHOW_ELEMENT_OR_TEXT,
        (node: Text) => isTextNode(node) ? notWS.test(node.data) : node.nodeName === "IMG"
    );

const rangeDoesStartAtBlockBoundary = (
    range: Range,
    root: Element,
): boolean => {
    const startContainer = range.startContainer;
    const startOffset = range.startOffset;
    let nodeAfterCursor: Node | null;

    // If in the middle or end of a text node, we're not at the boundary.
    if (isTextNode(startContainer)) {
        let i = startOffset;
        while (i--) {
            if ((startContainer as Text).data.charAt(i) !== ZWS) {
                return false;
            }
        }
        nodeAfterCursor = startContainer;
    } else {
        nodeAfterCursor = getNodeAfterOffset(startContainer, startOffset);
        if (!nodeAfterCursor || !root.contains(nodeAfterCursor)) {
            // The cursor was right at the end of the document
            nodeAfterCursor = getNodeBeforeOffset(startContainer, startOffset);
            if (isTextNode(nodeAfterCursor) && (nodeAfterCursor as Text).length) {
                return false;
            }
        }
    }

    // Otherwise, look for any previous content in the same block.
    const block = getStartBlockOfRange(range, root);
    if (!block) {
        return false;
    }
    const contentWalker = createContentWalker(block);
    contentWalker.currentNode = nodeAfterCursor;

    return !contentWalker.previousNode();
};

const rangeDoesEndAtBlockBoundary = (range: Range, root: Element): boolean => {
    const endContainer = range.endContainer;
    const endOffset = range.endOffset;
    let currentNode: Node;

    // If in a text node with content, and not at the end, we're not
    // at the boundary. Ignore ZWS.
    if (isTextNode(endContainer)) {
        const text = (endContainer as Text).data;
        const length = text.length;
        for (let i = endOffset; i < length; ++i) {
            if (text.charAt(i) !== ZWS) {
                return false;
            }
        }
        currentNode = endContainer;
    } else {
        currentNode = getNodeBeforeOffset(endContainer, endOffset);
    }

    // Otherwise, look for any further content in the same block.
    const block = getEndBlockOfRange(range, root);
    if (!block) {
        return false;
    }
    const contentWalker = createContentWalker(block);
    contentWalker.currentNode = currentNode;
    return !contentWalker.nextNode();
};

const expandRangeToBlockBoundaries = (range: Range, root: Element): void => {
    const start = getStartBlockOfRange(range, root);
    const end = getEndBlockOfRange(range, root);
    let parent: Node;

    if (start && end) {
        parent = start.parentNode!;
        range.setStart(parent, indexOf(parent.childNodes, start));
        parent = end.parentNode!;
        range.setEnd(parent, indexOf(parent.childNodes, end) + 1);
    }
};

// ---

export {
    getStartBlockOfRange,
    getEndBlockOfRange,
    rangeDoesStartAtBlockBoundary,
    rangeDoesEndAtBlockBoundary,
    expandRangeToBlockBoundaries,
};
