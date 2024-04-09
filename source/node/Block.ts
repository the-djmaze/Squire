import { createTreeWalker, SHOW_ELEMENT } from './TreeIterator';
import { isBlock } from './Category';

// ---

const getBlockWalker = (
    node: Node,
    root: Element | DocumentFragment,
): TreeWalker => {
    const walker = createTreeWalker(root, SHOW_ELEMENT, isBlock);
    walker.currentNode = node;
    return walker;
};

const getPreviousBlock = (
    node: Node,
    root: Element | DocumentFragment,
): HTMLElement | null => {
    const block = getBlockWalker(node, root).previousNode() as HTMLElement;
    return block !== root ? block : null;
};

const getNextBlock = (
    node: Node,
    root: Element | DocumentFragment,
): HTMLElement | null => {
    const block = getBlockWalker(node, root).nextNode() as HTMLElement;
    return block !== root ? block : null;
};

const isEmptyBlock = (block: Element): boolean =>
    !block.textContent && !block.querySelector('IMG');

// ---

export { getBlockWalker, getPreviousBlock, getNextBlock, isEmptyBlock };
