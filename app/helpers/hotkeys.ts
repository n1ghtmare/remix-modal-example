// Note: This can be open-sourced if others need to use it (possible names oxo-hotkeys)
type HotkeyNode = {
    children: Map<string, HotkeyNode>;
    callback?: (e: KeyboardEvent) => void;
};

type HotkeyScope = {
    root: HotkeyNode;
    currentNode: HotkeyNode;
};

let currentScopeName = "global";
let hasBoundKeyListenerToDom = false;
const scopeMap = new Map<string, HotkeyScope>();

function insertIntoTree(
    scope: HotkeyScope,
    hotkeys: string[],
    callback: (e: KeyboardEvent) => void
) {
    let workingNode: HotkeyNode = scope.root;

    for (const hotkey of hotkeys) {
        const { children } = workingNode;
        if (!children?.get(hotkey)) {
            const node: HotkeyNode = {
                children: new Map<string, HotkeyNode>()
            };
            children.set(hotkey, node);
        }
        workingNode = children.get(hotkey) as HotkeyNode;
    }

    workingNode.callback = callback;
}

function removeFromTree(scope: HotkeyScope, hotkeys: string[]) {
    let workingNode: HotkeyNode = scope.root;
    const chain: HotkeyNode[] = [];

    // traverse down the trie & build a chain of nodes that need to be checked for removal
    for (const hotkey of hotkeys) {
        const { children } = workingNode;
        if (!children) {
            return;
        }

        const childNode = children.get(hotkey) as HotkeyNode;
        if (!childNode) {
            return;
        }

        chain.push(workingNode);
        workingNode = childNode;
    }

    if (chain.length === 0) {
        // shouldn't happen (hotkey not found)
        return;
    }

    let lastNode = chain.pop() as HotkeyNode;

    const lastNodeSubNodes = lastNode.children?.get(
        hotkeys[hotkeys.length - 1] as string
    ) as HotkeyNode;

    if (lastNodeSubNodes?.children?.size > 0) {
        // node continues deeper, we're not interested of removing it
        return;
    }

    for (let i = hotkeys.length - 1; i >= 0; i--) {
        lastNode.children.delete(hotkeys[i] as string);

        if (lastNode.children.size > 0) {
            // there are more children (we're in a branch, don't continue removing the parent)
            return;
        }

        lastNode = chain.pop() as HotkeyNode;
    }
}

function searchCurrentNodeForHotkey(scope: HotkeyScope, hotkey: string): HotkeyNode | null {
    const { currentNode } = scope;

    if (!currentNode) {
        return null;
    }

    const { children } = currentNode;

    if (!children.get(hotkey)) {
        return null;
    }

    return children.get(hotkey) as HotkeyNode;
}

function debounce(fn: () => void, milliseconds: number) {
    let timeoutId = 0;

    return () => {
        window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(fn, milliseconds);
    };
}

function normalizeKey(hotkey: string) {
    hotkey = hotkey.trim();

    if (hotkey.length === 1) {
        return hotkey;
    }

    hotkey = hotkey.toLowerCase();

    // TODO: See how to handle space? Also test with meta and OS keys
    switch (hotkey) {
        case "esc":
            return "escape";
        case "ctrl":
            return "control";
        case "option":
            return "alt";
        default:
            return hotkey;
    }
}

let buffer: string[] = [];

function createKeydownListener(debounceTimeInMilliseconds: number) {
    const resetCurrentNodeDebounced = debounce(() => {
        const scope: HotkeyScope = scopeMap.get(currentScopeName) as HotkeyScope;

        if (scope) {
            scope.currentNode = scope.root;
        }
    }, debounceTimeInMilliseconds);

    return (e: KeyboardEvent) => {
        if (e.repeat) {
            return;
        }

        const scope: HotkeyScope = scopeMap.get(currentScopeName) as HotkeyScope;

        if (!scope) {
            return;
        }

        resetCurrentNodeDebounced();

        // Ignore shift since we will destinguish between a and A or / and ? (for example)
        // Ignore OS, we will not be making combinations with OS
        // Also look for repeated buffer keys - shouldn't happen
        // A user can't press and hold the same button twice
        if (
            e.key === "Shift" ||
            e.key === "OS" ||
            buffer.filter((x) => x === normalizeKey(e.key)).length !== 0
        ) {
            return;
        }

        buffer.push(normalizeKey(e.key));

        const node: HotkeyNode = searchCurrentNodeForHotkey(
            scope,
            buffer.sort().join("+")
        ) as HotkeyNode;

        if (node === null) {
            return;
        }

        if (node.callback) {
            node.callback(e);
            // reset we found what we're looking for
            scope.currentNode = scope.root;
            return;
        }

        scope.currentNode = node;
    };
}

function createKeyupListener() {
    return (e: KeyboardEvent) => {
        buffer = buffer.filter((x) => x !== normalizeKey(e.key));

        const scope: HotkeyScope = scopeMap.get(currentScopeName) as HotkeyScope;

        if (scope && buffer.length === 0 && scope.currentNode === null) {
            scope.currentNode = scope.root;
        }
    };
}

// a bug occurs when the user presses a key but unfocuses from the document (the buffer is not cleared)
// here we ensure that the buffer is always clear
function createBlurListener() {
    return () => {
        buffer = [];
        const scope: HotkeyScope = scopeMap.get(currentScopeName) as HotkeyScope;

        if (!scope) {
            return;
        }

        scope.currentNode = scope.root;
    };
}

function createScopeIfNeeded(scopeName: string) {
    const scope = scopeMap.get(scopeName);

    if (scope) {
        return scope;
    }

    const root: HotkeyNode = {
        children: new Map<string, HotkeyNode>()
    };

    const newScope: HotkeyScope = { root, currentNode: root };
    scopeMap.set(scopeName, newScope);

    return newScope;
}

export const setHotkeysScope = (name: string) => {
    // No need to create a scope if there are no listeners
    currentScopeName = name;
};

export const getHotkeysScope = () => currentScopeName;

export function registerHotkey(
    hotkeys: string,
    scopeName: string,
    callback: (e: KeyboardEvent) => void,
    debounceTimeInMilliseconds = 1500
) {
    const scope: HotkeyScope = createScopeIfNeeded(scopeName);
    const processedHotkeys: string[] = hotkeys.split(" ").map((x) =>
        x
            .split("+")
            .map((y) => normalizeKey(y))
            .sort()
            .join("+")
    );

    const keydownListener = createKeydownListener(debounceTimeInMilliseconds);
    const keyupListener = createKeyupListener();
    const blurListener = createBlurListener();

    const bind = () => {
        insertIntoTree(scope, processedHotkeys, callback);

        if (!hasBoundKeyListenerToDom) {
            document.addEventListener("blur", blurListener);
            document.addEventListener("keydown", keydownListener);
            document.addEventListener("keyup", keyupListener);

            hasBoundKeyListenerToDom = true;
        }
    };

    const unbind = () => {
        removeFromTree(scope, processedHotkeys);

        if (hasBoundKeyListenerToDom) {
            document.removeEventListener("blur", blurListener);
            document.removeEventListener("keydown", keydownListener);
            document.removeEventListener("keyup", keyupListener);

            hasBoundKeyListenerToDom = false;
        }
    };

    // autobind
    bind();

    return { bind, unbind };
}
