import { useListUsers, getListUsersQueryKey } from "@workspace/api-client-react";
import { useApiAuth } from "@/lib/telegram-context";
import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { relativeTime } from "@/lib/date";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Inbox } from "lucide-react";
import { motion } from "framer-motion";

function mediaLabel(type?: string | null) {
  if (!type || type === "text") return null;
  const labels: Record<string, string> = {
    photo: "📷 Photo",
    video: "🎥 Video",
    voice: "🎤 Voice",
    audio: "🎵 Audio",
    document: "📄 Document",
  };
  return labels[type] ?? null;
}

function getInitials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function avatarColor(name?: string | null) {
  const colors = [
    "bg-blue-500", "bg-violet-500", "bg-emerald-500",
    "bg-orange-500", "bg-pink-500", "bg-cyan-500",
  ];
  return colors[(name?.charCodeAt(0) ?? 0) % colors.length];
}

export function AdminInbox() {
  const reqOpts = useApiAuth();
  const { data: users, isLoading } = useListUsers({
    request: reqOpts,
    query: { queryKey: getListUsersQueryKey(), refetchInterval: 5000 },
  });

  return (
    <Layout title="Inbox">
      <div className="h-full overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : users?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
            <Inbox className="h-10 w-10 opacity-20" />
            <p className="text-sm">No messages yet</p>
          </div>
        ) : (
          <div>
            {users?.map((user, i) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link
                  href={`/admin/chat/${user.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 active:bg-muted transition-colors"
                >
                  <Avatar className={`shrink-0 ${avatarColor(user.first_name)}`}>
                    <AvatarFallback className={`text-white font-semibold text-sm ${avatarColor(user.first_name)}`}>
                      {getInitials(user.first_name ?? user.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-0.5">
                      <span className="font-semibold text-[15px] truncate">
                        {user.first_name ?? "Unknown"}
                        {user.username && (
                          <span className="text-muted-foreground font-normal text-sm ml-1.5">@{user.username}</span>
                        )}
                      </span>
                      {user.last_msg_at && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                          {relativeTime(user.last_msg_at)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {user.last_msg
                        ? user.last_msg
                        : user.last_media_type
                        ? <span className="italic">{mediaLabel(user.last_media_type)}</span>
                        : <span className="italic opacity-50">No messages</span>}
                    </p>
                  </div>
                </Link>
                {i < (users.length - 1) && <Separator />}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
