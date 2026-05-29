import { ReactNode } from "react";
import { AccountSidebar } from "./account-sidebar";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-[calc(100vh-96px)] w-full max-w-7xl px-4 py-5 lg:px-8">
      <div className="flex min-h-[calc(100vh-136px)] flex-col gap-6 md:flex-row">
        <AccountSidebar className="w-full md:w-52 shrink-0 md:overflow-y-auto pb-6 no-scrollbar" />
        <div className="flex-1 min-w-0 pb-10">
          {children}
        </div>
      </div>
    </div>
  );
}
