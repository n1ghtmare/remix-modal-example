import { Link, Outlet } from "@remix-run/react";

export default function Index() {
    return (
        <div>
            <h1 className="text-3xl font-bold">So I heard you like modals?</h1>
            <div className="mt-4">
                <Link
                    to="/hello/edit"
                    replace={true}
                    className="underline text-purple-600 hover:text-purple-700"
                >
                    Open a Modal
                </Link>
            </div>
            <Outlet />
        </div>
    );
}
