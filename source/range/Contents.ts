import { SHOW_ELEMENT_OR_TEXT, TreeIterator } from '../node/TreeIterator';
import { isNodeContainedInRange } from './Boundaries';
import { isInline } from '../node/Category';
import { isElement, isBrElement, isTextNode } from '../node/Node';

// ---

const getTextContentsOfRange = (range: Range) => {
    if (range.collapsed) {
        return '';
    }
    const startContainer = range.startContainer;
    const endContainer = range.endContainer;
    const walker = new TreeIterator<Element | Text>(
        range.commonAncestorContainer,
        SHOW_ELEMENT_OR_TEXT,
        (node) => isNodeContainedInRange(range, node, true),
    );
    walker.currentNode = startContainer;

    let node: Node | null = startContainer;
    let textContent = '';
    let addedTextInBlock = false;
    let value: string;

    if (
        (!isElement(node) && !isTextNode(node)) ||
        !walker.filter(node as Element)
    ) {
        node = walker.nextNode();
    }

    while (node) {
        if (isTextNode(node)) {
            value = (node as Text).data;
            if (value && /\S/.test(value)) {
                if (node === endContainer) {
                    value = value.slice(0, range.endOffset);
                }
                if (node === startContainer) {
                    value = value.slice(range.startOffset);
                }
                textContent += value;
                addedTextInBlock = true;
            }
        } else if (
            isBrElement(node) ||
            (addedTextInBlock && !isInline(node))
        ) {
            textContent += '\n';
            addedTextInBlock = false;
        }
        node = walker.nextNode();
    }
    // Replace nbsp with regular space;
    // eslint-disable-next-line no-irregular-whitespace
    textContent = textContent.replace(/ /g, ' ');

    return textContent;
};

// ---

export { getTextContentsOfRange };
