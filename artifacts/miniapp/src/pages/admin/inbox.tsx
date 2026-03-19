import { useListUsers } from "@workspace/api-client-react";
import { useApiAuth } from "@/lib/telegram-context";
import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Loader2, UserCircle, Image as ImageIcon, Video, FileText, Mic } from "lucide-react";
import { motion } from "framer-motion";

export function AdminInbox() {
  const reqOpts = useApiAuth();
  const { data: users, isLoading } = useListUsers({
    request: reqOpts,
    query: { refetchInterval: 5000 }
  });

  const getMediaPreview = (type?: string | null) => {
    if (!type || type === 'text') return null;
    const iconClass = "w-3.5 h-3.5 inline mr-1 opacity-70";
    switch(type) {
      case 'photo': return <><ImageIcon className={iconClass}/> Photo</>;
      case 'video': return <><Video className={iconClass}/> Video</>;
      case 'voice':
      case 'audio': return <><Mic className={iconClass}/> Audio</>;
      case 'document': return <><FileText className={iconClass}/> Document</>;
      default: return null;
    }
  };

  return (
    <Layout title="Inbox">
      <div className="h-full overflow-y-auto bg-background">
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : users?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <UserCircle className="w-16 h-16 mb-4 opacity-20" />
            <p>No users found</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {users?.map((user, i) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                key={user.id}
              >
                <Link 
                  href={`/admin/chat/${user.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-card/50 transition-colors active:bg-card"
                >
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/80 to-blue-600 flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-inner">
                    {user.first_name?.charAt(0).toUpperCase() || user.username?.charAt(0).toUpperCase() || "?"}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className="font-semibold text-[16px] truncate pr-2">
                        {user.first_name || "Unknown"} {user.username ? <span className="text-muted-foreground font-normal text-sm">@{user.username}</span> : ''}
                      </h3>
                      {user.last_msg_at && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                          {formatDistanceToNow(new Date(user.last_msg_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                    <p className="text-[14px] text-muted-foreground truncate h-5">
                      {user.last_msg ? (
                        user.last_msg
                      ) : user.last_media_type ? (
                        <span className="italic text-primary/80">{getMediaPreview(user.last_media_type)}</span>
                      ) : (
                        <span className="italic opacity-50">No messages</span>
                      )}
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
