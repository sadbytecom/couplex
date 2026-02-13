import React, { useState, useEffect } from 'react';
import { Heart, Sparkles, LogOut, Copy, Check, ChevronRight, Loader, ArrowLeft, Menu, X } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const emotions = [
  { id: 'happy', label: 'Šťastný', color: '#FCD34D', symbol: '😊' },
  { id: 'loved', label: 'Milovaný', color: '#F87171', symbol: '💕' },
  { id: 'calm', label: 'Klidný', color: '#93C5FD', symbol: '🌿' },
  { id: 'excited', label: 'Nadšený', color: '#C4B5FD', symbol: '✨' },
  { id: 'sad', label: 'Smutný', color: '#A1A1AA', symbol: '😢' },
  { id: 'anxious', label: 'Nervózní', color: '#F97316', symbol: '😰' },
];

export default function CouplexApp() {
  const [page, setPage] = useState('auth');
  const [loginCode, setLoginCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [currentUser, setCurrentUser] = useState(null);
  const [userCode, setUserCode] = useState('');
  const [partner, setPartner] = useState(null);
  const [partnerCode, setPartnerCode] = useState('');
  const [partnershipId, setPartnershipId] = useState(null);
  const [isCodeCopied, setIsCodeCopied] = useState(false);
  const [selectedEmotion, setSelectedEmotion] = useState(null);
  const [emotionDescription, setEmotionDescription] = useState('');
  const [emotionsList, setEmotionsList] = useState([]);

  useEffect(() => {
    const savedUser = localStorage.getItem('couplex_user');
    if (savedUser) {
      const userData = JSON.parse(savedUser);
      setCurrentUser(userData);
      setUserCode(userData.unique_code);
      setPage('dashboard');
      fetchUserData(userData.id);
    }
  }, []);

  useEffect(() => {
    if (!partnershipId) return;

    const subscription = supabase
      .channel(`emotions-${partnershipId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'emotions',
          filter: `partnership_id=eq.${partnershipId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setEmotionsList(prev => [payload.new, ...prev]);
          }
        }
      )
      .subscribe();

    return () => subscription.unsubscribe();
  }, [partnershipId]);

  const fetchUserData = async (userId) => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    setCurrentUser(data);
    setUserCode(data.unique_code);

    const partnerResult = await supabase.rpc('get_partner_info', {
      p_user_id: String(data.id)
    });

    if (partnerResult.data?.success) {
      setPartner(partnerResult.data);
      setPartnershipId(partnerResult.data.partnership_id);
      fetchEmotions(partnerResult.data.partnership_id);
    }
  };

  const fetchEmotions = async (pid) => {
    const { data } = await supabase
      .from('emotions')
      .select('*, shared_by:shared_by_id(username)')
      .eq('partnership_id', pid)
      .order('created_at', { ascending: false });

    setEmotionsList(data || []);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginCode.trim()) return;

    setLoading(true);
    setError('');

    const { data } = await supabase.rpc('login_by_code', {
      p_code: loginCode.toUpperCase()
    });

    if (!data.success) {
      setError(data.error || 'Neplatný kód');
      setLoading(false);
      return;
    }

    localStorage.setItem('couplex_user', JSON.stringify(data));
    setCurrentUser(data);
    setUserCode(data.unique_code);
    setLoginCode('');
    setPage('dashboard');
    await fetchUserData(data.id);
    setLoading(false);
  };

  const handleConnectPartner = async () => {
    if (!partnerCode.trim()) return;

    setLoading(true);
    setError('');

    const { data } = await supabase.rpc('create_partnership_by_code', {
      p_user_id: String(currentUser.id),
      p_partner_code: partnerCode.toUpperCase()
    });

    if (!data?.success) {
      setError(data?.error || 'Spojení se nezdařilo');
      setLoading(false);
      return;
    }

    setPartnerCode('');
    await fetchUserData(currentUser.id);
    setLoading(false);
  };

  const handleShareEmotion = async () => {
    if (!selectedEmotion || !emotionDescription.trim()) return;

    setLoading(true);

    await supabase.from('emotions').insert([{
      partnership_id: partnershipId,
      shared_by_id: currentUser.id,
      emotion_type: selectedEmotion,
      description: emotionDescription
    }]);

    setSelectedEmotion(null);
    setEmotionDescription('');
    setPage('dashboard');
    setLoading(false);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(userCode);
    setIsCodeCopied(true);
    setTimeout(() => setIsCodeCopied(false), 1500);
  };

  const handleLogout = () => {
    localStorage.removeItem('couplex_user');
    setPage('auth');
  };

  /* AUTH PAGE */
  if (page === 'auth') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center px-4 sm:px-6 bg-gradient-to-br from-rose-50 via-white to-pink-50 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-10 right-10 w-40 h-40 bg-gradient-to-br from-rose-200/30 to-pink-200/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 left-5 w-32 h-32 bg-gradient-to-br from-rose-200/20 to-transparent rounded-full blur-2xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        {/* Main card */}
        <div className="w-full max-w-md relative z-10">
          {/* Decorative hearts */}
          <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
            <Heart className="w-6 h-6 text-rose-300 fill-rose-300 animate-bounce" style={{ animationDelay: '0.1s' }} />
          </div>

          <div className="glass-card-premium p-8 sm:p-10 space-y-8">
            {/* Logo */}
            <div className="text-center space-y-2">
              <div className="flex justify-center mb-3">
                <div className="relative">
                  <Heart className="w-8 h-8 text-rose-400 fill-rose-400 animate-pulse" />
                </div>
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-rose-400 to-pink-500 bg-clip-text text-transparent">
                Couplex
              </h1>
              <p className="text-sm text-gray-500 font-medium">Sdílej city s láskou</p>
            </div>

            {/* Error message */}
            {error && (
              <div className="animate-slide-down">
                <div className="text-sm text-rose-600 bg-rose-50/80 backdrop-blur border border-rose-200/50 rounded-2xl px-4 py-3 text-center">
                  {error}
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-3">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Tvůj kód
                </label>
                <input
                  type="text"
                  value={loginCode}
                  onChange={(e) => setLoginCode(e.target.value.toUpperCase())}
                  placeholder="ABC123XY"
                  maxLength="8"
                  className="modern-input-premium tracking-widest uppercase text-center text-lg font-semibold"
                  autoComplete="off"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !loginCode.trim()}
                className="primary-button-premium group"
              >
                {loading ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                  </>
                ) : (
                  <>
                    <span>Přihlásit se</span>
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Bottom text */}
            <div className="text-center text-xs text-gray-500">
              Nemáš kód? Poproš své lásce, aby ti jej poslal ❤️
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* EMOTIONS PAGE */
  if (page === 'emotions') {
    const selectedEmotionObj = emotions.find(e => e.id === selectedEmotion);

    return (
      <div className="min-h-screen w-full px-4 sm:px-6 py-6 pb-24 bg-gradient-to-br from-rose-50 via-white to-pink-50">
        {/* Header with back button */}
        <div className="flex items-center gap-3 mb-8 animate-fade-in">
          <button
            onClick={() => {
              setSelectedEmotion(null);
              setEmotionDescription('');
              setPage('dashboard');
            }}
            className="p-2.5 rounded-xl hover:bg-white/60 transition-all active:scale-95"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sdílet emoci</h1>
            <p className="text-xs text-gray-500">Jak se cítíš teď?</p>
          </div>
        </div>

        {/* Emotion selection grid */}
        <div className="grid grid-cols-3 gap-2.5 mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          {emotions.map((e, idx) => (
            <button
              key={e.id}
              onClick={() => setSelectedEmotion(e.id)}
              className={`emotion-button ${selectedEmotion === e.id ? 'emotion-button-active' : ''}`}
              style={{ animationDelay: `${idx * 0.05}s` }}
            >
              <div className="text-3xl mb-2 block">{e.symbol}</div>
              <div className="text-xs font-medium text-gray-700">{e.label}</div>
            </button>
          ))}
        </div>

        {/* Description input and submit */}
        {selectedEmotion && (
          <div className="animate-slide-down space-y-4">
            <div className="glass-card-premium p-6 space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="text-2xl">{selectedEmotionObj?.symbol}</div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedEmotionObj?.label}
                  </p>
                  <p className="text-xs text-gray-500">Popsat více?</p>
                </div>
              </div>

              <textarea
                value={emotionDescription}
                onChange={(e) => setEmotionDescription(e.target.value)}
                placeholder="Řekni své lásce, co cítíš... ✨"
                className="modern-input-premium resize-none focus:ring-rose-300"
                rows="5"
                maxLength="500"
              />

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{emotionDescription.length}/500</span>
              </div>

              <button
                onClick={handleShareEmotion}
                disabled={loading || !emotionDescription.trim()}
                className="primary-button-premium group"
              >
                {loading ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                  </>
                ) : (
                  <>
                    <Heart className="w-5 h-5" />
                    <span>Sdílet emoci</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* DASHBOARD */
  return (
    <div className="min-h-screen w-full px-4 sm:px-6 py-6 pb-24 bg-gradient-to-br from-rose-50 via-white to-pink-50">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 animate-fade-in">
        <div>
          <p className="text-xs uppercase font-semibold text-gray-500 tracking-wide">Přihlášen/a</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-1">
            {currentUser?.username}
          </h1>
        </div>
        <button
          onClick={handleLogout}
          className="p-2.5 rounded-xl hover:bg-white/60 transition-all active:scale-95"
          title="Odhlásit se"
        >
          <LogOut className="w-6 h-6 text-gray-700" />
        </button>
      </div>

      {/* User code card */}
      <div className="glass-card-premium p-6 space-y-4 mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-semibold text-gray-600 tracking-wide">
              Tvůj unikátní kód
            </p>
            <p className="text-xs text-gray-500 mt-1">Sdílej to se svou láskou</p>
          </div>
          <button
            onClick={copyCode}
            className={`p-2.5 rounded-lg transition-all ${
              isCodeCopied
                ? 'bg-green-100 text-green-600'
                : 'hover:bg-white/60 text-gray-600'
            }`}
          >
            {isCodeCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
        <div className="text-4xl sm:text-5xl tracking-[0.3em] text-center font-bold bg-gradient-to-r from-rose-400 to-pink-500 bg-clip-text text-transparent">
          {userCode}
        </div>
        {isCodeCopied && (
          <p className="text-xs text-center text-green-600 font-medium animate-pulse">
            Kód zkopírován! ✓
          </p>
        )}
      </div>

      {/* Partner connection or info */}
      {!partner?.success ? (
        <div className="glass-card-premium p-6 space-y-4 mb-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Připoj se s miláčkem</h3>
            <p className="text-xs text-gray-500">Vzájemně si sdílíte kódy</p>
          </div>

          {error && (
            <div className="text-xs text-rose-600 bg-rose-50/80 rounded-xl px-3 py-2 text-center">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <input
              value={partnerCode}
              onChange={(e) => setPartnerCode(e.target.value.toUpperCase())}
              placeholder="Kód partnera"
              maxLength="8"
              className="modern-input-premium uppercase text-center font-semibold tracking-widest"
              autoComplete="off"
            />
            <button
              onClick={handleConnectPartner}
              disabled={loading || !partnerCode.trim()}
              className="primary-button-premium shrink-0 px-4"
            >
              {loading ? (
                <Loader className="w-5 h-5 animate-spin" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Connected status */}
          <div className="glass-card-premium p-6 text-center mb-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Heart className="w-5 h-5 text-rose-400 fill-rose-400 animate-pulse" />
              <p className="font-semibold text-gray-900">Spojen s <span className="text-rose-500">{partner.partner_name}</span></p>
              <Heart className="w-5 h-5 text-rose-400 fill-rose-400 animate-pulse" style={{ animationDelay: '0.5s' }} />
            </div>
            <p className="text-xs text-gray-500">Sdílej city a buduj intimitu</p>
          </div>

          {/* Share emotion button */}
          <button
            onClick={() => setPage('emotions')}
            className="primary-button-premium mb-8 group animate-fade-in"
            style={{ animationDelay: '0.3s' }}
          >
            <Sparkles className="w-5 h-5" />
            <span>Sdílit emoci</span>
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Emotions list */}
          <div className="space-y-3">
            <p className="text-xs uppercase font-semibold text-gray-600 tracking-wide px-1">
              Nedávné emoce
            </p>

            {emotionsList.length === 0 ? (
              <div className="glass-card-premium p-8 text-center">
                <Sparkles className="w-8 h-8 text-rose-300 mx-auto mb-3" />
                <p className="text-sm text-gray-600">Zatím zde nejsou žádné emoce</p>
                <p className="text-xs text-gray-500 mt-1">Začni sdílet, aby jste se lépe poznali ✨</p>
              </div>
            ) : (
              emotionsList.map((e, idx) => {
                const emotionObj = emotions.find(em => em.id === e.emotion_type);
                return (
                  <div
                    key={e.id}
                    className="glass-card-premium p-5 space-y-2.5 animate-slide-up"
                    style={{ animationDelay: `${idx * 0.05}s` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="text-2xl">{emotionObj?.symbol}</div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">
                            {e.shared_by?.username}
                          </p>
                          <p className="text-xs text-gray-500">
                            {emotionObj?.label}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">
                          {new Date(e.created_at).toLocaleDateString('cs-CZ', {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {e.description}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}