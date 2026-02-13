import React, { useState, useEffect } from 'react';
import { Heart, Sparkles, LogOut, Copy, Check, ChevronRight, Loader, ArrowLeft, AlertCircle } from 'lucide-react';
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

// Organic heart component for background
const OrganicHeart = ({ size = 'md', delay = 0, style = {} }) => {
  const sizeMap = {
    sm: 'w-3 h-3',
    md: 'w-5 h-5',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  };

  const animationMap = {
    sm: 'animate-float-soft',
    md: 'animate-float-medium',
    lg: 'animate-float-large',
    xl: 'animate-pulse'
  };

  return (
    <div
      style={{
        ...style,
        animationDelay: `${delay}s`
      }}
      className={`${sizeMap[size]} absolute pointer-events-none`}
    >
      <svg
        viewBox="0 0 24 24"
        className={`w-full h-full ${animationMap[size]}`}
        style={{ filter: 'drop-shadow(0 2px 4px rgba(244, 63, 94, 0.2))' }}
      >
        <path
          d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
          fill="currentColor"
          opacity="0.5"
        />
      </svg>
    </div>
  );
};

export default function CouplexApp() {
  const [page, setPage] = useState('auth');
  const [loginCode, setLoginCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  /* ========== AUTH PAGE ========== */
  if (page === 'auth') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center px-4 sm:px-6 relative overflow-hidden">
        {/* Animated organic background hearts */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Large background blurs */}
          <div className="absolute top-20 right-16 w-64 h-64 bg-gradient-to-br from-rose-200/20 to-pink-200/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-32 -left-20 w-80 h-80 bg-gradient-to-br from-rose-200/15 to-pink-200/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }}></div>

          {/* Organic floating hearts */}
          <OrganicHeart size="lg" delay={0} style={{ top: '15%', right: '12%', color: 'rgb(244, 63, 94)' }} />
          <OrganicHeart size="md" delay={0.3} style={{ top: '25%', left: '10%', color: 'rgb(236, 72, 153)' }} />
          <OrganicHeart size="sm" delay={0.6} style={{ top: '40%', right: '8%', color: 'rgb(244, 63, 94)' }} />
          <OrganicHeart size="md" delay={1} style={{ bottom: '25%', left: '15%', color: 'rgb(236, 72, 153)' }} />
          <OrganicHeart size="sm" delay={1.3} style={{ bottom: '30%', right: '20%', color: 'rgb(244, 63, 94)' }} />
          <OrganicHeart size="xl" delay={1.6} style={{ top: '60%', left: '5%', color: 'rgb(248, 113, 113)', opacity: 0.2 }} />
        </div>

        {/* Main card */}
        <div className="w-full max-w-md relative z-10">
          {/* Card */}
          <div className="glass-card-premium p-8 sm:p-12 space-y-10">
            {/* Logo Section */}
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-rose-400 to-pink-500 rounded-full blur-2xl opacity-35 animate-pulse"></div>
                  <Heart className="w-12 h-12 text-rose-500 fill-rose-500 relative animate-bounce" />
                </div>
              </div>
              <h1 className="text-6xl sm:text-7xl font-bold text-gradient">
                Couplex
              </h1>
              <p className="text-base text-gray-600 font-medium">
                Sdílej city s láskou
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="animate-slide-down">
                <div className="flex items-start gap-3 bg-red-50/90 backdrop-blur border border-red-200/60 rounded-2xl px-5 py-4">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700 font-semibold">{error}</p>
                </div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-3">
                <label htmlFor="login-code" className="text-gray-700">
                  Tvůj kód
                </label>
                <input
                  id="login-code"
                  type="text"
                  value={loginCode}
                  onChange={(e) => setLoginCode(e.target.value.toUpperCase())}
                  placeholder="Zadej kód"
                  maxLength="8"
                  autoComplete="off"
                  className="modern-input-premium tracking-[0.15em] uppercase text-center text-lg font-bold text-gray-900"
                  aria-label="Přihlašovací kód"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !loginCode.trim()}
                className="primary-button-premium group"
                aria-busy={loading}
              >
                {loading ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    <span>Přihlašuji...</span>
                  </>
                ) : (
                  <>
                    <span>Přihlásit se</span>
                    <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>

            {/* Helper Text */}
            <div className="pt-6 border-t border-gray-200/40">
              <p className="text-sm text-center text-gray-700 leading-relaxed font-medium">
                Nemáš kód?{' '}
                <span className="text-gray-900 font-bold">
                  Poproš svého partnera, aby ti jej poslal
                </span>
                <span className="ml-2">💕</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ========== EMOTIONS PAGE ========== */
  if (page === 'emotions') {
    const selectedEmotionObj = emotions.find(e => e.id === selectedEmotion);

    return (
      <div className="min-h-screen w-full px-4 sm:px-6 py-6 pb-24 relative overflow-hidden">
        {/* Subtle background hearts */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
          <OrganicHeart size="lg" delay={0} style={{ top: '10%', right: '5%', color: 'rgb(244, 63, 94)' }} />
          <OrganicHeart size="md" delay={1} style={{ bottom: '20%', left: '10%', color: 'rgb(236, 72, 153)' }} />
        </div>

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center gap-4 mb-10 animate-fade-in">
            <button
              onClick={() => {
                setSelectedEmotion(null);
                setEmotionDescription('');
                setPage('dashboard');
              }}
              className="p-3 rounded-2xl hover:bg-white/60 transition-all active:scale-90 text-gray-700"
              aria-label="Zpět na dashboard"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Sdílet emoci</h1>
              <p className="text-sm text-gray-600 mt-1">Jak se cítíš teď?</p>
            </div>
          </div>

          {/* Emotion Grid */}
          <div className="grid grid-cols-3 gap-3 mb-10 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            {emotions.map((e, idx) => (
              <button
                key={e.id}
                onClick={() => setSelectedEmotion(e.id)}
                className={`emotion-button ${selectedEmotion === e.id ? 'emotion-button-active' : ''}`}
                style={{ animationDelay: `${idx * 0.07}s` }}
                aria-pressed={selectedEmotion === e.id}
                aria-label={`Vybrat emoci: ${e.label}`}
              >
                <span className="text-4xl block">{e.symbol}</span>
                <span className="text-xs font-bold text-gray-800">{e.label}</span>
              </button>
            ))}
          </div>

          {/* Description Section */}
          {selectedEmotion && (
            <div className="animate-slide-down max-w-2xl">
              <div className="glass-card-premium p-8 space-y-6">
                {/* Selected emotion preview */}
                <div className="flex items-center gap-4 pb-5 border-b border-gray-200/40">
                  <span className="text-4xl">{selectedEmotionObj?.symbol}</span>
                  <div>
                    <p className="font-bold text-gray-900 text-xl">
                      {selectedEmotionObj?.label}
                    </p>
                    <p className="text-xs text-gray-600 font-semibold mt-1">Řekni více</p>
                  </div>
                </div>

                {/* Textarea */}
                <div className="space-y-3">
                  <label htmlFor="emotion-text" className="text-gray-700">
                    Tvoje zpráva
                  </label>
                  <textarea
                    id="emotion-text"
                    value={emotionDescription}
                    onChange={(e) => setEmotionDescription(e.target.value)}
                    placeholder="Řekni své lásce, co přesně cítíš..."
                    maxLength="500"
                    rows="6"
                    className="modern-input-premium"
                    aria-label="Popis emoce"
                  />

                  {/* Character counter */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 font-medium">
                      {emotionDescription.length}
                      <span className="text-gray-500"> / 500</span>
                    </span>
                    {emotionDescription.length > 400 && (
                      <span className="text-amber-600 font-bold">Skoro hotovo ✨</span>
                    )}
                  </div>
                </div>

                {/* Submit button */}
                <button
                  onClick={handleShareEmotion}
                  disabled={loading || !emotionDescription.trim()}
                  className="primary-button-premium group mt-2"
                  aria-busy={loading}
                >
                  {loading ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      <span>Odesílám...</span>
                    </>
                  ) : (
                    <>
                      <Heart className="w-5 h-5" />
                      <span>Sdílet emoci</span>
                      <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ========== DASHBOARD PAGE ========== */
  return (
    <div className="min-h-screen w-full px-4 sm:px-6 py-6 pb-24 relative overflow-hidden">
      {/* Subtle background hearts */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <OrganicHeart size="lg" delay={0} style={{ top: '10%', right: '10%', color: 'rgb(244, 63, 94)' }} />
        <OrganicHeart size="md" delay={1.5} style={{ bottom: '30%', left: '8%', color: 'rgb(236, 72, 153)' }} />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-10 animate-fade-in">
          <div>
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">
              Přihlášen/a
            </p>
            <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mt-2">
              {currentUser?.username}
            </h1>
          </div>
          <button
            onClick={handleLogout}
            className="p-3 rounded-2xl hover:bg-white/60 transition-all active:scale-90 text-gray-700"
            title="Odhlásit se"
            aria-label="Odhlásit se z aplikace"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>

        {/* User Code Card */}
        <div className="glass-card-premium p-8 space-y-7 mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Tvůj unikátní kód
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Sdílej ho se svým partnerem
              </p>
            </div>
            <button
              onClick={copyCode}
              className={`p-3 rounded-xl transition-all active:scale-90 ${
                isCodeCopied
                  ? 'bg-green-100 text-green-700'
                  : 'hover:bg-white/60 text-gray-700 hover:text-gray-900'
              }`}
              title={isCodeCopied ? 'Zkopírováno!' : 'Zkopírovat kód'}
              aria-label={isCodeCopied ? 'Kód zkopírován' : 'Zkopírovat kód do schránky'}
            >
              {isCodeCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>

          {/* Code Display */}
          <div className="bg-gradient-to-br from-rose-50/60 to-pink-50/60 rounded-2xl p-8 text-center border border-rose-100/50">
            <p className="text-xs text-gray-600 mb-3 font-bold tracking-widest uppercase">Kód</p>
            <p className="text-4xl sm:text-7xl font-extrabold tracking-[0.15em] text-gradient">
              {userCode}
            </p>
          </div>

          {/* Feedback */}
          {isCodeCopied && (
            <p className="text-xs text-center text-green-700 font-bold animate-pulse">
              ✓ Zkopírováno do schránky!
            </p>
          )}
        </div>

        {/* Partner Section */}
        {!partner?.success ? (
          /* Connect Partner */
          <div className="glass-card-premium p-8 space-y-6 mb-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Připoj se s partnerem
              </h3>
              <p className="text-sm text-gray-600">
                Vzájemně si výměňujte své kódy
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-3 bg-red-50/90 backdrop-blur border border-red-200/60 rounded-2xl px-5 py-4 animate-slide-down">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700 font-semibold">{error}</p>
              </div>
            )}

            {/* Partner code input */}
            <div className="space-y-3">
              <label htmlFor="partner-code" className="text-gray-700">
                Kód partnera
              </label>
              <div className="flex gap-2">
                <input
                  id="partner-code"
                  value={partnerCode}
                  onChange={(e) => setPartnerCode(e.target.value.toUpperCase())}
                  placeholder="Zadej kód"
                  maxLength="8"
                  autoComplete="off"
                  className="modern-input-premium uppercase text-center font-bold tracking-[0.15em]"
                  aria-label="Kód svého partnera"
                />
                <button
                  onClick={handleConnectPartner}
                  disabled={loading || !partnerCode.trim()}
                  className="primary-button-premium shrink-0 px-4"
                  aria-busy={loading}
                >
                  {loading ? (
                    <Loader className="w-5 h-5 animate-spin" />
                  ) : (
                    <ChevronRight className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Connected View */
          <>
            {/* Connected Status */}
            <div className="glass-card-premium p-8 text-center mb-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-center justify-center gap-3 mb-3">
                <Heart className="w-6 h-6 text-rose-500 fill-rose-500 animate-pulse" />
                <p className="text-2xl font-bold text-gray-900">
                  Spojen s{' '}
                  <span className="text-transparent bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text">
                    {partner.partner_name}
                  </span>
                </p>
                <Heart className="w-6 h-6 text-pink-500 fill-pink-500 animate-pulse" style={{ animationDelay: '0.5s' }} />
              </div>
              <p className="text-base text-gray-600 font-medium">
                Sdílíte city a budujete intimitu 💕
              </p>
            </div>

            {/* Share Emotion CTA */}
            <button
              onClick={() => setPage('emotions')}
              className="primary-button-premium mb-10 group w-full animate-fade-in"
              style={{ animationDelay: '0.3s' }}
            >
              <Sparkles className="w-5 h-5" />
              <span>Sdílit novou emoci</span>
              <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </button>

            {/* Emotions List */}
            <div className="space-y-4">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wider px-1">
                Nedávné momenty
              </p>

              {emotionsList.length === 0 ? (
                /* Empty State */
                <div className="glass-card-premium p-10 text-center">
                  <Sparkles className="w-12 h-12 text-rose-300 mx-auto mb-4" />
                  <p className="text-xl font-bold text-gray-900 mb-2">
                    Zatím žádné emoce
                  </p>
                  <p className="text-base text-gray-600">
                    Začni sdílet, aby jste se lépe poznali ✨
                  </p>
                </div>
              ) : (
                /* Emotions List */
                emotionsList.map((e, idx) => {
                  const emotionObj = emotions.find(em => em.id === e.emotion_type);
                  const timestamp = new Date(e.created_at);
                  const formattedDate = timestamp.toLocaleDateString('cs-CZ', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <div
                      key={e.id}
                      className="glass-card p-6 space-y-3 animate-slide-up"
                      style={{ animationDelay: `${idx * 0.06}s` }}
                    >
                      {/* Emotion header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{emotionObj?.symbol}</span>
                          <div>
                            <p className="font-bold text-gray-900 text-base">
                              {e.shared_by?.username}
                            </p>
                            <p className="text-xs text-gray-600 font-semibold mt-0.5">
                              {emotionObj?.label}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 whitespace-nowrap font-medium">
                          {formattedDate}
                        </p>
                      </div>

                      {/* Message */}
                      <p className="text-base text-gray-800 leading-relaxed">
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
    </div>
  );
}