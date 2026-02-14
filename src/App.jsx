import React, { useState, useEffect, useCallback } from 'react';
import { initPushNotifications, setupEmotionListener } from './utils/notificationSetup';

import { 
  Heart, 
  LogOut, 
  Copy, 
  Check, 
  ChevronRight, 
  Loader2, 
  ArrowLeft, 
  RefreshCw,
  MessageCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import CryptoJS from 'crypto-js';

// --- INITIALIZATION ---
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'couplex-secret-key';

// --- UTILITIES ---
const encryptText = (text) => CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
const decryptText = (encryptedText) => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || '...';
  } catch { return '...'; }
};

const emotions = [
  { id: 'happy', label: 'ŠŤASTNÝ', symbol: '😊', color: 'bg-amber-50 text-amber-600' },
  { id: 'loved', label: 'MILOVANÝ', symbol: '🥰', color: 'bg-rose-50 text-rose-600' },
  { id: 'calm', label: 'KLIDNÝ', symbol: '🧘', color: 'bg-emerald-50 text-emerald-600' },
  { id: 'sad', label: 'SMUTNÝ', symbol: '😔', color: 'bg-slate-100 text-slate-600' },
  { id: 'anxious', label: 'NERVÓZNÍ', symbol: '😟', color: 'bg-orange-50 text-orange-600' },
    { id: 'angry', label: 'NAŠTVANÝ', symbol: '😡', color: 'bg-red-50 text-red-600' },
  { id: 'tired', label: 'UNAVENÝ', symbol: '🥱', color: 'bg-indigo-50 text-indigo-600' },
];

export default function CouplexApp() {
  const [page, setPage] = useState('auth');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [isCodeCopied, setIsCodeCopied] = useState(false);

  const [currentUser, setCurrentUser] = useState(null);
  const [loginCode, setLoginCode] = useState('');
  const [partner, setPartner] = useState(null);
  const [partnershipId, setPartnershipId] = useState(null);
  const [partnerCodeInput, setPartnerCodeInput] = useState('');
  const [emotionsList, setEmotionsList] = useState([]);
  
  const [selectedEmotion, setSelectedEmotion] = useState(null);
  const [emotionDescription, setEmotionDescription] = useState('');

  // --- NOTIFIKACE ---
  const [emotionListener, setEmotionListener] = useState(null);

  // --- DATA FETCHING ---
  const loadAppData = useCallback(async (userId, silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    
    try {
      const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
      if (user) setCurrentUser(user);

      const { data: partnerResult } = await supabase.rpc('get_partner_info', { p_user_id: String(userId) });

      if (partnerResult?.success) {
        setPartner(partnerResult);
        setPartnershipId(partnerResult.partnership_id);
        
        const { data: ems } = await supabase
          .from('emotions')
          .select('*, shared_by:shared_by_id(username)')
          .eq('partnership_id', partnerResult.partnership_id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (ems) {
          setEmotionsList(ems.map(e => ({ ...e, description: decryptText(e.description) })));
        }
      } else {
        setPartner(null);
        setPartnershipId(null);
        setEmotionsList([]);
      }
    } catch (err) {
      console.error("Data load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

// ============= USEEFFECT #1: LOGIN A INICIALIZACE NOTIFIKACÍ =============
  useEffect(() => {
    const saved = localStorage.getItem('couplex_session');
    if (saved) {
      const userData = JSON.parse(saved);
      setCurrentUser(userData);
      setPage('dashboard');
      
      // Inicializuj Service Worker a push notifikace
      initPushNotifications().then((permissionGranted) => {
        if (permissionGranted) {
          console.log('Push notifikace povoleny');
        }
      });
      
      loadAppData(userData.id);
    }
  }, [loadAppData]);

    // ============= USEEFFECT #2: REAL-TIME LISTENER PRO NOVÉ EMOCE =============
  useEffect(() => {
    if (currentUser && partnershipId && !emotionListener) {
      const listener = setupEmotionListener(
        supabase,
        partnershipId,
        currentUser.id,
        () => {
          // Refresh dat když partner pošle emoci
          loadAppData(currentUser.id, true);
        }
      );
      setEmotionListener(listener);
    }

    // Cleanup - odpojení listener při unmount či změně
    return () => {
      if (emotionListener) {
        emotionListener.unsubscribe();
        setEmotionListener(null);
      }
    };
  }, [currentUser, partnershipId, emotionListener, loadAppData]);

  // --- ACTIONS ---
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginCode.trim()) return;
    setLoading(true);
    setError('');
    
    const { data, error: err } = await supabase.rpc('login_by_code', { p_code: loginCode.toUpperCase().trim() });
    
    if (err || !data?.success) {
      setError('NEPLATNÝ PŘÍSTUPOVÝ KÓD');
      setLoading(false);
    } else {
      localStorage.setItem('couplex_session', JSON.stringify(data));
      setCurrentUser(data);
      setPage('dashboard');
      loadAppData(data.id);
    }
  };

  // ============= HANDLELOGOUT S CLEANUP NOTIFIKACÍ =============
  const handleLogout = () => {
    // Uzavři listener
    if (emotionListener) {
      emotionListener.unsubscribe();
      setEmotionListener(null);
    }

    localStorage.removeItem('couplex_session');
    setPage('auth');
    setCurrentUser(null);
    setPartner(null);
    setPartnershipId(null);
    setEmotionsList([]);
    setLoginCode('');
  };

  const handleConnect = async () => {
    if (!partnerCodeInput.trim()) return;
    setLoading(true);
    const { data } = await supabase.rpc('create_partnership_by_code', {
      p_user_id: String(currentUser.id),
      p_partner_code: partnerCodeInput.toUpperCase().trim()
    });

    if (data?.success) {
      setPartnerCodeInput('');
      await loadAppData(currentUser.id);
    } else {
      setError(data?.error || 'CHYBA SPOJENÍ');
      setLoading(false);
    }
  };

  const handleShareEmotion = async () => {
    if (!selectedEmotion || !partnershipId) return;
    setLoading(true);
    const { error: insErr } = await supabase.from('emotions').insert([{
      partnership_id: partnershipId,
      shared_by_id: currentUser.id,
      emotion_type: selectedEmotion,
      description: encryptText(emotionDescription || ' ')
    }]);

    if (!insErr) {
      setSelectedEmotion(null);
      setEmotionDescription('');
      setPage('dashboard');
      await loadAppData(currentUser.id);
    }
    setLoading(false);
  };

  // --- RENDER HELPERS ---
  if (page === 'auth') return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-12">
        {/* Logo Section */}
        <div className="text-center space-y-4">
          <div className="relative inline-block">
            <Heart size={48} className="text-rose-500 animate-pulse" fill="currentColor" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tighter uppercase">Couplex</h1>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em]">Soukromý prostor pro dva</p>
          </div>
        </div>

        {/* Form Section */}
        <form onSubmit={handleLogin} className="space-y-6" autoComplete="on">
          <div className="space-y-2">
            <label htmlFor="access-code" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
              Váš unikátní kód
            </label>
            <input 
              id="access-code"
              name="access-code"
              value={loginCode}
              onChange={e => setLoginCode(e.target.value)}
              autoFocus
              className="w-full h-16 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-center text-xl font-mono font-bold tracking-[0.3em] text-slate-800 focus:bg-white focus:ring-2 focus:ring-rose-100 transition-all outline-none placeholder:text-slate-200"
              placeholder="••••••••"
            />
          </div>
          
          <button 
            type="submit"
            disabled={loading || loginCode.length < 3}
            className="w-full h-16 bg-rose-500 text-white rounded-2xl font-bold text-sm tracking-widest uppercase shadow-lg shadow-rose-100 hover:bg-rose-600 active:scale-[0.98] transition-all disabled:opacity-20 flex items-center justify-center gap-3"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : (
              <>
                Vstoupit do aplikace
                <ChevronRight size={18} />
              </>
            )}
          </button>

          {error && (
            <div className="flex items-center justify-center gap-2 text-rose-600 bg-rose-50 p-3 rounded-xl animate-in fade-in zoom-in-95">
              <AlertCircle size={14} /> 
              <span className="text-[10px] font-bold tracking-wider uppercase">{error}</span>
            </div>
          )}
        </form>

        {/* Footer Info */}
        <div className="text-center">
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest leading-loose">
            Nemáš kód? <br />
            <span className="text-slate-900 font-bold">Ať ti partner pošle svůj</span>
          </p>
        </div>
      </div>
    </div>
  );

  if (page === 'emotions') return (
    <div className="min-h-screen bg-white max-w-md mx-auto px-6 pt-8">
      <button onClick={() => setPage('dashboard')} className="p-2 -ml-2 text-slate-400 hover:text-slate-600">
        <ArrowLeft size={22} />
      </button>
      
      <div className="mt-8 mb-10">
        <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Jak se dnes cítíš?</h2>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-8">
        {emotions.map(e => (
          <button 
            key={e.id}
            onClick={() => setSelectedEmotion(e.id)}
            className={`flex flex-col items-center p-4 rounded-2xl border transition-all ${
              selectedEmotion === e.id ? 'border-rose-500 bg-rose-50/20' : 'border-slate-50 bg-slate-50/50'
            }`}
          >
            <span className="text-2xl mb-1">{e.symbol}</span>
            <span className="text-[10px] font-bold uppercase tracking-tight text-slate-500">{e.label}</span>
          </button>
        ))}
      </div>

      {selectedEmotion && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <textarea 
            value={emotionDescription}
            onChange={e => setEmotionDescription(e.target.value)}
            placeholder="POPIŠ SVÉ POCITY (NEPOVINNÉ)..."
            className="w-full h-32 p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white outline-none transition-all resize-none text-xs font-semibold uppercase tracking-wider"
          />
          <button 
            onClick={handleShareEmotion}
            className="w-full h-14 bg-rose-500 text-white rounded-2xl font-bold uppercase tracking-widest text-xs flex items-center justify-center"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Poslat partnerovi'}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-10">
      <div className="max-w-md mx-auto px-6 pt-10">
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-xl font-bold text-slate-900 uppercase tracking-tighter">{currentUser?.username}</h1>
            <p className="text-[10px] font-bold text-rose-500 uppercase tracking-[0.2em] mt-0.5">Online</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => loadAppData(currentUser.id, true)}
              className="p-2.5 bg-white border border-slate-100 rounded-xl text-slate-400 active:bg-slate-50 transition-colors"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button onClick={handleLogout} className="p-2.5 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-rose-500 transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {/* User Code */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Můj unikátní kód</span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(currentUser?.unique_code);
                  setIsCodeCopied(true);
                  setTimeout(() => setIsCodeCopied(false), 2000);
                }}
                className="text-[10px] font-bold text-rose-500 uppercase tracking-widest"
              >
                {isCodeCopied ? 'Zkopírováno' : 'Kopírovat'}
              </button>
            </div>
            <p className="text-2xl font-mono font-bold tracking-[0.3em] text-slate-800 text-center bg-slate-50/50 py-3 rounded-xl border border-dashed border-slate-100 uppercase">
              {currentUser?.unique_code}
            </p>
          </div>

          {!partner ? (
            <div className="bg-slate-900 rounded-3xl p-8 text-center shadow-xl">
              <p className="text-white text-[10px] font-bold uppercase tracking-[0.2em] mb-2">Zatím jsi tu sám</p>
              <p className="text-slate-400 text-[11px] mb-8 font-medium uppercase tracking-wider">Propoj se zadáním kódu partnera</p>
              <div className="flex flex-col gap-3">
                <input 
                  placeholder="KÓD PARTNERA"
                  value={partnerCodeInput}
                  onChange={e => setPartnerCodeInput(e.target.value.toUpperCase())}
                  className="h-14 bg-white/10 border border-white/5 rounded-2xl text-center text-white text-sm font-bold tracking-widest outline-none focus:bg-white/15 transition-all"
                />
                <button 
                  onClick={handleConnect}
                  disabled={!partnerCodeInput || loading}
                  className="h-14 bg-white text-slate-900 rounded-2xl font-bold text-xs uppercase tracking-[0.2em] disabled:opacity-20 active:scale-95 transition-all"
                >
                  Propojit
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Partner Card */}
              <div className="bg-rose-500 rounded-3xl p-6 text-white flex items-center justify-between shadow-lg shadow-rose-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Heart size={22} fill="currentColor" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-rose-100 uppercase tracking-widest">Partner</p>
                    <p className="text-lg font-bold uppercase tracking-tight">{partner.partner_name}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setPage('emotions')}
                  className="bg-white text-rose-500 px-5 py-3 rounded-2xl font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-sm"
                >
                  Sdílet emoci
                </button>
              </div>

              {/* History */}
              <div className="space-y-4 px-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Společná historie</h3>
                  <Clock size={14} className="text-slate-300" />
                </div>

                {emotionsList.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50/50 border border-dashed border-slate-200 rounded-3xl">
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Žádné záznamy</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {emotionsList.map((e) => {
                      const emo = emotions.find(em => em.id === e.emotion_type);
                      const isMine = e.shared_by_id === currentUser.id;
                      return (
                        <div key={e.id} className="bg-white border border-slate-100 p-5 rounded-3xl flex gap-4 shadow-sm">
                          <div className={`w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center text-2xl ${emo?.color || 'bg-slate-50'}`}>
                            {emo?.symbol}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-0.5">
                              <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">
                                {isMine ? 'JÁ' : e.shared_by?.username}
                              </span>
                              <span className="text-[9px] text-slate-300 font-bold">
                                {new Date(e.created_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mb-2 font-bold tracking-widest">{emo?.label}</p>
                            {e.description && e.description !== ' ' && (
                              <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-50">
                                <p className="text-[11px] text-slate-600 leading-relaxed font-medium uppercase tracking-tight">{e.description}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}