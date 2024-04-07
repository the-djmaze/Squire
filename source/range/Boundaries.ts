import { isLeaf } from '../node/Category';
import { getLength, getNearest, isTextNode, isBrElement } from '../node/Node';
import { isLineBreak } from '../node/Whitespace';
import { indexOf } from '../Constants';

// ---

const START_TO_START = 0; // Range.START_TO_START
const START_TO_END = 1; // Range.START_TO_END
const END_TO_END = 2; // Range.END_TO_END
const END_TO_START = 3; // Range.END_TO_START

const isNodeContainedInRange = (
    range: Range,
    node: Node,
    partial: boolean,
): boolean => {
    const nodeRange = document.createRange();
    nodeRange.selectNode(node);
    if (partial) {
        // Node must not finish before range starts or start after range
        // finishes.
        const nodeEndBeforeStart =
            range.compareBoundaryPoints(END_TO_START, nodeRange) > -1;
        const nodeStartAfterEnd =
            range.compareBoundaryPoints(START_TO_END, nodeRange) < 1;
        return !nodeEndBeforeStart && !nodeStartAfterEnd;
    } else {
        // Node must start after range starts and finish before range
        // finishes
        const nodeStartAfterStart =
            range.compareBoundaryPoints(START_TO_START, nodeRange) < 1;
        const nodeEndBeforeEnd =
            range.compareBoundaryPoints(END_TO_END, nodeRange) > -1;
        return nodeStartAfterStart && nodeEndBeforeEnd;
    }
};

/**
 * Moves the range to an equivalent position with the start/end as deep in
 * the tree as possible.
 */
const moveRangeBoundariesDownTree = (range: Range): void => {
    let { startContainer, startOffset, endContainer, endOffset } = range;

    while (!isTextNode(startContainer)) {
        let child: ChildNode | null = startContainer.childNodes[startOffset];
        if (!child || isLeaf(child)) {
            if (startOffset) {
                child = startContainer.childNodes[startOffset - 1];
                if (isTextNode(child)) {
                    // If we have an empty text node next to another text node,
                    // just skip and remove it.
                    let prev: ChildNode | null;
                    while (
                        !(child as Text).length &&
                        (prev = child.previousSibling) &&
                        isTextNode(prev)
                    ) {
                        child.remove();
                        child = prev;
                    }
                    startContainer = child;
                    startOffset = (child as Text).data.length;
                }
            }
            break;
        }
        startContainer = child;
        startOffset = 0;
    }
    if (endOffset) {
        while (!isTextNode(endContainer)) {
            const child = endContainer.childNodes[endOffset - 1];
            if (!child || isLeaf(child)) {
                if (
                    isBrElement(child) &&
                    !isLineBreak(child as Element, false)
                ) {
                    --endOffset;
                    continue;
                }
                break;
            }
            endContainer = child;
            endOffset = getLength(endContainer);
        }
    } else {
        while (!isTextNode(endContainer)) {
            const child = endContainer.firstChild!;
            if (!child || isLeaf(child)) {
                break;
            }
            endContainer = child;
        }
    }

    range.setStart(startContainer, startOffset);
    range.setEnd(endContainer, endOffset);
};

const moveRangeBoundariesUpTree = (
    range: Range,
    startMax: Node,
    endMax: Node,
    root: Node,
): void => {
    let startContainer = range.startContainer;
    let startOffset = range.startOffset;
    let endContainer = range.endContainer;
    let endOffset = range.endOffset;
    let parent: Node;

    if (!startMax) {
        startMax = range.commonAncestorContainer;
    }
    if (!endMax) {
        endMax = startMax;
    }

    while (
        !startOffset &&
        startContainer !== startMax &&
        startContainer !== root
    ) {
        parent = startContainer.parentNode!;
        startOffset = indexOf(parent.childNodes, startContainer);
        startContainer = parent;
    }

    while (endContainer !== endMax && endContainer !== root) {
        if (
            !isTextNode(endContainer) &&
            isBrElement(endContainer.childNodes[endOffset]) &&
            !isLineBreak(endContainer.childNodes[endOffset] as Element, false)
        ) {
            ++endOffset;
        }
        if (endOffset !== getLength(endContainer)) {
            break;
        }
        parent = endContainer.parentNode!;
        endOffset =
            indexOf(parent.childNodes, endContainer) +
            1;
        endContainer = parent;
    }

    range.setStart(startContainer, startOffset);
    range.setEnd(endContainer, endOffset);
};

const moveRangeBoundaryOutOf = (
    range: Range,
    tag: string,
    root: Element,
): Range => {
    let parent = getNearest(range.endContainer, root, tag);
    if (parent && (parent = parent.parentNode)) {
        const clone = range.cloneRange();
        moveRangeBoundariesUpTree(clone, parent, parent, root);
        if (clone.endContainer === parent) {
            range.setStart(clone.endContainer, clone.endOffset);
            range.setEnd(clone.endContainer, clone.endOffset);
        }
    }
    return range;
};

// ---

export {
    isNodeContainedInRange,
    moveRangeBoundariesDownTree,
    moveRangeBoundariesUpTree,
    moveRangeBoundaryOutOf,
};
