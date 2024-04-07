import { ELEMENT_NODE, TEXT_NODE, DOCUMENT_FRAGMENT_NODE } from '../Constants';
import { isElement } from './Node';

// ---

//const phrasingElements = 'ABBR,AUDIO,B,BDO,BR,BUTTON,CANVAS,CITE,CODE,COMMAND,DATA,DATALIST,DFN,EM,EMBED,I,IFRAME,IMG,INPUT,KBD,KEYGEN,LABEL,MARK,MATH,METER,NOSCRIPT,OBJECT,OUTPUT,PROGRESS,Q,RUBY,SAMP,SCRIPT,SELECT,SMALL,SPAN,STRONG,SUB,SUP,SVG,TEXTAREA,TIME,VAR,VIDEO,WBR';

const inlineNodeNames =
    /^(?:#text|A|ABBR|ACRONYM|B|BR|BD[IO]|CITE|CODE|DATA|DEL|DFN|EM|FONT|HR|I|IMG|INPUT|INS|KBD|Q|RP|RT|RUBY|S|SAMP|SMALL|SPAN|STR(IKE|ONG)|SU[BP]|TIME|U|VAR|WBR)$/;

const leafNodeNames = new Set(['BR', 'HR', 'IMG']);

const UNKNOWN = 0;
const INLINE = 1;
const BLOCK = 2;
const CONTAINER = 3;

// ---

let cache: WeakMap<Node, number> = new WeakMap();

const resetNodeCategoryCache = (): void => {
    cache = new WeakMap();
};

// ---

const isLeaf = (node: Node): boolean => isElement(node) && leafNodeNames.has(node.nodeName);

const getNodeCategory = (node: Node): number => {
    switch (node.nodeType) {
        case TEXT_NODE:
            return INLINE;
        case ELEMENT_NODE:
        case DOCUMENT_FRAGMENT_NODE:
            if (cache.has(node)) {
                return cache.get(node) as number;
            }
            break;
        default:
            return UNKNOWN;
    }

    let nodeCategory: number =
        Array.prototype.every.call(node.childNodes, isInline)
        ? (inlineNodeNames.test(node.nodeName) ? INLINE : BLOCK)
        // Malformed HTML can have block tags inside inline tags. Need to treat
        // these as containers rather than inline. See #239.
        : CONTAINER;
    cache.set(node, nodeCategory);
    return nodeCategory;
};

const isInline = (node: Node): boolean => getNodeCategory(node) === INLINE;

const isBlock = (node: Node): boolean => getNodeCategory(node) === BLOCK;

const isContainer = (node: Node): boolean => getNodeCategory(node) === CONTAINER;

// ---

export {
    getNodeCategory,
    isBlock,
    isContainer,
    isInline,
    isLeaf,
    leafNodeNames,
    resetNodeCategoryCache,
};
