import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { motion } from "framer-motion";
import { XIcon } from "@heroicons/react/solid";

import { registerHotkey, setHotkeysScope } from "~/helpers/hotkeys";

export function useOutsideRefsClick(refs: React.RefObject<HTMLElement>[], callback: () => void) {
    useEffect(() => {
        function listener(e: Event) {
            const filteredRefs = refs.filter(
                (x) => !x.current || x.current.contains(e.target as Node)
            );

            if (filteredRefs.length === 0) {
                callback();
            }
        }

        document.addEventListener("mousedown", listener);
        document.addEventListener("touchstart", listener);

        return () => {
            document.removeEventListener("mousedown", listener);
            document.removeEventListener("touchstart", listener);
        };
    }, [refs, callback]);
}

export default function Modal(
    props: React.PropsWithChildren<{
        title?: string;
        isDisabled?: boolean;
        onDismiss: () => void;
    }>
) {
    const [isInitialized, setIsInitialized] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const scrollbarWidth: number = window.innerWidth - document.body.offsetWidth;

        document.body.style.overflow = "hidden";
        document.body.style.paddingRight = `${scrollbarWidth}px`;

        setIsInitialized(true);
        setHotkeysScope("modal");

        return () => {
            document.body.style.removeProperty("overflow");
            document.body.style.removeProperty("padding-right");
        };
    }, []);

    const { onDismiss, isDisabled } = props;

    const handleOutsideClickOrDismissKeypress = useCallback(() => {
        if (isInitialized && !isDisabled) {
            onDismiss();
        }
    }, [onDismiss, isInitialized, isDisabled]);

    useOutsideRefsClick([modalRef], handleOutsideClickOrDismissKeypress);

    useEffect(() => {
        const { unbind } = registerHotkey("Esc", "modal", (e: KeyboardEvent) => {
            e.preventDefault();
            handleOutsideClickOrDismissKeypress();
        });

        return () => {
            unbind();
        };
    }, [handleOutsideClickOrDismissKeypress]);

    return (
        <>
            {isInitialized &&
                createPortal(
                    <>
                        {/* Overlay */}
                        <div className="fixed inset-0 z-30">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 0.75 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="absolute inset-0 bg-zinc-700"
                            />
                        </div>

                        {/* Modal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="fixed inset-0 z-40 flex items-center justify-center"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="modal-title"
                        >
                            <div
                                ref={modalRef}
                                className="z-50 w-full overflow-hidden rounded bg-white text-zinc-900 shadow-md dark:bg-zinc-800 dark:text-zinc-200 sm:max-w-lg"
                            >
                                <div className="flex items-center border-b px-5 py-4 dark:border-zinc-700">
                                    <h3
                                        className="flex-1 text-lg font-bold leading-6 tracking-tight"
                                        id="modal-title"
                                    >
                                        {props.title}
                                    </h3>
                                    {!isDisabled && (
                                        <button
                                            onClick={handleOutsideClickOrDismissKeypress}
                                            className="text-zinc-500 outline-purple-500 hover:text-purple-500"
                                        >
                                            <XIcon className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                                <div className="">{props.children}</div>
                            </div>
                        </motion.div>
                    </>,
                    document.getElementById("modal-container") as Element
                )}
        </>
    );
}
