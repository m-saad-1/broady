"use client";

import { useEffect, useState } from "react";
import { getUserNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import type { NotificationItem } from "@/types/marketplace";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    try {
      const data = await getUserNotifications();
      setNotifications(data || []);
    } catch (error) {
      console.error("Failed to load notifications", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, []);

  const onMarkRead = async (id: string) => {
    try {
      await markNotificationAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
    } catch (error) {
      console.error("Failed to mark read", error);
    }
  };

  const onMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    } catch (error) {
      console.error("Failed to mark all read", error);
    }
  };

  return (
    <main className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-300 pb-5">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Updates</p>
          <h1 className="font-heading text-4xl uppercase">Notifications</h1>
        </div>
        {notifications.some(n => !n.readAt) && (
          <button onClick={onMarkAllRead} className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-black">
            Mark all as read
          </button>
        )}
      </header>

      {loading ? (
        <div className="py-20 text-center text-zinc-500 uppercase tracking-widest text-xs">Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <div className="border border-zinc-200 p-16 text-center">
          <p className="text-zinc-500">You have no notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((item) => (
            <div 
              key={item.id} 
              className={`p-5 border flex gap-4 items-start transition-all ${item.readAt ? "border-zinc-100 opacity-70" : "border-zinc-300 bg-white shadow-sm"}`}
              onClick={() => !item.readAt && void onMarkRead(item.id)}
            >
              <div className={`w-2 h-2 mt-2 rounded-full shrink-0 ${item.readAt ? "bg-transparent" : "bg-black"}`} />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-sm text-zinc-600 line-clamp-2">{item.message}</p>
                <div className="flex items-center gap-3 pt-1">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-400">
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </p>
                  {item.targetPath && (
                    <Link href={item.targetPath} className="text-[10px] font-bold uppercase tracking-widest underline underline-offset-4">
                      View Details
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
