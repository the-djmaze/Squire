type NODE_TYPE = 1 | 4 | 5;

TreeWalker.prototype.previousPONode = function() {
    let current = this.currentNode;
    let node = current.lastChild;
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

const createTreeWalker = (root: Node, whatToShow: NODE_TYPE, filter?: (n: T) => boolean) =>
    document.createTreeWalker(
        root,
        whatToShow,
        {
            acceptNode: node => (!filter || filter(node)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
        }
    );

// ---

export { createTreeWalker };
