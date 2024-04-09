type NODE_TYPE = 1 | 4 | 5;
const SHOW_ELEMENT = 1; // NodeFilter.SHOW_ELEMENT;
const SHOW_TEXT = 4; // NodeFilter.SHOW_TEXT;
const SHOW_ELEMENT_OR_TEXT = 5; // SHOW_ELEMENT|SHOW_TEXT;

const filterAccept = NodeFilter.FILTER_ACCEPT;

declare global {
    interface TreeWalker {
        previousPONode(): Node | null;
    }
}

// Previous node in post-order.
TreeWalker.prototype.previousPONode = function() {
    let current: Node | null = this.currentNode;
    let node: Node | null = current.lastChild;
    while (!node && current) {
        if (current === this.root) {
            break;
        }
        node = this.previousSibling();
        if (!node) {
            current = this.parentNode();
        }
    }
    node && (this.currentNode = node);
    return node;
};

const createTreeWalker = (root: Node, whatToShow: NODE_TYPE, filter?: any) =>
    document.createTreeWalker(root, whatToShow, filter ? {
        acceptNode: node => filter(node) ? filterAccept : NodeFilter.FILTER_SKIP
    } : null);

// ---

export {
    SHOW_ELEMENT,
    SHOW_TEXT,
    SHOW_ELEMENT_OR_TEXT,
    createTreeWalker,
};
