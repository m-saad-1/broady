import { ReactNode } from "react";
import { AccountSidebar } from "./account-sidebar";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:py-8 lg:px-10 md:h-[calc(100vh-100px)]">
      <div className="flex flex-col gap-8 md:flex-row h-full">
        <AccountSidebar className="w-full md:w-64 shrink-0 md:overflow-y-auto pb-6 no-scrollbar" />
        <div className="flex-1 min-w-0 md:overflow-y-auto pb-10 md:pr-4 no-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}
