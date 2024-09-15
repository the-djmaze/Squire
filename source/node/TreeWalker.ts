type NODE_TYPE = 1 | 4 | 5;

const FILTER_ACCEPT = NodeFilter.FILTER_ACCEPT;

TreeWalker.prototype.previousPONode = function(): T | null {
    const root = this.root;
    let current: Node | null = this.currentNode;
    let node: Node | null;
    while (true) {
        node = current.lastChild;
        while (!node && current) {
            if (current === root) {
                break;
            }
            node = current.previousSibling;
            if (!node) {
                current = current.parentNode;
            }
        }
        if (!node) {
            return null;
        }
        const nodeType = node.nodeType;
        const nodeFilterType =
            nodeType === Node.ELEMENT_NODE
                ? NodeFilter.SHOW_ELEMENT
                : nodeType === Node.TEXT_NODE
                  ? NodeFilter.SHOW_TEXT
                  : 0;
        if (!!(nodeFilterType & this.whatToShow) && FILTER_ACCEPT === this.filter.acceptNode(node as T)) {
            this.currentNode = node;
            return node as T;
        }
        current = node;
    }
};

const createTreeWalker = (root: Node, whatToShow: NODE_TYPE, filter?: (n: T) => boolean): TreeWalker =>
    document.createTreeWalker(
        root,
        whatToShow,
        {
            acceptNode: node => (!filter || filter(node)) ? FILTER_ACCEPT : NodeFilter.FILTER_SKIP
        }
    );

// ---

export { FILTER_ACCEPT, createTreeWalker };
