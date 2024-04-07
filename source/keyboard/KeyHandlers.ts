import {
    isMac,
    isWin,
    isIOS,
    ctrlKey,
} from '../Constants';
import { deleteContentsOfRange } from '../range/InsertDelete';
import type { Squire } from '../Editor';
import { Backspace } from './Backspace';
import { Delete } from './Delete';
import { ShiftTab, Tab } from './Tab';
import { Space } from './Space';
import { rangeDoesEndAtBlockBoundary } from '../range/Block';
import { moveRangeBoundariesDownTree } from '../range/Boundaries';
import { isTextNode } from '../node/Node';

// ---

const _onKey = function (this: Squire, event: KeyboardEvent): void {
    // Ignore key events where event.isComposing, to stop us from blatting
    // Kana-Kanji conversion
    if (event.defaultPrevented || event.isComposing) {
        return;
    }

    // We need to apply the Backspace/delete handlers regardless of
    // control key modifiers.
    let key = event.key;
    let modifiers = '';
    const code = event.code;
    // If pressing a number key + Shift, make sure we handle it as the number
    // key and not whatever different character the shift might turn it into.
    if (/^Digit\d$/.test(code)) {
        key = code.slice(-1);
    }
    if (key !== 'Backspace' && key !== 'Delete') {
        if (event.altKey) {
            modifiers += 'Alt-';
        }
        if (event.ctrlKey) {
            modifiers += 'Ctrl-';
        }
        if (event.metaKey) {
            modifiers += 'Meta-';
        }
        if (event.shiftKey) {
            modifiers += 'Shift-';
        }
    }
    // However, on Windows, Shift-Delete is apparently "cut" (WTF right?), so
    // we want to let the browser handle Shift-Delete in this situation.
    if (isWin && event.shiftKey && key === 'Delete') {
        modifiers += 'Shift-';
    }
    key = modifiers + key;

    const range: Range = this.getSelection();
    if (this._keyHandlers[key]) {
        this._keyHandlers[key](this, event, range);
    } else if (
        !range.collapsed &&
        !event.ctrlKey &&
        !event.metaKey &&
        key.length === 1
    ) {
        // Record undo checkpoint.
        this.saveUndoState(range);
        // Delete the selection
        deleteContentsOfRange(range, this._root);
        this._ensureBottomLine();
        this.setSelection(range);
        this._updatePath(range, true);
    }
};

const mapKeyToFormat = (
    tag: string,
    remove?: string | undefined,
): KeyHandler => {
    return (self: Squire, event: Event) => {
        event.preventDefault();
        self.toggleTag(tag, remove);
    };
};

const mapKeyTo = (method: string) => (self: Squire, event: Event) => {
    event.preventDefault();
    self[method]();
};

const toggleList = (type: string, methodIfNotInList: string) => (self: Squire, event: Event) => {
    event.preventDefault();
    let parent = self.getSelectionClosest('UL,OL');
    if (type == parent?.nodeName) {
        self.removeList();
    } else {
        self[methodIfNotInList as keyof Squire]();
    }
};

const changeIndentationLevel = (direction: string) => (self: Squire, event: Event) => {
    event.preventDefault();
    self.changeIndentationLevel(direction);
};

// ---

type KeyHandler = (self: Squire, event: KeyboardEvent, range: Range) => void;

const keyHandlers: Record<string, KeyHandler> = {
    Backspace: Backspace,
    Delete: Delete,
    Tab: Tab,
    'Shift-Tab': ShiftTab,
    ' ': Space,
    ArrowLeft(self: Squire): void {
        self._removeZWS();
    },
    ArrowRight(self: Squire, event: KeyboardEvent, range: Range): void {
        self._removeZWS();
        // Allow right arrow to always break out of <code> block.
        const root = self.getRoot();
        if (rangeDoesEndAtBlockBoundary(range, root)) {
            moveRangeBoundariesDownTree(range);
            let node: Node | null = range.endContainer;
            do {
                if (node.nodeName === 'CODE') {
                    let next = node.nextSibling;
                    if (!isTextNode(next)) {
                        const textNode = document.createTextNode(' '); // nbsp
                        node.parentNode!.insertBefore(textNode, next);
                        next = textNode;
                    }
                    range.setStart(next as Text, 1);
                    self.setSelection(range);
                    event.preventDefault();
                    break;
                }
            } while (
                !node.nextSibling &&
                (node = node.parentNode) &&
                node !== root
            );
        }
    },
    [ctrlKey + 'b']: mapKeyToFormat('B'),
    [ctrlKey + 'i']: mapKeyToFormat('I'),
    [ctrlKey + 'u']: mapKeyToFormat('U'),
    [ctrlKey + 'Shift-7']: mapKeyToFormat('S'),
    [ctrlKey + 'Shift-5']: mapKeyToFormat('SUB', 'SUP'),
    [ctrlKey + 'Shift-6']: mapKeyToFormat('SUP', 'SUB'),
    [ctrlKey + "Shift-8"]: toggleList("UL", "makeUnorderedList"),
    [ctrlKey + "Shift-9"]: toggleList("OL", "makeOrderedList"),
    [ctrlKey + "["]: changeIndentationLevel("decrease"),
    [ctrlKey + "]"]: changeIndentationLevel("increase"),
    [ctrlKey + "d"]: mapKeyTo("toggleCode"),
    [ctrlKey + "y"]: mapKeyTo("redo"),
    // Depending on platform, the Shift may cause the key to come through as
    // upper case, but sometimes not. Just add both as shortcuts — the browser
    // will only ever fire one or the other.
    [ctrlKey + "Shift-z"]: mapKeyTo("redo"),
    [ctrlKey + "Shift-Z"]: mapKeyTo("redo"),
    ["Redo"]: mapKeyTo("redo")
//    [ctrlKey + "z"]: mapKeyTo("undo"),
};

// System standard for page up/down on Mac/iOS is to just scroll, not move the
// cursor. On Linux/Windows, it should move the cursor, but some browsers don't
// implement this natively. Override to support it.
if (!isMac && !isIOS) {
    keyHandlers.PageUp = (self: Squire) => {
        self.moveCursorToStart();
    };
    keyHandlers.PageDown = (self: Squire) => {
        self.moveCursorToEnd();
    };
}

// ---

export { _onKey, keyHandlers };
