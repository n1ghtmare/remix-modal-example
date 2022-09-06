import { useNavigate } from "@remix-run/react";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import Modal from "~/components/Modal";

export default function Edit() {
    const [isModalOpen, setIsModalOpen] = useState(true);

    const navigate = useNavigate();

    function handleDismiss() {
        setIsModalOpen(false);
    }

    function handleExitComplete() {
        navigate("/hello", { replace: true });
    }

    return (
        <AnimatePresence onExitComplete={handleExitComplete}>
            {isModalOpen && (
                <Modal title="My modal" onDismiss={handleDismiss}>
                    <div className="space-y-4 px-5 py-4">Check out the url</div>
                </Modal>
            )}
        </AnimatePresence>
    );
}
