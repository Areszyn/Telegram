import { useState } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth } from "@/lib/telegram-context";
import { useCreateDonation, useGetDonationHistory, getGetDonationHistoryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Coins, ExternalLink, History, Copy, Check } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

const CURRENCIES = ["USDT", "BTC", "ETH", "LTC"];

export function DonatePage() {
  const reqOpts = useApiAuth();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState<string>("10");
  const [currency, setCurrency] = useState("USDT");
  const [copied, setCopied] = useState(false);

  const { data: history, isLoading: loadingHistory } = useGetDonationHistory({
    request: reqOpts,
    query: { refetchInterval: 10000 } // Poll for status updates
  });

  const createMut = useCreateDonation({
    request: reqOpts,
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetDonationHistoryQueryKey() });
      }
    }
  });

  const handleDonate = () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return;
    createMut.mutate({ data: { amount: num, currency } });
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Layout title="Support the Project">
      <div className="h-full overflow-y-auto p-4 pb-20">
        
        {/* Make a Donation Card */}
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-lg mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-primary/20 p-2.5 rounded-xl">
              <Coins className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Make a Donation</h2>
              <p className="text-xs text-muted-foreground">Crypto payments via OxaPay</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider">Amount (USD)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-background border-2 border-border/50 rounded-xl px-4 py-3 text-lg font-semibold focus:outline-none focus:border-primary transition-colors"
                placeholder="10.00"
              />
            </div>
            
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider">Select Currency</label>
              <div className="grid grid-cols-4 gap-2">
                {CURRENCIES.map(c => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    className={`py-2.5 rounded-xl font-medium text-sm border-2 transition-all ${
                      currency === c 
                        ? 'border-primary bg-primary/10 text-primary' 
                        : 'border-border/50 bg-background text-muted-foreground hover:border-border'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleDonate}
              disabled={createMut.isPending || parseFloat(amount) <= 0}
              className="w-full mt-2 bg-gradient-to-r from-primary to-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:shadow-none flex justify-center items-center"
            >
              {createMut.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : `Donate ${amount || '0'} USD`}
            </button>
          </div>
        </div>

        {/* Active Invoice Modal/View */}
        <AnimatePresence>
          {createMut.data && createMut.data.ok && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-secondary border border-primary/30 rounded-2xl p-5 shadow-xl mb-6 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-blue-400"></div>
              <h3 className="font-bold text-lg mb-4 text-center">Invoice Created!</h3>
              
              {createMut.data.qrImage && (
                <div className="bg-white p-3 rounded-xl mx-auto w-fit mb-4 shadow-sm">
                  <img src={createMut.data.qrImage} alt="Payment QR Code" className="w-40 h-40" />
                </div>
              )}
              
              {createMut.data.payLink && (
                <div className="space-y-3">
                  <a 
                    href={createMut.data.payLink} 
                    target="_blank" 
                    rel="noreferrer"
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors"
                  >
                    Open Payment Page <ExternalLink className="w-4 h-4" />
                  </a>
                  <button 
                    onClick={() => copyLink(createMut.data.payLink!)}
                    className="w-full flex items-center justify-center gap-2 bg-background border border-border py-3 rounded-xl font-medium hover:bg-white/5 transition-colors text-sm"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copied!" : "Copy Link"}
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* History */}
        <div>
          <div className="flex items-center gap-2 mb-4 px-1">
            <History className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-bold text-muted-foreground">Recent Donations</h3>
          </div>
          
          {loadingHistory ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : !history?.length ? (
            <div className="bg-card border border-border/50 rounded-2xl p-8 text-center text-muted-foreground shadow-sm">
              No donations yet.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map(d => (
                <div key={d.id} className="bg-card border border-border/50 rounded-xl p-4 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="font-bold">${d.amount.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(d.created_at), 'MMM d, yyyy • HH:mm')}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    d.status === 'paid' ? 'bg-green-500/20 text-green-400 border border-green-500/20' : 
                    d.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/20' : 
                    'bg-muted text-muted-foreground'
                  }`}>
                    {d.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
}
